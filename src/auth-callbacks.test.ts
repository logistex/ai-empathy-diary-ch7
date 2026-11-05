import { describe, expect, it } from "vitest";
import type { Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { authCallbacks } from "./auth-callbacks";

type JwtArgs = Parameters<typeof authCallbacks.jwt>[0];
type SessionArgs = Parameters<typeof authCallbacks.session>[0];

const googleAccount = {
  provider: "google",
  type: "oidc",
  providerAccountId: "109876543210987654321",
} as Account;

describe("authCallbacks.jwt", () => {
  it("로그인할 때 Auth.js가 만든 임의 UUID 대신 구글 계정 ID를 sub로 쓴다", () => {
    const token = authCallbacks.jwt({
      token: { sub: "c79a1b2c-0000-4000-8000-0000000005fe" },
      account: googleAccount,
    } as JwtArgs) as JWT;
    expect(token.sub).toBe("109876543210987654321");
  });

  it("같은 구글 계정으로 다시 로그인하면 UUID가 달라도 sub가 같다", () => {
    const first = authCallbacks.jwt({ token: { sub: "uuid-1" }, account: googleAccount } as JwtArgs) as JWT;
    const second = authCallbacks.jwt({ token: { sub: "uuid-2" }, account: googleAccount } as JwtArgs) as JWT;
    expect(first.sub).toBe(second.sub);
  });

  it("로그인 뒤의 요청(account 없음)에서는 저장된 sub를 바꾸지 않는다", () => {
    const token = authCallbacks.jwt({ token: { sub: "109876543210987654321" }, account: null } as JwtArgs) as JWT;
    expect(token.sub).toBe("109876543210987654321");
  });
});

describe("authCallbacks.session", () => {
  it("token.sub를 session.user.id로 옮긴다", () => {
    const session = authCallbacks.session({
      session: { user: { name: "나" }, expires: "2099-01-01T00:00:00.000Z" } as Session,
      token: { sub: "109876543210987654321" },
    } as SessionArgs) as Session;
    expect(session.user.id).toBe("109876543210987654321");
  });
});
