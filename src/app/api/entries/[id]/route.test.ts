import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { fakeDb, jsonRequest } from "../../_lib/test-support";
import { DELETE, GET } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../../_lib/test-support");
  return {
    insertEntry: fakeDb.insertEntry,
    listEntries: fakeDb.listEntries,
    findEntry: fakeDb.findEntry,
    deleteEntry: fakeDb.deleteEntry,
  };
});

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;

const ME = "google-sub-me";
const OTHER = "google-sub-other";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

function loginAs(userId: string | null) {
  mockAuth.mockResolvedValue(userId ? { user: { id: userId }, expires: "2099-01-01" } : null);
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function getOne(id: string, url = `http://localhost:3000/api/entries/${id}`) {
  const response = await GET(new Request(url), ctx(id));
  return { response, json: await response.json() };
}

async function deleteOne(id: string, request?: Request) {
  const response = await DELETE(
    request ?? new Request(`http://localhost:3000/api/entries/${id}`, { method: "DELETE" }),
    ctx(id),
  );
  return { response, json: await response.json() };
}

const NOT_FOUND = { error: { code: "NOT_FOUND", message: "일기를 찾을 수 없어요." } };

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fakeDb.reset();
  mockAuth.mockReset();
  loginAs(ME);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("GET /api/entries/[id]", () => {
  it("로그인하지 않았으면 401이다", async () => {
    const mine = fakeDb.seed({ user_id: ME });
    loginAs(null);
    const { response, json } = await getOne(mine.id);
    expect(response.status).toBe(401);
    expect(json).toEqual({ error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." } });
    expect(fakeDb.findEntry).not.toHaveBeenCalled();
  });

  it("내 일기는 200과 일기 객체를 돌려준다 (userId 없음, no-store)", async () => {
    const mine = fakeDb.seed({ user_id: ME, content: "내 일기", is_crisis: true });
    const { response, json } = await getOne(mine.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json).toEqual({
      entry: {
        id: mine.id,
        content: "내 일기",
        createdAt: mine.created_at.toISOString(),
        analysisStatus: "success",
        emotion: "평온",
        emotionScore: 3,
        empathyMessage: "시험용 공감 메시지예요.",
        isCrisis: true,
        modelUsed: "test-model",
      },
    });
    expect(fakeDb.findEntry).toHaveBeenCalledWith(ME, mine.id);
  });

  it("남의 일기 id는 404이고, 없는 id와 응답이 똑같다", async () => {
    const theirs = fakeDb.seed({ user_id: OTHER, content: "남의 비밀" });

    const other = await getOne(theirs.id);
    const missing = await getOne(MISSING_ID);

    expect(other.response.status).toBe(404);
    expect(other.json).toEqual(NOT_FOUND);
    expect(missing.response.status).toBe(404);
    expect(missing.json).toEqual(other.json);
    expect(JSON.stringify(other.json)).not.toContain("남의 비밀");
  });

  it("uuid 형식이 아닌 id는 DB를 부르지 않고 404이다", async () => {
    for (const id of ["abc", "1", "../etc/passwd", "1; DROP TABLE diary.entries", "'%20OR%201=1"]) {
      const { response, json } = await getOne(id);
      expect(response.status).toBe(404);
      expect(json).toEqual(NOT_FOUND);
    }
    expect(fakeDb.findEntry).not.toHaveBeenCalled();
  });

  it("주소에 다른 userId를 붙여도 남의 일기는 404이다", async () => {
    const theirs = fakeDb.seed({ user_id: OTHER });
    const { response } = await getOne(theirs.id, `http://localhost:3000/api/entries/${theirs.id}?userId=${OTHER}`);
    expect(response.status).toBe(404);
  });

  it("DB 오류는 500이다", async () => {
    fakeDb.findEntry.mockRejectedValueOnce(new Error("db down"));
    const { response, json } = await getOne(MISSING_ID);
    expect(response.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /api/entries/[id]", () => {
  it("로그인하지 않았으면 401이고 지워지지 않는다", async () => {
    const mine = fakeDb.seed({ user_id: ME });
    loginAs(null);
    const { response, json } = await deleteOne(mine.id);
    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(fakeDb.rows).toHaveLength(1);
    expect(fakeDb.deleteEntry).not.toHaveBeenCalled();
  });

  it("내 일기를 지우면 200이고 실제로 사라진다", async () => {
    const mine = fakeDb.seed({ user_id: ME });
    const keep = fakeDb.seed({ user_id: ME });

    const { response, json } = await deleteOne(mine.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json).toEqual({ deleted: true, id: mine.id });
    expect(fakeDb.deleteEntry).toHaveBeenCalledWith(ME, mine.id);
    expect(fakeDb.rows.map((r) => r.id)).toEqual([keep.id]);
  });

  it("위기 일기, 분석에 실패한 일기도 똑같이 지운다", async () => {
    const crisis = fakeDb.seed({
      user_id: ME,
      is_crisis: true,
      emotion: null,
      emotion_score: null,
      empathy_message: null,
      model_used: null,
    });
    const { response } = await deleteOne(crisis.id);
    expect(response.status).toBe(200);
    expect(fakeDb.rows).toHaveLength(0);
  });

  it("지운 일기를 다시 조회하거나 다시 지우면 404이다", async () => {
    const mine = fakeDb.seed({ user_id: ME });
    expect((await deleteOne(mine.id)).response.status).toBe(200);

    const again = await deleteOne(mine.id);
    expect(again.response.status).toBe(404);
    expect(again.json).toEqual(NOT_FOUND);

    const read = await getOne(mine.id);
    expect(read.response.status).toBe(404);
  });

  it("남의 일기 id를 지우려 하면 404이고, 그 일기는 그대로 남는다", async () => {
    const theirs = fakeDb.seed({ user_id: OTHER, content: "남의 비밀" });

    const { response, json } = await deleteOne(theirs.id);

    expect(response.status).toBe(404);
    expect(json).toEqual(NOT_FOUND);
    expect(fakeDb.rows.map((r) => r.id)).toEqual([theirs.id]);
    // 삭제 쿼리에 넘어간 사용자는 세션의 사용자다.
    expect(fakeDb.deleteEntry).toHaveBeenCalledWith(ME, theirs.id);
  });

  it("요청 본문·주소에 다른 user_id를 넣어도 무시한다", async () => {
    const theirs = fakeDb.seed({ user_id: OTHER });
    const request = jsonRequest(
      `http://localhost:3000/api/entries/${theirs.id}?userId=${OTHER}&user_id=${OTHER}`,
      { userId: OTHER, user_id: OTHER },
      "DELETE",
    );

    const { response } = await deleteOne(theirs.id, request);

    expect(response.status).toBe(404);
    expect(fakeDb.rows).toHaveLength(1);
    expect(fakeDb.deleteEntry).toHaveBeenCalledWith(ME, theirs.id);
  });

  it("없는 id와 uuid 형식이 아닌 id는 404이다 (형식 오류는 DB를 부르지 않는다)", async () => {
    expect((await deleteOne(MISSING_ID)).response.status).toBe(404);
    fakeDb.deleteEntry.mockClear();
    const bad = await deleteOne("not-a-uuid");
    expect(bad.response.status).toBe(404);
    expect(bad.json).toEqual(NOT_FOUND);
    expect(fakeDb.deleteEntry).not.toHaveBeenCalled();
  });

  it("DB 오류는 500이다", async () => {
    fakeDb.deleteEntry.mockRejectedValueOnce(new Error("db down"));
    const { response, json } = await deleteOne(MISSING_ID);
    expect(response.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});
