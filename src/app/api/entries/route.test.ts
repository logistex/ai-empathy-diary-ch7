import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { analyzeDiary } from "@/lib/ai";
import type { AnalysisResult } from "@/lib/ai/types";

import { fakeDb, jsonRequest } from "../_lib/test-support";
import { GET, POST } from "./route";

// 로그인, 분석, DB는 가짜로 바꾼다. 진짜 구글·OpenRouter·DB는 부르지 않는다.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai", () => ({ analyzeDiary: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../_lib/test-support");
  return {
    insertEntry: fakeDb.insertEntry,
    listEntries: fakeDb.listEntries,
    findEntry: fakeDb.findEntry,
    deleteEntry: fakeDb.deleteEntry,
  };
});

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockAnalyze = vi.mocked(analyzeDiary);

const ME = "google-sub-me";
const OTHER = "google-sub-other";
const URL_ENTRIES = "http://localhost:3000/api/entries";

const SUCCESS: AnalysisResult = {
  status: "success",
  emotion: "기쁨",
  emotionScore: 4,
  empathyMessage: "많이 웃으셨군요. 마음이 가벼워졌겠어요.",
  isCrisis: false,
  modelUsed: "test-model-1",
};

function loginAs(userId: string | null) {
  mockAuth.mockResolvedValue(userId ? { user: { id: userId }, expires: "2099-01-01" } : null);
}

async function post(body: unknown) {
  const response = await POST(jsonRequest(URL_ENTRIES, body));
  return { response, json: await response.json() };
}

async function get(query = "") {
  const response = await GET(new Request(`${URL_ENTRIES}${query}`));
  return { response, json: await response.json() };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fakeDb.reset();
  mockAuth.mockReset();
  mockAnalyze.mockReset();
  mockAnalyze.mockResolvedValue(SUCCESS);
  loginAs(ME);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("POST /api/entries — 로그인 확인", () => {
  it("로그인하지 않았으면 401이고 분석도 저장도 하지 않는다", async () => {
    loginAs(null);
    const { response, json } = await post({ content: "오늘 일기" });
    expect(response.status).toBe(401);
    expect(json).toEqual({ error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." } });
    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(fakeDb.rows).toHaveLength(0);
  });

  it("세션에 사용자 id가 없으면 401이다", async () => {
    mockAuth.mockResolvedValue({ user: {}, expires: "2099-01-01" });
    const { response } = await post({ content: "오늘 일기" });
    expect(response.status).toBe(401);
  });

  it("401은 입력 검증(400)보다 먼저다", async () => {
    loginAs(null);
    const { response } = await post("이건 JSON이 아님");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/entries — 입력 검증", () => {
  const cases: Array<[string, unknown, string, string]> = [
    ["빈 문자열", { content: "" }, "empty", "일기를 한 줄 이상 적어 주세요."],
    ["공백만", { content: "     " }, "empty", "일기를 한 줄 이상 적어 주세요."],
    ["줄바꿈과 탭만", { content: "\n\t \r\n" }, "empty", "일기를 한 줄 이상 적어 주세요."],
    ["201자", { content: "가".repeat(201) }, "too_long", "일기는 200자까지 쓸 수 있어요."],
    ["이모지 201개", { content: "😀".repeat(201) }, "too_long", "일기는 200자까지 쓸 수 있어요."],
    ["content가 숫자", { content: 123 }, "invalid_type", "요청 형식이 올바르지 않아요."],
    ["content가 null", { content: null }, "invalid_type", "요청 형식이 올바르지 않아요."],
    ["content 없음", {}, "invalid_type", "요청 형식이 올바르지 않아요."],
    ["본문이 배열", ["가"], "invalid_type", "요청 형식이 올바르지 않아요."],
    ["본문이 null", "null", "invalid_type", "요청 형식이 올바르지 않아요."],
    ["잘못된 JSON", "{content: ", "invalid_type", "요청 형식이 올바르지 않아요."],
    ["빈 본문", "", "invalid_type", "요청 형식이 올바르지 않아요."],
    ["NUL 문자 포함", { content: "가\u0000나" }, "invalid_type", "요청 형식이 올바르지 않아요."],
  ];

  it.each(cases)("%s -> 400 %s", async (_name, body, code, message) => {
    const { response, json } = await post(body);
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: [{ field: "content", code, message }],
      },
    });
    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(fakeDb.rows).toHaveLength(0);
  });

  it("너무 큰 본문은 읽지 않고 400이다", async () => {
    const { response } = await post({ content: "가", padding: "x".repeat(70 * 1024) });
    expect(response.status).toBe(400);
  });

  it("정확히 200자는 저장된다", async () => {
    const { response } = await post({ content: "가".repeat(200) });
    expect(response.status).toBe(201);
  });

  it("이모지 200개(글자 수 200, UTF-16 길이 400)도 저장된다", async () => {
    const content = "😀".repeat(200);
    const { response, json } = await post({ content });
    expect(response.status).toBe(201);
    expect(json.entry.content).toBe(content);
  });

  it("앞뒤 공백을 지운 뒤 200자면 저장되고, 저장된 값에는 공백이 없다", async () => {
    const { response, json } = await post({ content: `  \n${"가".repeat(200)}\t ` });
    expect(response.status).toBe(201);
    expect(json.entry.content).toBe("가".repeat(200));
    expect(mockAnalyze).toHaveBeenCalledWith("가".repeat(200));
  });

  it("줄바꿈과 HTML 문자열은 그대로 저장한다 (줄바꿈은 1자)", async () => {
    const content = "<script>alert(1)</script>\n두 번째 줄";
    const { response, json } = await post({ content });
    expect(response.status).toBe(201);
    expect(json.entry.content).toBe(content);
    expect(fakeDb.rows[0].content).toBe(content);
  });
});

describe("POST /api/entries — 저장", () => {
  it("분석 성공: 201과 일기 객체를 돌려주고 DB에 저장한다", async () => {
    const { response, json } = await post({ content: "오늘 친구와 많이 웃었다." });

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Object.keys(json)).toEqual(["entry"]);
    expect(json.entry).toEqual({
      id: fakeDb.rows[0].id,
      content: "오늘 친구와 많이 웃었다.",
      createdAt: fakeDb.rows[0].created_at.toISOString(),
      analysisStatus: "success",
      emotion: "기쁨",
      emotionScore: 4,
      empathyMessage: "많이 웃으셨군요. 마음이 가벼워졌겠어요.",
      isCrisis: false,
      modelUsed: "test-model-1",
    });
    expect(json.entry).not.toHaveProperty("userId");
    expect(json.entry).not.toHaveProperty("user_id");
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyze).toHaveBeenCalledWith("오늘 친구와 많이 웃었다.");
  });

  it("요청 본문에 다른 user_id·userId·분석 결과가 있어도 무시한다", async () => {
    const { response, json } = await post({
      content: "내 일기",
      user_id: OTHER,
      userId: OTHER,
      emotion: "분노",
      emotionScore: 5,
      isCrisis: true,
      modelUsed: "해킹 모델",
      id: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(201);
    expect(fakeDb.rows).toHaveLength(1);
    expect(fakeDb.rows[0].user_id).toBe(ME);
    expect(fakeDb.insertEntry).toHaveBeenCalledWith(ME, expect.any(Object));
    // 분석 결과는 서버가 AI 모듈로 만든다.
    expect(json.entry.emotion).toBe("기쁨");
    expect(json.entry.isCrisis).toBe(false);
    expect(json.entry.modelUsed).toBe("test-model-1");
    expect(json.entry.id).not.toBe("11111111-1111-4111-8111-111111111111");
  });

  it("주소에 다른 userId를 붙여도 무시한다", async () => {
    const response = await POST(jsonRequest(`${URL_ENTRIES}?userId=${OTHER}`, { content: "내 일기" }));
    expect(response.status).toBe(201);
    expect(fakeDb.rows[0].user_id).toBe(ME);
  });

  it("분석 실패: 일기는 저장하고 감정 열 4개는 null, 201과 failed 모양으로 응답한다", async () => {
    mockAnalyze.mockResolvedValue({ status: "failed", isCrisis: false });
    const { response, json } = await post({ content: "그냥 조용한 하루" });

    expect(response.status).toBe(201);
    expect(json.entry).toEqual({
      id: fakeDb.rows[0].id,
      content: "그냥 조용한 하루",
      createdAt: fakeDb.rows[0].created_at.toISOString(),
      analysisStatus: "failed",
      emotion: null,
      emotionScore: null,
      empathyMessage: null,
      isCrisis: false,
      modelUsed: null,
    });
    const stored = fakeDb.rows[0];
    expect([stored.emotion, stored.emotion_score, stored.empathy_message, stored.model_used]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("분석 실패여도 isCrisis는 결과 값(키워드 검사)으로 저장하고 응답한다", async () => {
    mockAnalyze.mockResolvedValue({ status: "failed", isCrisis: true });
    const { response, json } = await post({ content: "위기 표현이 있는 일기" });

    expect(response.status).toBe(201);
    expect(json.entry.analysisStatus).toBe("failed");
    expect(json.entry.isCrisis).toBe(true);
    expect(json.entry.emotion).toBeNull();
    expect(fakeDb.rows[0].is_crisis).toBe(true);
  });

  it("분석 성공이면서 위기면 감정 정보와 isCrisis 둘 다 저장한다", async () => {
    mockAnalyze.mockResolvedValue({ ...SUCCESS, emotion: "슬픔", isCrisis: true });
    const { json } = await post({ content: "많이 힘든 하루" });
    expect(json.entry.analysisStatus).toBe("success");
    expect(json.entry.isCrisis).toBe(true);
    expect(fakeDb.rows[0].is_crisis).toBe(true);
    expect(fakeDb.rows[0].emotion).toBe("슬픔");
  });

  it("analyzeDiary가 예외를 던져도 일기는 저장하고 201 failed로 응답한다", async () => {
    mockAnalyze.mockRejectedValue(new Error("비밀 일기 내용이 들어간 오류 메시지"));
    const { response, json } = await post({ content: "비밀 일기 내용" });

    expect(response.status).toBe(201);
    expect(json.entry.analysisStatus).toBe("failed");
    expect(fakeDb.rows).toHaveLength(1);
    expect(fakeDb.rows[0].emotion).toBeNull();
    // 로그에는 오류 이름만 남고 메시지(일기 내용)는 남지 않는다.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("비밀 일기 내용");
  });

  it("analyzeDiary가 예외를 던져도 위기 문장이면 키워드 검사로 isCrisis true를 저장하고 응답한다", async () => {
    mockAnalyze.mockRejectedValue(new Error("분석 오류"));
    const { response, json } = await post({ content: "요즘 정말 죽고 싶어요" });

    expect(response.status).toBe(201);
    expect(json.entry.analysisStatus).toBe("failed");
    expect(json.entry.isCrisis).toBe(true);
    expect(fakeDb.rows[0].is_crisis).toBe(true);
  });

  it("analyzeDiary가 예외를 던져도 평범한 문장이면 isCrisis는 false다", async () => {
    mockAnalyze.mockRejectedValue(new Error("분석 오류"));
    const { json } = await post({ content: "점심이 맛있었다" });
    expect(json.entry.isCrisis).toBe(false);
  });

  it("성공 결과가 약속과 달라 실패로 낮출 때도 위기 문장이면 isCrisis true다", async () => {
    mockAnalyze.mockResolvedValue({
      ...SUCCESS,
      emotionScore: 9,
      isCrisis: false,
    } as unknown as AnalysisResult);
    const { json } = await post({ content: "스스로 목숨을 끊고 싶다" });
    expect(json.entry.analysisStatus).toBe("failed");
    expect(json.entry.isCrisis).toBe(true);
  });

  it("analyzeDiary가 약속과 다른 값을 돌려줘도(모르는 감정 이름 등) 분석 실패로 저장한다", async () => {
    mockAnalyze.mockResolvedValue({
      ...SUCCESS,
      emotion: "외로움",
      isCrisis: true,
    } as unknown as AnalysisResult);
    const { response, json } = await post({ content: "저장은 되어야 한다" });

    expect(response.status).toBe(201);
    expect(json.entry.analysisStatus).toBe("failed");
    expect(json.entry.isCrisis).toBe(true);
    expect(fakeDb.rows[0].emotion).toBeNull();
  });

  it("저장(DB)이 실패하면 500이고, 내부 정보와 일기 원문이 응답·로그에 없다", async () => {
    fakeDb.insertEntry.mockRejectedValueOnce(
      Object.assign(
        new Error('new row violates check constraint; Failing row contains (비밀 일기 원문, postgres://user:pw@host/db)'),
        { code: "23514" },
      ),
    );
    const { response, json } = await post({ content: "비밀 일기 원문" });

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.",
      },
    });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("비밀 일기 원문");
    expect(logged).not.toContain("postgres://");
    expect(logged).toContain("23514");
  });
});

describe("GET /api/entries — 목록", () => {
  it("로그인하지 않았으면 401이다", async () => {
    loginAs(null);
    const { response, json } = await get();
    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(fakeDb.listEntries).not.toHaveBeenCalled();
  });

  it("기록이 없으면 빈 목록과 nextCursor null, 200이다", async () => {
    const { response, json } = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json).toEqual({ entries: [], nextCursor: null });
  });

  it("내 일기만 최신순으로 나오고, 남의 일기는 나오지 않는다", async () => {
    const first = fakeDb.seed({ user_id: ME, content: "첫째" });
    fakeDb.seed({ user_id: OTHER, content: "남의 것" });
    const second = fakeDb.seed({ user_id: ME, content: "둘째" });

    const { json } = await get();
    expect(json.entries.map((e: { id: string }) => e.id)).toEqual([second.id, first.id]);
    expect(JSON.stringify(json)).not.toContain("남의 것");
    expect(json.entries[0]).not.toHaveProperty("userId");
    expect(json.entries[0]).not.toHaveProperty("user_id");
    expect(fakeDb.listEntries.mock.calls[0][0]).toBe(ME);
  });

  it("분석에 실패한 일기(null 열)도 failed 모양으로 목록에 나온다", async () => {
    fakeDb.seed({
      user_id: ME,
      emotion: null,
      emotion_score: null,
      empathy_message: null,
      model_used: null,
      is_crisis: true,
    });
    const { json } = await get();
    expect(json.entries[0]).toMatchObject({
      analysisStatus: "failed",
      emotion: null,
      emotionScore: null,
      empathyMessage: null,
      modelUsed: null,
      isCrisis: true,
    });
  });

  it("주소의 userId는 무시하고 세션 사용자의 일기만 돌려준다", async () => {
    fakeDb.seed({ user_id: OTHER, content: "남의 것" });
    const mine = fakeDb.seed({ user_id: ME, content: "내 것" });
    const { json } = await get(`?userId=${OTHER}&user_id=${OTHER}`);
    expect(json.entries.map((e: { id: string }) => e.id)).toEqual([mine.id]);
  });

  it("limit을 생략하면 20개씩 나눈다", async () => {
    for (let i = 0; i < 25; i++) fakeDb.seed({ user_id: ME });
    const { json } = await get();
    expect(json.entries).toHaveLength(20);
    expect(json.nextCursor).toEqual(expect.any(String));
  });

  it("cursor로 끝까지 따라가면 모든 일기가 중복 없이 최신순으로 한 번씩 나온다", async () => {
    const seeded = Array.from({ length: 5 }, (_, i) => fakeDb.seed({ user_id: ME, content: `일기 ${i}` }));
    for (let i = 0; i < 3; i++) fakeDb.seed({ user_id: OTHER });

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `?limit=2&cursor=${cursor}` : "?limit=2";
      const { response, json } = await get(query);
      expect(response.status).toBe(200);
      seen.push(...json.entries.map((e: { id: string }) => e.id));
      cursor = json.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3); // 2 + 2 + 1
    expect(cursor).toBeNull();
    expect(seen).toEqual(seeded.map((r) => r.id).reverse());
  });

  it("정확히 limit개만 남았으면 nextCursor는 null이다", async () => {
    for (let i = 0; i < 4; i++) fakeDb.seed({ user_id: ME });
    const first = await get("?limit=2");
    const second = await get(`?limit=2&cursor=${first.json.nextCursor}`);
    expect(second.json.entries).toHaveLength(2);
    expect(second.json.nextCursor).toBeNull();
  });

  it("created_at이 같은 일기도 id 내림차순으로 정해진 순서대로 나뉜다", async () => {
    const at = new Date("2026-11-05T05:00:00.000Z");
    const rows = [1, 2, 3].map(() => fakeDb.seed({ user_id: ME, created_at: at }));
    const expected = rows.map((r) => r.id).sort().reverse();

    const first = await get("?limit=2");
    const second = await get(`?limit=2&cursor=${first.json.nextCursor}`);
    const seen = [...first.json.entries, ...second.json.entries].map((e: { id: string }) => e.id);
    expect(seen).toEqual(expected);
  });

  it("목록을 보는 도중 새 일기가 써져도 이미 본 항목이 중복되지 않는다", async () => {
    for (let i = 0; i < 3; i++) fakeDb.seed({ user_id: ME });
    const first = await get("?limit=2");
    await post({ content: "중간에 쓴 새 일기" });
    const second = await get(`?limit=2&cursor=${first.json.nextCursor}`);

    const firstIds = first.json.entries.map((e: { id: string }) => e.id);
    const secondIds = second.json.entries.map((e: { id: string }) => e.id);
    expect(secondIds).toHaveLength(1);
    expect(firstIds).not.toContain(secondIds[0]);
  });

  it.each(["0", "51", "-1", "1.5", "abc", "", "1e1", "0020"])("limit=%s는 400 invalid_limit", async (limit) => {
    const { response, json } = await get(`?limit=${limit}`);
    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details).toEqual([
      { field: "limit", code: "invalid_limit", message: "요청 값이 올바르지 않아요." },
    ]);
    expect(fakeDb.listEntries).not.toHaveBeenCalled();
  });

  it.each([
    ["아무 문자열", "not-a-cursor"],
    ["빈 값", ""],
    ["base64url이지만 JSON이 아님", Buffer.from("hello").toString("base64url")],
    [
      "id가 uuid가 아님",
      Buffer.from(JSON.stringify({ c: "2026-11-05T05:12:34.567000Z", i: "1; DROP TABLE diary.entries" })).toString(
        "base64url",
      ),
    ],
    [
      "시각이 존재하지 않음",
      Buffer.from(
        JSON.stringify({ c: "2026-02-31T05:12:34.567000Z", i: "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11" }),
      ).toString("base64url"),
    ],
    ["base64url 문자가 아님", "abc$%^"],
  ])("cursor가 잘못됨 (%s) -> 400 invalid_cursor", async (_name, cursor) => {
    const { response, json } = await get(`?cursor=${encodeURIComponent(cursor)}`);
    expect(response.status).toBe(400);
    expect(json.error.details).toEqual([
      { field: "cursor", code: "invalid_cursor", message: "요청 값이 올바르지 않아요." },
    ]);
    expect(fakeDb.listEntries).not.toHaveBeenCalled();
  });

  it("limit=1과 limit=50은 허용된다", async () => {
    expect((await get("?limit=1")).response.status).toBe(200);
    expect((await get("?limit=50")).response.status).toBe(200);
  });

  it("DB 오류는 500이고 내부 정보가 없다", async () => {
    fakeDb.listEntries.mockRejectedValueOnce(new Error("connection to postgres://user:pw@host failed"));
    const { response, json } = await get();
    expect(response.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(json)).not.toContain("postgres://");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("postgres://");
  });
});
