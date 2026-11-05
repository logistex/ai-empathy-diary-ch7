import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "./errors";
import { createHttpEntriesApi } from "./http-api";
import type { Entry } from "./types";

const ENTRY: Entry = {
  id: "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11",
  content: "오늘 친구와 오랜만에 만나서 많이 웃었다.",
  createdAt: "2026-11-05T05:12:34.567Z",
  analysisStatus: "success",
  emotion: "기쁨",
  emotionScore: 4,
  empathyMessage: "오랜만에 친구를 만나 많이 웃으셨군요.",
  isCrisis: false,
  modelUsed: "nvidia/nemotron-3-ultra-550b-a55b:free",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function errorOf(promise: Promise<unknown>): Promise<ApiClientError> {
  return (await promise.then(
    () => null,
    (e: unknown) => e,
  )) as ApiClientError;
}

describe("createHttpEntriesApi (docs/API.md 형식)", () => {
  it("createEntry: POST /api/entries 에 { content } 를 JSON 으로 보내고 entry 를 돌려준다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entry: ENTRY }, 201));
    const api = createHttpEntriesApi(fetchMock);

    await expect(api.createEntry("오늘 친구와")).resolves.toEqual(ENTRY);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/entries");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ content: "오늘 친구와" });
    expect(init.credentials).toBe("same-origin");
    expect(init.cache).toBe("no-store");
  });

  it("저장 요청에 시간 제한(signal)을 걸지 않는다 (AI 분석으로 최대 약 40초 걸린다)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entry: ENTRY }, 201));
    const api = createHttpEntriesApi(fetchMock);

    await api.createEntry("오늘 친구와");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeUndefined();
    expect("signal" in init).toBe(false);
  });

  it("listEntries: limit·cursor 를 쿼리로 붙이고, 첫 페이지는 쿼리 없이 부른다", async () => {
    // Response 본문은 한 번만 읽을 수 있으므로 호출할 때마다 새로 만든다.
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ entries: [ENTRY], nextCursor: "abc_DEF-123" })),
      );
    const api = createHttpEntriesApi(fetchMock);

    const first = await api.listEntries();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/entries");
    expect(first).toEqual({ entries: [ENTRY], nextCursor: "abc_DEF-123" });

    await api.listEntries({ cursor: "abc_DEF-123", limit: 20 });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/entries?limit=20&cursor=abc_DEF-123");
  });

  it("listEntries: nextCursor 가 null 이면 마지막 페이지다", async () => {
    const api = createHttpEntriesApi(
      vi.fn().mockResolvedValue(jsonResponse({ entries: [], nextCursor: null })),
    );
    await expect(api.listEntries()).resolves.toEqual({ entries: [], nextCursor: null });
  });

  it("getEntry: id 를 주소에 안전하게 넣는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entry: ENTRY }));
    const api = createHttpEntriesApi(fetchMock);
    await api.getEntry("a/b");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/entries/a%2Fb");
  });

  it("deleteEntry: DELETE /api/entries/[id] 를 부르고 { deleted: true } 면 성공", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ deleted: true, id: ENTRY.id }));
    const api = createHttpEntriesApi(fetchMock);

    await expect(api.deleteEntry(ENTRY.id)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/entries/${ENTRY.id}`);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("400 오류: error.code·message·details 를 그대로 담는다", async () => {
    const api = createHttpEntriesApi(
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "일기는 200자까지 쓸 수 있어요.",
              details: [
                { field: "content", code: "too_long", message: "일기는 200자까지 쓸 수 있어요." },
              ],
            },
          },
          400,
        ),
      ),
    );

    const error = await errorOf(api.createEntry("x"));
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("일기는 200자까지 쓸 수 있어요.");
    expect(error.details?.[0].code).toBe("too_long");
  });

  it("401·404 오류 코드를 구분한다", async () => {
    const unauthorized = createHttpEntriesApi(
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." } }, 401),
        ),
    );
    const notFound = createHttpEntriesApi(
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "NOT_FOUND", message: "일기를 찾을 수 없어요." } }, 404),
        ),
    );

    const e401 = await errorOf(unauthorized.listEntries());
    const e404 = await errorOf(notFound.deleteEntry("x"));
    expect([e401.status, e401.code]).toEqual([401, "UNAUTHORIZED"]);
    expect([e404.status, e404.code]).toEqual([404, "NOT_FOUND"]);
  });

  it("오류 본문이 JSON 이 아니면 상태 코드로 기본 문구를 만든다", async () => {
    const api = createHttpEntriesApi(
      vi.fn().mockResolvedValue(new Response("<html>오류</html>", { status: 500 })),
    );
    const error = await errorOf(api.listEntries());
    expect(error.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.");
  });

  it("서버에 닿지 못하면 NETWORK_ERROR 를 던진다", async () => {
    const api = createHttpEntriesApi(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await errorOf(api.listEntries());
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("인터넷 연결을 확인하고 다시 시도해 주세요.");
  });

  it("성공 응답의 모양이 약속과 다르면 오류로 본다", async () => {
    const api = createHttpEntriesApi(
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ nothing: true }))),
    );
    await expect(api.createEntry("x")).rejects.toBeInstanceOf(ApiClientError);
    await expect(api.listEntries()).rejects.toBeInstanceOf(ApiClientError);
  });
});
