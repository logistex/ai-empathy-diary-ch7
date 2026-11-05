/** 로그인이 필요할 때(401) 이동할 경로 (docs/API.md 3번) */
export const LOGIN_PATH = "/login";

/**
 * 로그인 화면으로 보낸다. 전체 페이지를 새로 불러와 이전 화면의 일기가 남지 않게 한다.
 * 브라우저가 아닌 곳(서버 렌더링, 테스트)에서는 아무 일도 하지 않는다.
 * 테스트에서는 이 모듈을 vi.mock 으로 바꿔 호출 여부만 확인한다.
 */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  // 일부러 전체 페이지를 새로 불러온다. 화면 밖(API 호출 함수)에서 불리므로 router 를 쓸 수 없다.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(LOGIN_PATH);
}
