import "server-only";

import { getSql, type Sql } from "./client";
import type { EntryRow } from "./types";

/**
 * diary.entries 데이터 접근 계층 (서버 전용).
 *
 * 규칙
 *  - 모든 함수는 첫 인자로 `userId`(세션에서 꺼낸 구글 계정 ID)를 받고, 모든 쿼리에 `user_id = ${userId}` 조건을 건다.
 *    요청 본문·주소로 받은 값은 여기까지 오지 않는다. (호출하는 쪽인 API 핸들러가 세션 값만 넘긴다.)
 *  - 값은 전부 템플릿 `${}` 매개변수 바인딩으로 넣는다. 문자열을 이어 붙이거나 sql.unsafe를 쓰지 않는다.
 *  - 표 이름에는 항상 `diary.` 접두어를 붙인다.
 *  - 쿼리 오류 메시지에는 일기 원문이 들어갈 수 있으므로(CHECK 위반의 "Failing row"), 여기서 오류를 가공하지 않고
 *    위로 던진다. 로그에 남기는 쪽(API 핸들러)이 이름과 코드만 기록한다.
 *  - 테스트에서 가짜 `sql`을 넣을 수 있도록 마지막 인자로 받는다. 생략하면 공유 연결을 쓴다.
 */

/** API에 내보내는 열만 가진 행. user_id는 응답에 넣지 않으므로 가져오지 않는다. */
export type EntryRecord = Omit<EntryRow, "user_id">;

/** 목록 행. cursor_ts는 cursor를 만들기 위한 마이크로초 정밀도의 UTC 시각 문자열이다. */
export type EntryListRecord = EntryRecord & { cursor_ts: string };

/** 저장할 일기. 분석 결과 4개는 모두 값이 있거나 모두 null이어야 한다. (DB CHECK 제약) */
export type NewEntry = {
  content: string;
  emotion: string | null;
  emotionScore: number | null;
  empathyMessage: string | null;
  isCrisis: boolean;
  modelUsed: string | null;
};

/** 목록 조회에서 "이 위치 다음부터"를 가리키는 기준. 직전 페이지 마지막 항목의 값이다. */
export type ListPosition = {
  /** 마이크로초 정밀도 UTC 시각 (예: 2026-11-05T05:12:34.567891Z) */
  createdAt: string;
  id: string;
};

/** 일기를 저장하고 저장된 행을 돌려준다. user_id는 인자로 받은 세션 값이다. */
export async function insertEntry(
  userId: string,
  entry: NewEntry,
  sql: Sql = getSql(),
): Promise<EntryRecord> {
  const rows = await sql<EntryRecord[]>`
    INSERT INTO diary.entries
      (user_id, content, emotion, emotion_score, empathy_message, is_crisis, model_used)
    VALUES
      (${userId}, ${entry.content}, ${entry.emotion}, ${entry.emotionScore},
       ${entry.empathyMessage}, ${entry.isCrisis}, ${entry.modelUsed})
    RETURNING id, content, emotion, emotion_score, empathy_message, is_crisis, model_used, created_at
  `;
  return rows[0];
}

/**
 * 내 일기를 최신순으로 돌려준다. (created_at 내림차순, 같으면 id 내림차순)
 * limit개보다 많이 가져오지 않는다. 다음 페이지가 있는지 알려면 호출하는 쪽이 limit + 1을 요청한다.
 */
export async function listEntries(
  userId: string,
  options: { limit: number; after?: ListPosition },
  sql: Sql = getSql(),
): Promise<EntryListRecord[]> {
  const { limit, after } = options;

  if (!after) {
    return sql<EntryListRecord[]>`
      SELECT id, content, emotion, emotion_score, empathy_message, is_crisis, model_used, created_at,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
      FROM diary.entries
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
  }

  return sql<EntryListRecord[]>`
    SELECT id, content, emotion, emotion_score, empathy_message, is_crisis, model_used, created_at,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
    FROM diary.entries
    WHERE user_id = ${userId}
      AND (created_at, id) < (${after.createdAt}::timestamptz, ${after.id}::uuid)
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `;
}

/** 내 일기 하나. 없거나 남의 일기면 null. (둘을 구분하지 않는다.) */
export async function findEntry(
  userId: string,
  id: string,
  sql: Sql = getSql(),
): Promise<EntryRecord | null> {
  const rows = await sql<EntryRecord[]>`
    SELECT id, content, emotion, emotion_score, empathy_message, is_crisis, model_used, created_at
    FROM diary.entries
    WHERE id = ${id}::uuid AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

/** 내 일기를 실제로 지운다. 지운 id를 돌려주고, 없거나 남의 일기면 null. (남의 일기는 지워지지 않는다.) */
export async function deleteEntry(
  userId: string,
  id: string,
  sql: Sql = getSql(),
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM diary.entries
    WHERE id = ${id}::uuid AND user_id = ${userId}
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}
