import { NextResponse } from "next/server";

import { auth } from "@/auth";

/**
 * 로그인 보호 (Next.js 16부터 middleware.ts 대신 proxy.ts를 쓴다).
 *
 * - 화면 경로: 로그인하지 않았으면 /login 으로 보낸다. (로그인 후 돌아올 주소는 callbackUrl에 담는다.)
 * - /api/entries* : 이동시키지 않고 401 JSON을 돌려준다. (API 핸들러도 각자 세션을 다시 확인한다.)
 * - 제외(matcher): /login, /api/auth/*, 정적 파일 → 로그인 없이 열 수 있다.
 *
 * 비밀 값(AUTH_SECRET 등)은 Auth.js가 process.env에서 읽는다. 이 파일에는 값이 없다.
 */
export default auth((request) => {
  if (request.auth?.user) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  // API는 화면이 아니므로 로그인 화면으로 보내지 않고 401을 돌려준다.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // 화면: 로그인 화면으로 이동. callbackUrl은 같은 사이트 안의 경로만 담는다.
  const loginUrl = new URL("/login", request.nextUrl.origin);
  if (pathname !== "/") {
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // /login, /api/auth/*, Next.js 내부 파일, favicon, 이미지 등 정적 파일은 제외한다.
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
