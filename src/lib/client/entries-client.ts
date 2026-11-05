/**
 * 화면이 일기 API를 부르는 유일한 입구.
 *
 * 화면 컴포넌트는 여기서 createEntry / listEntries / getEntry / deleteEntry 만 불러 쓴다.
 * 실제로 mock 을 쓸지 진짜 fetch 를 쓸지는 config.ts 의 USE_MOCK_API 한 줄로 정한다.
 *
 * 공통 처리: 로그인이 필요하다는 응답(401)을 받으면 /login 으로 보낸 뒤, 호출한 쪽에도 오류를 그대로 던진다.
 * (호출한 쪽은 401 일 때 따로 오류 문구를 크게 띄우지 않아도 된다.)
 *
 * 시간 제한: 저장(POST)은 AI 분석 때문에 10초 안팎, 길면 40초까지 걸린다. (서버 maxDuration 60초)
 * 그래서 여기서도 http-api.ts 에서도 fetch 에 시간 제한(AbortSignal.timeout 등)을 걸지 않는다.
 */
import { USE_MOCK_API } from "./config";
import { createEntriesClient } from "./create-client";
import { httpEntriesApi } from "./http-api";
import type { EntriesApi } from "./types";

export { createEntriesClient };

/**
 * 쓸 구현을 고른다.
 *
 * mock 은 개발 중 USE_MOCK_API 를 true 로 바꿨을 때만 쓰며, 처음 부를 때 동적으로 불러온다.
 * `process.env.NODE_ENV !== "production"` 조건은 빌드 때 false 로 굳어지므로, 번들러가 이 블록을 통째로 지워
 * mock-api.ts(샘플 일기 포함)가 운영 번들에 들어가지 않는다. (USE_MOCK_API 값만으로는 지워지지 않는다. 다른 파일의 값이라서.)
 */
function selectApi(): EntriesApi {
  if (process.env.NODE_ENV !== "production" && USE_MOCK_API) {
    const load = () => import("./mock-api").then((module) => module.mockEntriesApi);
    return {
      createEntry: async (content) => (await load()).createEntry(content),
      listEntries: async (options) => (await load()).listEntries(options),
      getEntry: async (id) => (await load()).getEntry(id),
      deleteEntry: async (id) => (await load()).deleteEntry(id),
    };
  }
  return httpEntriesApi;
}

export const entriesClient: EntriesApi = createEntriesClient(selectApi());

export const createEntry = entriesClient.createEntry;
export const listEntries = entriesClient.listEntries;
export const getEntry = entriesClient.getEntry;
export const deleteEntry = entriesClient.deleteEntry;
