/**
 * mock <-> 실제 API 전환 스위치 (화면이 일기 데이터를 어디서 가져올지 정하는 유일한 곳).
 *
 * - true : 브라우저 안의 가짜 데이터(mock-api.ts)로 동작한다. 서버·DB·로그인 없이 화면을 볼 수 있다.
 * - false: 진짜 `/api/entries` 를 fetch 로 부른다. (http-api.ts)
 *
 * 3단계(통합)에서 이 값을 false 로 바꾸면 화면 코드는 그대로 실제 API에 연결된다.
 * 화면 컴포넌트는 `@/lib/client/entries-client` 만 불러오고, mock/http 를 직접 알지 못한다.
 */
export const USE_MOCK_API = true;
