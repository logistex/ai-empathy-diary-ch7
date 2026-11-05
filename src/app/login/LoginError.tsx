"use client";

import { useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/Alert";

// Auth.js가 로그인 오류를 /login?error=코드 로 돌려보낼 때(auth.ts의 pages.error) 보여 줄 문구.
// 코드 원문(Configuration 등)은 사용자에게 보이지 않는다.
const MESSAGES: Record<string, string> = {
  AccessDenied: "로그인이 취소되었어요. 다시 시도해 주세요.",
};
const DEFAULT_MESSAGE = "로그인 중에 잠깐 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? DEFAULT_MESSAGE;
}

/** 주소의 ?error= 값을 읽어 안내 상자를 보여 준다. 오류가 없으면 아무것도 그리지 않는다. */
export function LoginError() {
  const message = loginErrorMessage(useSearchParams().get("error"));
  if (!message) return null;
  return (
    <Alert tone="error" role="alert">
      {message}
    </Alert>
  );
}
