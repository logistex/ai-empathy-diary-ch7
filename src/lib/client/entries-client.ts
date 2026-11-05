/**
 * 화면이 일기 API를 부르는 유일한 입구.
 *
 * 화면 컴포넌트는 여기서 createEntry / listEntries / getEntry / deleteEntry 만 불러 쓴다.
 * 실제로 mock 을 쓸지 진짜 fetch 를 쓸지는 config.ts 의 USE_MOCK_API 한 줄로 정한다.
 *
 * 공통 처리: 로그인이 필요하다는 응답(401)을 받으면 /login 으로 보낸 뒤, 호출한 쪽에도 오류를 그대로 던진다.
 * (호출한 쪽은 401 일 때 따로 오류 문구를 크게 띄우지 않아도 된다.)
 */
import { USE_MOCK_API } from "./config";
import { isApiClientError } from "./errors";
import { httpEntriesApi } from "./http-api";
import { redirectToLogin } from "./login-redirect";
import { mockEntriesApi } from "./mock-api";
import type { EntriesApi } from "./types";

/** 어떤 구현이든 401 이 오면 로그인 화면으로 보내도록 감싼다. */
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

export const entriesClient: EntriesApi = createEntriesClient(
  USE_MOCK_API ? mockEntriesApi : httpEntriesApi,
);

export const createEntry = entriesClient.createEntry;
export const listEntries = entriesClient.listEntries;
export const getEntry = entriesClient.getEntry;
export const deleteEntry = entriesClient.deleteEntry;
