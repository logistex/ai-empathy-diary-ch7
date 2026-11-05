/**
 * /api/entries 공통 응답 만들기 (docs/API.md 1.1 오류 응답 형식, 1.2 상태 코드).
 *
 * `_lib` 폴더는 밑줄로 시작해서 Next.js가 주소(라우트)로 만들지 않는다.
 * 오류 응답의 message에는 사용자에게 보여도 되는 한국어 문장만 넣는다.
 * (SQL, 스택, 환경 변수 이름, 일기 원문 같은 내부 정보를 넣지 않는다.)
 */

/** 검증 오류 한 건. API.md 5.1의 details[] 모양. */
export type ValidationDetail = {
  field: "content" | "limit" | "cursor";
  code: "empty" | "too_long" | "invalid_type" | "invalid_cursor" | "invalid_limit";
  message: string;
};

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** 성공 응답. 모든 /api/entries 응답에 Cache-Control: no-store를 붙인다. */
export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function errorBody(code: string, message: string, details?: ValidationDetail[]) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function unauthorized(): Response {
  return jsonResponse(errorBody("UNAUTHORIZED", "로그인이 필요해요."), 401);
}

export function notFound(): Response {
  return jsonResponse(errorBody("NOT_FOUND", "일기를 찾을 수 없어요."), 404);
}

export function internalError(): Response {
  return jsonResponse(
    errorBody("INTERNAL_ERROR", "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요."),
    500,
  );
}

/** 400. 맨 위 message는 첫 번째 상세 오류의 문장을 쓴다. */
export function validationError(details: ValidationDetail[]): Response {
  return jsonResponse(errorBody("VALIDATION_ERROR", details[0].message, details), 400);
}

/**
 * 서버 로그용 오류 요약. 이름과 Postgres 오류 코드(있다면)만 남긴다.
 * 오류 메시지·상세에는 일기 원문(CHECK 위반의 "Failing row" 등), 연결 문자열이 들어갈 수 있어 기록하지 않는다.
 */
export function logServerError(where: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code).slice(0, 20)
      : undefined;
  console.error(`[api] ${where} 실패`, { name, code });
}
