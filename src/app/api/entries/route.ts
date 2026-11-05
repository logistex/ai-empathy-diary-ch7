import { analyzeDiary } from "@/lib/ai";
import type { AnalysisResult } from "@/lib/ai/types";
import { insertEntry, listEntries } from "@/lib/db";

import { toEntry, toNewEntry } from "../_lib/entry";
import {
  internalError,
  jsonResponse,
  logServerError,
  unauthorized,
  validationError,
} from "../_lib/responses";
import { getSessionUserId } from "../_lib/session";
import { encodeCursor, parseCreateBody, parseListQuery, readJsonBody } from "../_lib/validation";

/**
 * /api/entries — 일기 저장(POST), 내 일기 목록(GET). 약속: docs/API.md 5.1, 5.2
 * 처리 순서: 로그인 확인(401) -> 입력 검증(400) -> 처리(500).
 */

// 분석(AI 두 모델, 모델마다 최대 약 20초)까지 한 요청에서 하므로 함수 실행 시간을 넉넉히 잡는다. (Vercel)
export const maxDuration = 60;

/** 일기 저장 + 분석 결과까지 돌려준다. */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    // 본문은 글자로 읽어 크기를 확인한 뒤 JSON으로 푼다. (크거나 JSON이 아니면 400)
    const json = await readJsonBody(request);
    if (!json.ok) return validationError(json.details);

    // 본문에 userId 같은 다른 필드가 있어도 parseCreateBody가 버린다. content만 쓴다.
    const body = parseCreateBody(json.value);
    if (!body.ok) return validationError(body.details);
    const { content } = body.value;

    // analyzeDiary는 예외를 던지지 않는 약속이지만, 던져도 일기 저장이 막히지 않게 분석 실패로 다룬다.
    // 오류 내용은 일기 원문이 들어갈 수 있어 이름만 기록한다.
    let analysis: AnalysisResult | null = null;
    try {
      analysis = await analyzeDiary(content);
    } catch (error) {
      logServerError("POST /api/entries 분석", error);
    }

    const row = await insertEntry(userId, toNewEntry(content, analysis));
    return jsonResponse({ entry: toEntry(row) }, 201);
  } catch (error) {
    logServerError("POST /api/entries", error);
    return internalError();
  }
}

/** 내 일기 목록 (최신순, cursor 페이지 나눔). */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const query = parseListQuery(new URL(request.url).searchParams);
    if (!query.ok) return validationError(query.details);
    const { limit, cursor } = query.value;

    // 다음 페이지가 있는지 알기 위해 한 개 더 가져온다.
    const rows = await listEntries(userId, {
      limit: limit + 1,
      after: cursor ? { createdAt: cursor.createdAt, id: cursor.id } : undefined,
    });

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last ? encodeCursor({ createdAt: last.cursor_ts, id: last.id }) : null;

    return jsonResponse({ entries: page.map(toEntry), nextCursor });
  } catch (error) {
    logServerError("GET /api/entries", error);
    return internalError();
  }
}
