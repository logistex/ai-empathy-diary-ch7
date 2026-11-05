/**
 * 진짜 `/api/entries` 를 fetch 로 부르는 구현 (docs/API.md 형식 그대로).
 * 같은 도메인이므로 로그인 쿠키가 자동으로 붙는다. 비밀 값은 다루지 않는다.
 */
import {
  ApiClientError,
  INTERNAL_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NOT_FOUND_MESSAGE,
  UNAUTHORIZED_MESSAGE,
  type ApiErrorCode,
  type ApiErrorDetail,
} from "./errors";
import type { Entry, EntriesApi, EntryPage, ListEntriesOptions } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ENTRIES_URL = "/api/entries";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 일기 객체인지 가볍게 확인한다. (잘못된 응답으로 화면이 깨지지 않게) */
function isEntry(value: unknown): value is Entry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.content === "string" &&
    typeof value.createdAt === "string" &&
    (value.analysisStatus === "success" || value.analysisStatus === "failed") &&
    typeof value.isCrisis === "boolean"
  );
}

const KNOWN_CODES: ApiErrorCode[] = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "INTERNAL_ERROR",
];

/** 상태 코드만 알 때 쓰는 기본 오류 (본문이 JSON 이 아니거나 형식이 다를 때) */
function fallbackError(status: number): ApiClientError {
  if (status === 401) {
    return new ApiClientError({ status, code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE });
  }
  if (status === 404) {
    return new ApiClientError({ status, code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });
  }
  return new ApiClientError({ status, code: "INTERNAL_ERROR", message: INTERNAL_ERROR_MESSAGE });
}

/** 오류 응답 본문({ error: { code, message, details? } })을 ApiClientError 로 바꾼다. */
function toApiError(status: number, body: unknown): ApiClientError {
  const error = isRecord(body) ? body.error : undefined;
  if (!isRecord(error) || typeof error.message !== "string") {
    return fallbackError(status);
  }

  const code = KNOWN_CODES.includes(error.code as ApiErrorCode)
    ? (error.code as ApiErrorCode)
    : fallbackError(status).code;
  const details = Array.isArray(error.details)
    ? (error.details.filter(
        (detail): detail is ApiErrorDetail =>
          isRecord(detail) &&
          typeof detail.field === "string" &&
          typeof detail.code === "string" &&
          typeof detail.message === "string",
      ) as ApiErrorDetail[])
    : undefined;

  return new ApiClientError({ status, code, message: error.message, details });
}

/**
 * 요청을 보내고 JSON 본문을 돌려준다. 실패하면 ApiClientError 를 던진다.
 * - 서버에 닿지 못함 → NETWORK_ERROR
 * - 2xx 가 아님 → 오류 본문 해석
 * - 2xx 인데 JSON 이 아님 → INTERNAL_ERROR
 */
async function request(fetchImpl: FetchLike, url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError({ status: 0, code: "NETWORK_ERROR", message: NETWORK_ERROR_MESSAGE });
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw toApiError(response.status, body);
  }
  if (body === null) {
    throw fallbackError(500);
  }
  return body;
}

/** fetch 를 바꿔 끼울 수 있게 한 이유: 테스트에서 가짜 fetch 를 넣으려고. 기본은 전역 fetch. */
export function createHttpEntriesApi(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): EntriesApi {
  return {
    async createEntry(content) {
      const body = await request(fetchImpl, ENTRIES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!isRecord(body) || !isEntry(body.entry)) throw fallbackError(500);
      return body.entry;
    },

    async listEntries(options: ListEntriesOptions = {}): Promise<EntryPage> {
      const params = new URLSearchParams();
      if (options.limit !== undefined) params.set("limit", String(options.limit));
      if (options.cursor) params.set("cursor", options.cursor);
      const query = params.toString();

      const body = await request(fetchImpl, query ? `${ENTRIES_URL}?${query}` : ENTRIES_URL);
      if (!isRecord(body) || !Array.isArray(body.entries) || !body.entries.every(isEntry)) {
        throw fallbackError(500);
      }
      const nextCursor = typeof body.nextCursor === "string" ? body.nextCursor : null;
      return { entries: body.entries, nextCursor };
    },

    async getEntry(id) {
      const body = await request(fetchImpl, `${ENTRIES_URL}/${encodeURIComponent(id)}`);
      if (!isRecord(body) || !isEntry(body.entry)) throw fallbackError(500);
      return body.entry;
    },

    async deleteEntry(id) {
      const body = await request(fetchImpl, `${ENTRIES_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!isRecord(body) || body.deleted !== true) throw fallbackError(500);
    },
  };
}

export const httpEntriesApi: EntriesApi = createHttpEntriesApi();
