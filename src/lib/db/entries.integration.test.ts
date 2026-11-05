import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSql } from "./client";
import { deleteEntry, findEntry, insertEntry, listEntries } from "./entries";

/**
 * 실제 DB로 하는 통합 시험. 기본 `npm test`에서는 건너뛴다.
 * 돌리려면 RUN_DB_TESTS=1 과 DATABASE_URL이 있는 셸에서 실행한다. 예)
 *   RUN_DB_TESTS=1 node --env-file=.env node_modules/vitest/vitest.mjs run src/lib/db/entries.integration.test.ts
 *
 * 안전 규칙
 *  - diary.entries에만 쓴다. user_id는 "test-2a-"로 시작하는 시험용 값 두 개뿐이다.
 *  - 끝나면 (실패해도) 그 두 user_id의 행만 지운다. 다른 행·스키마는 건드리지 않는다.
 */
const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("diary.entries 실제 DB 통합 시험", () => {
  const runId = randomUUID().slice(0, 8);
  const A = `test-2a-${runId}-a`;
  const B = `test-2a-${runId}-b`;

  async function cleanup() {
    const sql = getSql();
    await sql`DELETE FROM diary.entries WHERE user_id IN ${sql([A, B])}`;
  }

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await getSql().end({ timeout: 5 });
  });

  const success = (content: string) => ({
    content,
    emotion: "기쁨",
    emotionScore: 4,
    empathyMessage: "시험용 공감 메시지예요.",
    isCrisis: false,
    modelUsed: "test-model",
  });
  const failed = (content: string, isCrisis = false) => ({
    content,
    emotion: null,
    emotionScore: null,
    empathyMessage: null,
    isCrisis,
    modelUsed: null,
  });

  it("저장 -> 조회 -> 목록(cursor 페이지 나눔) -> 삭제, 남의 일기는 보이지도 지워지지도 않는다", async () => {
    // A: 분석 성공 1, 실패 1(위기), 성공 3. B: 1개
    const a1 = await insertEntry(A, success("A 일기 1 😀\n줄바꿈"));
    const a2 = await insertEntry(A, failed("A 일기 2 (분석 실패)", true));
    const a3 = await insertEntry(A, success("A 일기 3"));
    const a4 = await insertEntry(A, success("A 일기 4"));
    const a5 = await insertEntry(A, success("A 일기 5"));
    const b1 = await insertEntry(B, success("B 일기 1"));

    // 저장 결과 모양
    expect(a1.content).toBe("A 일기 1 😀\n줄바꿈");
    expect(a1.emotion_score).toBe(4);
    expect(a1.created_at).toBeInstanceOf(Date);
    expect(a2).toMatchObject({ emotion: null, emotion_score: null, empathy_message: null, model_used: null, is_crisis: true });
    expect(a1).not.toHaveProperty("user_id");

    // 내 일기 조회 / 남의 일기 조회
    expect((await findEntry(A, a1.id))?.id).toBe(a1.id);
    expect(await findEntry(A, b1.id)).toBeNull();
    expect(await findEntry(B, a1.id)).toBeNull();
    expect(await findEntry(A, randomUUID())).toBeNull();

    // cursor 페이지 나눔: 2개씩, 마이크로초 위치(cursor_ts) 기준으로 중복·누락 없이 최신순
    const expected = [a5, a4, a3, a2, a1].map((r) => r.id);
    const seen: string[] = [];
    let after: { createdAt: string; id: string } | undefined;
    let pages = 0;
    for (;;) {
      const rows = await listEntries(A, { limit: 3, after });
      pages += 1;
      const page = rows.slice(0, 2);
      seen.push(...page.map((r) => r.id));
      if (rows.length <= 2) break;
      const last = page[page.length - 1];
      expect(last.cursor_ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      after = { createdAt: last.cursor_ts, id: last.id };
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(expected);

    // B의 목록에는 B 것만
    expect((await listEntries(B, { limit: 10 })).map((r) => r.id)).toEqual([b1.id]);

    // 남의 일기 삭제 시도 -> null, 행은 그대로
    expect(await deleteEntry(A, b1.id)).toBeNull();
    expect((await findEntry(B, b1.id))?.id).toBe(b1.id);

    // 내 일기 삭제 -> 실제로 사라지고, 다시 지우면 null
    expect(await deleteEntry(A, a1.id)).toBe(a1.id);
    expect(await findEntry(A, a1.id)).toBeNull();
    expect(await deleteEntry(A, a1.id)).toBeNull();

    const sql = getSql();
    const left = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM diary.entries WHERE user_id IN ${sql([A, B])}`;
    expect(left[0].n).toBe(5); // A 4개 + B 1개
  });

  it("DB 제약: 분석 결과가 일부만 있는 행은 저장되지 않는다 (all_or_none CHECK)", async () => {
    await expect(
      insertEntry(A, { ...failed("일부만 있음"), emotion: "기쁨" }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("DB 제약: NUL 문자가 든 내용은 저장되지 않는다 (서버가 먼저 막는 이유)", async () => {
    await expect(insertEntry(A, success("가\u0000나"))).rejects.toBeDefined();
  });
});
