/** docs/API.md 1.1 의 error.code 에 화면 쪽 NETWORK_ERROR(서버에 닿지 못함)를 더한 값 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export type ApiErrorDetail = {
  field: string;
  code: string;
  message: string;
};

/**
 * 일기 API 호출이 실패했을 때 던지는 오류.
 * `message` 는 사용자에게 그대로 보여 줘도 되는 한국어 문장이다. (서버 내부 정보를 담지 않는다.)
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetail[];

  constructor(options: {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export const NETWORK_ERROR_MESSAGE = "인터넷 연결을 확인하고 다시 시도해 주세요.";
export const INTERNAL_ERROR_MESSAGE = "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.";
export const UNAUTHORIZED_MESSAGE = "로그인이 필요해요.";
export const NOT_FOUND_MESSAGE = "일기를 찾을 수 없어요.";

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

/** 화면에 보여 줄 오류 문장. ApiClientError 가 아니면 일반 문구를 쓴다. */
export function errorMessageOf(error: unknown): string {
  return isApiClientError(error) ? error.message : INTERNAL_ERROR_MESSAGE;
}
