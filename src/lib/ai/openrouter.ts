import "server-only";

import {
  MAX_OUTPUT_TOKENS,
  MODEL_OPTIONS,
  OPENROUTER_BASE_URL,
  REQUEST_TIMEOUT_MS,
  TEMPERATURE,
} from "./config";
import type { ChatMessage } from "./prompts";

/**
 * OpenRouter 채팅 호출 한 번 (서버 전용).
 *
 * - API 키는 호출하는 쪽(index.ts)이 process.env에서 읽어 넘겨준다. 이 파일은 키를 저장하거나 출력하지 않는다.
 * - 예외를 던지지 않는다. 결과는 { ok: true, text } 또는 { ok: false, kind, status? }로 돌려준다.
 * - 실패 이유(kind, 상태 코드)만 돌려준다. 응답 본문은 돌려주지도, 로그에 남기지도 않는다.
 */

/** 호출 실패 종류. 모델 전환 규칙(PLAN 2-B)의 "시간 초과 / HTTP 오류·네트워크 오류 / 빈 응답"에 해당한다. */
export type CallFailureKind =
  | "timeout" // 정해진 시간 안에 응답이 없음
  | "network" // 연결 자체가 실패함
  | "http_error" // HTTP 상태가 2xx가 아님(429, 5xx 포함), 또는 200인데 본문이 오류
  | "bad_response" // 본문이 JSON이 아니거나 모양이 예상과 다름
  | "empty"; // 모델이 내용을 돌려주지 않음

export type CallResult =
  | { ok: true; text: string }
  | { ok: false; kind: CallFailureKind; status?: number };

export type CallOptions = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  /** 시험에서 줄이기 위한 값. 기본은 config의 REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
};

/** OpenRouter가 돌려주는 응답 중 우리가 쓰는 부분. */
type ChatCompletionBody = {
  error?: { code?: number | string };
  choices?: { message?: { content?: unknown } }[];
};

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/** content가 문자열이거나, { type: "text", text } 조각 배열일 때 글만 이어 붙인다. */
function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("");
  }
  return "";
}

export async function callOpenRouter(options: CallOptions): Promise<CallResult> {
  const { apiKey, model, messages, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_OUTPUT_TOKENS,
  };
  if (MODEL_OPTIONS[model]?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  // 시간 초과: 연결부터 본문을 다 읽을 때까지를 한 번에 제한한다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, kind: "http_error", status: response.status };
    }

    let json: ChatCompletionBody;
    try {
      json = (await response.json()) as ChatCompletionBody;
    } catch (error) {
      if (isAbortError(error)) return { ok: false, kind: "timeout" };
      return { ok: false, kind: "bad_response", status: response.status };
    }

    // OpenRouter는 모델 쪽 오류를 HTTP 200과 { error } 본문으로 돌려주기도 한다.
    if (json && typeof json === "object" && json.error) {
      const code = Number(json.error.code);
      return { ok: false, kind: "http_error", status: Number.isFinite(code) ? code : response.status };
    }

    const text = extractContent(json?.choices?.[0]?.message?.content);
    if (text.trim().length === 0) return { ok: false, kind: "empty" };
    return { ok: true, text };
  } catch (error) {
    if (isAbortError(error)) return { ok: false, kind: "timeout" };
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}
