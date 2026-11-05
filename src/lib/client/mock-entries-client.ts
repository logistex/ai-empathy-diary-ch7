/**
 * 화면 테스트 전용: entries-client.ts 대신 mock 일기 API 를 쓰는 입구.
 *
 * 화면 테스트 파일에서 아래처럼 갈아 끼운다. (USE_MOCK_API 가 false 여도 테스트는 mock 으로 돈다.)
 *
 *   vi.mock("@/lib/client/entries-client", () => import("@/lib/client/mock-entries-client"));
 *
 * 운영 코드는 이 파일을 불러오지 않는다. (그래서 mock 샘플 데이터가 운영 번들에 들어가지 않는다.)
 * 401 처리는 운영과 같은 createEntriesClient 를 거친다.
 */
import { createEntriesClient } from "./create-client";
import { mockEntriesApi } from "./mock-api";
import type { EntriesApi } from "./types";

export const entriesClient: EntriesApi = createEntriesClient(mockEntriesApi);

export { createEntriesClient };
export const createEntry = entriesClient.createEntry;
export const listEntries = entriesClient.listEntries;
export const getEntry = entriesClient.getEntry;
export const deleteEntry = entriesClient.deleteEntry;
