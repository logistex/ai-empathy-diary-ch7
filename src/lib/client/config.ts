/**
 * mock <-> 실제 API 전환 스위치 (화면이 일기 데이터를 어디서 가져올지 정하는 유일한 곳).
 *
 * - false: 진짜 `/api/entries` 를 fetch 로 부른다. (http-api.ts) ← 운영·3단계 통합의 기본값
 * - true : 브라우저 안의 가짜 데이터(mock-api.ts)로 동작한다. 서버·DB·로그인 없이 화면만 볼 때 쓴다.
 *
 * mock-api.ts(샘플 일기 포함)는 운영 빌드(`npm run build`)의 브라우저 번들에 들어가지 않는다.
 * (entries-client.ts 가 개발 모드이면서 이 값이 true 일 때만 동적으로 불러오고, 운영 빌드에서는 그 코드가 지워진다.
 *  그래서 true 로 바꿔도 운영 빌드는 항상 실제 API 를 쓴다.)
 * 화면 컴포넌트는 `@/lib/client/entries-client` 만 불러오고, mock/http 를 직접 알지 못한다.
 * 화면 테스트는 이 값과 상관없이 mock-entries-client.ts 로 갈아 끼워 mock 으로 돈다.
 */
export const USE_MOCK_API = false;
