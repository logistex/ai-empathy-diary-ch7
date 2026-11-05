import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEntriesClient } from "./entries-client";
import { ApiClientError } from "./errors";
import { redirectToLogin } from "./login-redirect";
import type { EntriesApi } from "./types";

vi.mock("./login-redirect", () => ({ redirectToLogin: vi.fn(), LOGIN_PATH: "/login" }));

function failingApi(error: unknown): EntriesApi {
  return {
    createEntry: vi.fn().mockRejectedValue(error),
    listEntries: vi.fn().mockRejectedValue(error),
    getEntry: vi.fn().mockRejectedValue(error),
    deleteEntry: vi.fn().mockRejectedValue(error),
  };
}

describe("createEntriesClient — 401 이면 로그인 화면으로 보낸다", () => {
  beforeEach(() => {
    vi.mocked(redirectToLogin).mockClear();
  });

  const unauthorized = new ApiClientError({
    status: 401,
    code: "UNAUTHORIZED",
    message: "로그인이 필요해요.",
  });

  it("네 가지 호출 모두 401 을 받으면 /login 으로 보내고, 오류는 그대로 던진다", async () => {
    const client = createEntriesClient(failingApi(unauthorized));

    await expect(client.createEntry("x")).rejects.toBe(unauthorized);
    await expect(client.listEntries()).rejects.toBe(unauthorized);
    await expect(client.getEntry("id")).rejects.toBe(unauthorized);
    await expect(client.deleteEntry("id")).rejects.toBe(unauthorized);

    expect(redirectToLogin).toHaveBeenCalledTimes(4);
  });

  it("401 이 아닌 오류에서는 로그인 화면으로 보내지 않는다", async () => {
    const serverError = new ApiClientError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "잠시 문제가 생겼어요.",
    });
    const client = createEntriesClient(failingApi(serverError));

    await expect(client.listEntries()).rejects.toBe(serverError);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it("성공하면 값을 그대로 돌려주고 로그인 화면으로 보내지 않는다", async () => {
    const page = { entries: [], nextCursor: null };
    const client = createEntriesClient({
      ...failingApi(null),
      listEntries: vi.fn().mockResolvedValue(page),
    });

    await expect(client.listEntries({ limit: 5 })).resolves.toBe(page);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });
});
