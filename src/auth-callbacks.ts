import type { NextAuthConfig } from "next-auth";

/**
 * Auth.js 콜백 — src/auth.ts에서 쓰고, 테스트하기 쉽게 따로 둔다.
 *
 * 왜 jwt 콜백이 필요한가:
 * DB 어댑터가 없으면 Auth.js는 로그인할 때마다 user.id를 crypto.randomUUID()로 새로 만들고,
 * 그 값이 기본 token.sub가 된다. 그대로 쓰면 다시 로그인할 때 user_id가 바뀌어 지난 일기가 사라진다.
 * 그래서 로그인 순간(account가 있을 때) 구글 계정의 고유 ID(providerAccountId)로 sub를 바꾼다.
 * 로그인 뒤의 요청에서는 account가 없으므로 이미 저장된 sub를 그대로 둔다.
 */
export const authCallbacks = {
  jwt({ token, account }) {
    if (account?.provider === "google" && account.providerAccountId) {
      token.sub = account.providerAccountId;
    }
    return token;
  },
  // JWT의 sub(구글 계정 ID)를 세션 사용자 id로 옮긴다.
  session({ session, token }) {
    if (token.sub) {
      session.user.id = token.sub;
    }
    return session;
  },
} satisfies NextAuthConfig["callbacks"];
