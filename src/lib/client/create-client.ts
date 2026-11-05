/**
 * 어떤 일기 API 구현이든 "401 이면 로그인 화면으로 보낸 뒤 오류를 그대로 던진다"는 공통 처리를 입힌다.
 * (entries-client.ts 와 테스트용 mock-entries-client.ts 가 함께 쓴다.)
 */
import { isApiClientError } from "./errors";
import { redirectToLogin } from "./login-redirect";
import type { EntriesApi } from "./types";

export function createEntriesClient(api: EntriesApi): EntriesApi {
  async function guarded<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        redirectToLogin();
      }
      throw error;
    }
  }

  return {
    createEntry: (content) => guarded(() => api.createEntry(content)),
    listEntries: (options) => guarded(() => api.listEntries(options)),
    getEntry: (id) => guarded(() => api.getEntry(id)),
    deleteEntry: (id) => guarded(() => api.deleteEntry(id)),
  };
}
