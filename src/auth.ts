import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js(next-auth v5) 설정 — 구글 로그인 + JWT 세션.
 *
 * - DB 어댑터를 쓰지 않는다. (users·accounts 같은 표가 diary 밖에 생기지 않게 하려는 것)
 * - 구글 계정의 고유 ID(token.sub)를 일기의 user_id로 쓴다.
 *   서버 코드에서는 `const session = await auth(); session?.user?.id` 로 꺼낸다.
 * - 필요한 환경 변수(이름만): AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
 *   Auth.js가 AUTH_ 접두어 변수를 알아서 읽으므로 코드에 값을 쓰지 않는다.
 * - 이 파일은 서버에서만 불러온다. ("use client" 파일에서 import하지 않는다.)
 */

declare module "next-auth" {
  interface Session {
    user: {
      /** 구글 계정의 고유 ID (JWT의 sub). 일기의 user_id로 쓴다. */
      id: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // JWT의 sub(구글 계정 ID)를 세션 사용자 id로 옮긴다.
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
