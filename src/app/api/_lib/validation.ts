import { z } from "zod";

import type { ValidationDetail } from "./responses";

/**
 * /api/entries 입력 검증 (docs/API.md 5.1, 5.2).
 * 형식 오류는 모두 ValidationDetail 목록으로 돌려주고, 400 응답으로 바꾸는 일은 호출하는 쪽이 한다.
 */

export const MAX_CONTENT_LENGTH = 200;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
/** 요청 본문 최대 크기(글자 수). 200자 일기에는 한참 넉넉하고, 터무니없이 큰 본문은 읽지 않고 거절한다. */
export const MAX_BODY_LENGTH = 64 * 1024;

const MESSAGES = {
  empty: "일기를 한 줄 이상 적어 주세요.",
  too_long: `일기는 ${MAX_CONTENT_LENGTH}자까지 쓸 수 있어요.`,
  invalid_type: "요청 형식이 올바르지 않아요.",
  invalid_cursor: "요청 값이 올바르지 않아요.",
  invalid_limit: "요청 값이 올바르지 않아요.",
} as const;

function detail(field: ValidationDetail["field"], code: ValidationDetail["code"]): ValidationDetail {
  return { field, code, message: MESSAGES[code] };
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; details: ValidationDetail[] };

// ---------------------------------------------------------------------------
// POST 본문
// ---------------------------------------------------------------------------

/**
 * content 규칙: 앞뒤 공백을 지운 뒤 1자 이상 200자 이하.
 * 글자 수는 유니코드 문자 기준(Array.from)이라 이모지 하나가 1자다. 줄바꿈도 1자다.
 * 사용자에게 보이는 규칙은 custom 이슈의 message에 코드 이름(empty 등)을 담아 구분한다.
 */
const contentSchema = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({ code: "custom", message: "empty" });
    } else if (value.includes("\u0000")) {
      // Postgres text 열은 NUL 문자를 저장하지 못한다. 저장 오류(500)가 되지 않게 먼저 거절한다.
      ctx.addIssue({ code: "custom", message: "invalid_type" });
    } else if (Array.from(value).length > MAX_CONTENT_LENGTH) {
      ctx.addIssue({ code: "custom", message: "too_long" });
    }
  });

// z.object는 모르는 필드(userId, emotion, isCrisis 등)를 결과에서 버린다. 그래서 본문의 다른 값은 무시된다.
const createBodySchema = z.object({ content: contentSchema });

/** 이미 JSON으로 읽은 본문을 검증한다. 성공하면 앞뒤 공백을 지운 content만 돌려준다. */
export function parseCreateBody(body: unknown): ParseResult<{ content: string }> {
  const result = createBodySchema.safeParse(body);
  if (result.success) {
    return { ok: true, value: { content: result.data.content } };
  }
  const issue = result.error.issues[0];
  const code =
    issue?.code === "custom" && (issue.message === "empty" || issue.message === "too_long")
      ? issue.message
      : "invalid_type";
  return { ok: false, details: [detail("content", code)] };
}

/** 요청 본문 문자열을 JSON으로 읽는다. 크거나 JSON이 아니면 invalid_type 오류. */
export function parseJsonText(text: string): ParseResult<unknown> {
  if (text.length > MAX_BODY_LENGTH) {
    return { ok: false, details: [detail("content", "invalid_type")] };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, details: [detail("content", "invalid_type")] };
  }
}

/** 요청 본문을 읽어 JSON으로 푼다. 읽지 못하거나 JSON이 아니면 invalid_type 오류. */
export async function readJsonBody(request: Request): Promise<ParseResult<unknown>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, details: [detail("content", "invalid_type")] };
  }
  return parseJsonText(text);
}

// ---------------------------------------------------------------------------
// 목록 쿼리 (limit, cursor)
// ---------------------------------------------------------------------------

const limitSchema = z
  .string()
  .regex(/^[0-9]{1,3}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_LIMIT));

/** cursor가 담는 위치. createdAt은 마이크로초 정밀도 UTC 시각 문자열, id는 uuid. */
export type CursorPosition = { createdAt: string; id: string };

const CURSOR_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 마지막 항목의 위치로 cursor 문자열을 만든다. (base64url 한 덩어리, 화면은 해석하지 않는다.) */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ c: position.createdAt, i: position.id }), "utf8").toString(
    "base64url",
  );
}

/** cursor 문자열을 읽는다. 형식이 하나라도 어긋나면 null. (SQL에 넣기 전에 모양을 엄격하게 확인한다.) */
export function decodeCursor(cursor: string): CursorPosition | null {
  if (cursor.length === 0 || cursor.length > 200 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { c, i } = parsed as { c?: unknown; i?: unknown };
    if (typeof c !== "string" || typeof i !== "string") return null;
    if (!CURSOR_TS.test(c) || !UUID.test(i)) return null;
    // 2026-02-31, 25시 같은 존재하지 않는 시각을 걸러낸다. (밀리초까지만 확인해도 충분하다.)
    const ms = `${c.slice(0, 23)}Z`;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime()) || date.toISOString() !== ms) return null;
    return { createdAt: c, id: i.toLowerCase() };
  } catch {
    return null;
  }
}

/** 목록 쿼리(limit, cursor)를 검증한다. 둘 다 선택이고, 있으면 규칙을 지켜야 한다. */
export function parseListQuery(
  params: URLSearchParams,
): ParseResult<{ limit: number; cursor: CursorPosition | null }> {
  const details: ValidationDetail[] = [];

  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    const parsed = limitSchema.safeParse(rawLimit);
    if (parsed.success) limit = parsed.data;
    else details.push(detail("limit", "invalid_limit"));
  }

  let cursor: CursorPosition | null = null;
  const rawCursor = params.get("cursor");
  if (rawCursor !== null) {
    cursor = decodeCursor(rawCursor);
    if (!cursor) details.push(detail("cursor", "invalid_cursor"));
  }

  if (details.length > 0) return { ok: false, details };
  return { ok: true, value: { limit, cursor } };
}

// ---------------------------------------------------------------------------
// 경로의 id
// ---------------------------------------------------------------------------

/** uuid 모양인지 확인한다. 아니면 호출하는 쪽이 DB를 부르지 않고 바로 404를 돌려준다. */
export function isEntryId(id: string): boolean {
  return UUID.test(id);
}
