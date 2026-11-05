import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getSql } from "@/lib/db/client";

import { GET as getList, POST } from "./route";
import { DELETE, GET as getOne } from "./[id]/route";

/**
 * route 핸들러를 직접 부르는 통합 시험. 기본 `npm test`에서는 건너뛴다.
 * 로그인(세션)만 가짜이고, analyzeDiary(OpenRouter 호출)와 DB는 진짜다.
 *
 * 돌리려면 RUN_E2E=1 과 .env의 DATABASE_URL, OPENROUTER_API_KEY가 있는 셸에서 실행한다. 예)
 *   RUN_E2E=1 node --env-file=.env node_modules/vitest/vitest.mjs run src/app/api/entries/e2e.integration.test.ts
 *
 * 안전 규칙
 *  - diary.entries에만 쓴다. user_id는 "test-3-"로 시작하는 시험용 값 하나뿐이다.
 *  - 끝나면 (실패해도) 그 user_id의 행만 지우고, 남은 행이 0인지 확인해 출력한다.
 *  - 틀린 키 시험은 이 프로세스의 process.env만 덮어쓴다. .env 파일은 건드리지 않는다.
 *  - 일기 원문, DATABASE_URL, API 키는 출력하지 않는다. 응답과 로그에 나왔는지 검사한다.
 *    (공감 메시지, 모델 이름, 감정, 걸린 시간은 출력한다.)
 */
const enabled =
  process.env.RUN_E2E === "1" && Boolean(process.env.DATABASE_URL) && Boolean(process.env.OPENROUTER_API_KEY);

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;

const URL_ENTRIES = "http://localhost:3000/api/entries";
const PLAIN = "오늘은 퇴근길에 노을이 예뻐서 한참 바라보았다.";
// 위기 시험 문장. 키워드 검사에 걸리는 표현이다.
const CRISIS = "요즘 너무 지쳐서 죽고 싶다는 생각이 자꾸 든다.";
const WRONG_KEY = "sk-or-v1-wrong-key-for-test-only";

/** 보고용 출력. console을 쓰지 않는다. (아래에서 console을 가로채 누출 검사를 하기 때문이다.) */
function report(line: string) {
  process.stdout.write(`[e2e] ${line}\n`);
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!enabled)("POST /api/entries 실제 연결 시험 (세션만 가짜)", () => {
  const userId = `test-3-${randomUUID().slice(0, 8)}`;
  const realKey = process.env.OPENROUTER_API_KEY;
  const captured: unknown[][] = [];
  const bodies: string[] = [];
  const spies: Array<{ mockRestore: () => void }> = [];

  async function countRows(): Promise<number> {
    const sql = getSql();
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM diary.entries WHERE user_id = ${userId}`;
    return n;
  }

  async function cleanup() {
    const sql = getSql();
    await sql`DELETE FROM diary.entries WHERE user_id = ${userId}`;
  }

  async function post(content: string) {
    const started = Date.now();
    const response = await POST(
      new Request(URL_ENTRIES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    );
    const ms = Date.now() - started;
    const text = await response.text();
    bodies.push(text);
    return { response, ms, json: JSON.parse(text) as Json };
  }

  beforeAll(async () => {
    await cleanup();
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: userId }, expires: "2099-01-01" });
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      spies.push(vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void captured.push(args)));
    }
  });

  afterEach(async () => {
    while (spies.length) spies.pop()?.mockRestore();
    process.env.OPENROUTER_API_KEY = realKey; // 틀린 키 시험 뒤 되돌린다.
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    report(`정리 확인: user_id ${userId.slice(0, 7)}... 남은 행 ${await countRows()}개`);
    await getSql().end({ timeout: 5 });
  });

  it("정상 키: 평범한 문장과 위기 문장을 저장하고 목록·조회·삭제까지 확인한다", { timeout: 180_000 }, async () => {
    // 1. 평범한 문장
    const plain = await post(PLAIN);
    expect(plain.response.status).toBe(201);
    const p = plain.json.entry;
    report(
      `평범: ${plain.ms}ms model=${p.modelUsed} status=${p.analysisStatus} emotion=${p.emotion}(${p.emotionScore}) isCrisis=${p.isCrisis}`,
    );
    report(`평범 공감 메시지: ${p.empathyMessage}`);
    expect(p.analysisStatus).toBe("success");
    expect(p.modelUsed).toEqual(expect.any(String));
    expect(p.isCrisis).toBe(false);

    // 2. 위기 문장
    const crisis = await post(CRISIS);
    expect(crisis.response.status).toBe(201);
    const c = crisis.json.entry;
    report(
      `위기: ${crisis.ms}ms model=${c.modelUsed} status=${c.analysisStatus} emotion=${c.emotion}(${c.emotionScore}) isCrisis=${c.isCrisis}`,
    );
    report(`위기 공감 메시지: ${c.empathyMessage}`);
    expect(c.isCrisis).toBe(true);
    expect(await countRows()).toBe(2);

    // 3. 목록 (최신순: 위기 문장이 먼저)
    const list = await getList(new Request(URL_ENTRIES));
    const listText = await list.text();
    bodies.push(listText);
    const listJson = JSON.parse(listText) as Json;
    expect(list.status).toBe(200);
    expect(listJson.entries.map((e: Json) => e.id)).toEqual([c.id, p.id]);
    expect(listJson.nextCursor).toBeNull();
    expect(listJson.entries[0]).not.toHaveProperty("userId");

    // 4. 하나 조회
    const one = await getOne(new Request(`${URL_ENTRIES}/${p.id}`), { params: Promise.resolve({ id: p.id }) });
    const oneText = await one.text();
    bodies.push(oneText);
    expect(one.status).toBe(200);
    expect((JSON.parse(oneText) as Json).entry).toEqual(p);

    // 5. 삭제 -> 다시 조회하면 404, 목록에서도 사라짐
    const del = await DELETE(new Request(`${URL_ENTRIES}/${p.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: p.id }),
    });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ deleted: true, id: p.id });
    const again = await getOne(new Request(`${URL_ENTRIES}/${p.id}`), { params: Promise.resolve({ id: p.id }) });
    expect(again.status).toBe(404);
    expect(await countRows()).toBe(1);
    report(`조회·삭제 확인 완료 (삭제 후 404, 남은 행 1개는 정리 단계에서 지운다)`);

    expectNoLeak();
  });

  it("틀린 키: 일기는 저장되고 analysisStatus는 failed, 위기 문장은 isCrisis true", { timeout: 180_000 }, async () => {
    process.env.OPENROUTER_API_KEY = WRONG_KEY;

    const plain = await post(PLAIN);
    expect(plain.response.status).toBe(201);
    expect(plain.json.entry).toMatchObject({
      analysisStatus: "failed",
      emotion: null,
      emotionScore: null,
      empathyMessage: null,
      modelUsed: null,
      isCrisis: false,
    });

    const crisis = await post(CRISIS);
    expect(crisis.response.status).toBe(201);
    expect(crisis.json.entry).toMatchObject({ analysisStatus: "failed", isCrisis: true, emotion: null });
    expect(await countRows()).toBe(2);

    report(
      `틀린 키: 평범 ${plain.ms}ms status=${plain.json.entry.analysisStatus} isCrisis=${plain.json.entry.isCrisis} / 위기 ${crisis.ms}ms status=${crisis.json.entry.analysisStatus} isCrisis=${crisis.json.entry.isCrisis}`,
    );

    expectNoLeak(WRONG_KEY);
  });

  /** 응답 본문과 console 출력에 일기 원문, DATABASE_URL, API 키가 없는지 확인한다. */
  function expectNoLeak(...extraSecrets: string[]) {
    const secrets = [process.env.DATABASE_URL, realKey, ...extraSecrets].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    const logged = JSON.stringify(captured);
    for (const secret of secrets) {
      expect(logged.includes(secret)).toBe(false);
      for (const body of bodies) expect(body.includes(secret)).toBe(false);
    }
    // 로그에는 일기 원문이 없어야 한다. (응답에는 원문이 있어도 된다. 본인 일기이기 때문이다.)
    for (const text of [PLAIN, CRISIS]) expect(logged.includes(text)).toBe(false);
    // 오류 응답이 아니므로 응답 본문에 스택·SQL 흔적도 없어야 한다.
    for (const body of bodies) expect(body).not.toMatch(/postgres|stack|SELECT |INSERT /i);
  }
});
