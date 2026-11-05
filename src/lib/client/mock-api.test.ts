import { beforeEach, describe, expect, it } from "vitest";

import type { ApiClientError } from "./errors";
import {
  createSeedEntries,
  mockEntriesApi,
  resetMockApi,
  setMockOptions,
  setMockPreset,
} from "./mock-api";
import type { EntryPage } from "./types";

async function errorOf(promise: Promise<unknown>): Promise<ApiClientError> {
  return (await promise.then(
    () => null,
    (e: unknown) => e,
  )) as ApiClientError;
}

describe("mock 일기 API — docs/API.md 의 여러 상황을 다시 만든다", () => {
  beforeEach(() => {
    resetMockApi(undefined, { delayMs: 0 });
  });

  it("성공: 분석 결과가 있는 일기를 저장하고 목록 맨 위에 둔다", async () => {
    const entry = await mockEntriesApi.createEntry("  오늘은 산책을 했다.  ");
    expect(entry.analysisStatus).toBe("success");
    expect(entry.content).toBe("오늘은 산책을 했다."); // 앞뒤 공백을 지운 값
    expect(entry.emotion).not.toBeNull();
    expect(entry.empathyMessage).not.toBeNull();
    expect(entry.isCrisis).toBe(false);

    const page = await mockEntriesApi.listEntries();
    expect(page.entries[0].id).toBe(entry.id);
  });

  it("분석 실패: 분석 필드가 모두 null 이고 일기는 저장된다", async () => {
    const entry = await mockEntriesApi.createEntry("[실패] 조용한 하루");
    expect(entry).toMatchObject({
      analysisStatus: "failed",
      emotion: null,
      emotionScore: null,
      empathyMessage: null,
      modelUsed: null,
      isCrisis: false,
    });
    expect((await mockEntriesApi.listEntries()).entries[0].id).toBe(entry.id);
  });

  it("위기(성공)와 위기(분석 실패)", async () => {
    const crisisOk = await mockEntriesApi.createEntry("[위기] 시험 문장");
    expect(crisisOk.isCrisis).toBe(true);
    expect(crisisOk.analysisStatus).toBe("success");

    const crisisFailed = await mockEntriesApi.createEntry("[위기실패] 시험 문장");
    expect(crisisFailed.isCrisis).toBe(true);
    expect(crisisFailed.analysisStatus).toBe("failed");
    expect(crisisFailed.empathyMessage).toBeNull();
  });

  it("저장 오류: 500 INTERNAL_ERROR (표시 또는 옵션)", async () => {
    const byTag = await errorOf(mockEntriesApi.createEntry("[저장오류] 시험"));
    expect([byTag.status, byTag.code]).toEqual([500, "INTERNAL_ERROR"]);

    setMockPreset("save-error");
    const byPreset = await errorOf(mockEntriesApi.createEntry("그냥 일기"));
    expect(byPreset.status).toBe(500);
  });

  it("서버와 같은 입력 검증: 빈 입력·공백·201자는 400", async () => {
    const empty = await errorOf(mockEntriesApi.createEntry("   "));
    expect([empty.status, empty.details?.[0].code]).toEqual([400, "empty"]);

    const tooLong = await errorOf(mockEntriesApi.createEntry("가".repeat(201)));
    expect([tooLong.status, tooLong.details?.[0].code]).toEqual([400, "too_long"]);
    expect(tooLong.message).toBe("일기는 200자까지 쓸 수 있어요.");
  });

  it("빈 목록: entries 는 [] 이고 nextCursor 는 null", async () => {
    setMockPreset("empty");
    expect(await mockEntriesApi.listEntries()).toEqual({ entries: [], nextCursor: null });
  });

  it("cursor 페이지 나눔: 중복 없이 모두 이어지고 마지막 페이지의 nextCursor 는 null", async () => {
    const total = createSeedEntries().length;
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const page: EntryPage = await mockEntriesApi.listEntries({ cursor, limit: 10 });
      seen.push(...page.entries.map((entry) => entry.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(Math.ceil(total / 10));
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);

    // 최신순
    const times = (await mockEntriesApi.listEntries({ limit: 50 })).entries.map((e) =>
      Date.parse(e.createdAt),
    );
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("알 수 없는 cursor 는 400 invalid_cursor", async () => {
    const error = await errorOf(mockEntriesApi.listEntries({ cursor: "엉터리" }));
    expect([error.status, error.details?.[0].code]).toEqual([400, "invalid_cursor"]);
  });

  it("목록 불러오기 오류, 더 보기 오류, 로그인 필요", async () => {
    setMockOptions({ list: "error" });
    expect((await errorOf(mockEntriesApi.listEntries())).status).toBe(500);

    setMockOptions({ list: "error-on-more" });
    const first = await mockEntriesApi.listEntries();
    expect(first.nextCursor).not.toBeNull();
    const more = await errorOf(mockEntriesApi.listEntries({ cursor: first.nextCursor }));
    expect(more.status).toBe(500);

    setMockPreset("unauthorized");
    expect((await errorOf(mockEntriesApi.listEntries())).status).toBe(401);
    expect((await errorOf(mockEntriesApi.createEntry("일기"))).status).toBe(401);
    expect((await errorOf(mockEntriesApi.deleteEntry("mock-001"))).status).toBe(401);
  });

  it("삭제: 지운 일기는 목록과 조회에서 사라지고, 다시 지우면 404", async () => {
    await mockEntriesApi.deleteEntry("mock-001");
    const ids = (await mockEntriesApi.listEntries({ limit: 50 })).entries.map((e) => e.id);
    expect(ids).not.toContain("mock-001");
    expect((await errorOf(mockEntriesApi.getEntry("mock-001"))).status).toBe(404);
    expect((await errorOf(mockEntriesApi.deleteEntry("mock-001"))).status).toBe(404);
  });

  it("삭제 오류: 일기는 그대로 남는다", async () => {
    setMockPreset("delete-error");
    expect((await errorOf(mockEntriesApi.deleteEntry("mock-001"))).status).toBe(500);
    expect(await mockEntriesApi.getEntry("mock-001")).toMatchObject({ id: "mock-001" });
  });

  it("샘플 데이터에 성공·분석 실패·위기(성공)·위기(분석 실패)가 모두 있다", () => {
    const kinds = new Set(
      createSeedEntries().map((e) => `${e.analysisStatus}-${e.isCrisis ? "crisis" : "normal"}`),
    );
    expect(kinds).toEqual(
      new Set(["success-normal", "failed-normal", "success-crisis", "failed-crisis"]),
    );
  });
});
