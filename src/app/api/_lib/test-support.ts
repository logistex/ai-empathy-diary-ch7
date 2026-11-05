/**
 * API 테스트 전용 도우미 (실행 코드에서는 불러오지 않는다).
 * 실제 DB 대신 메모리에 일기를 담는 가짜 데이터 접근 계층이다.
 * 진짜 SQL과 같은 규칙을 흉내 낸다: user_id 조건, created_at/id 내림차순, (시각, id) 위치 이후만 조회.
 */
import { vi } from "vitest";

import type { EntryListRecord, EntryRecord, ListPosition, NewEntry } from "@/lib/db";

export type StoredRow = EntryRecord & { user_id: string };

let counter = 0;

function fakeUuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

function cursorTs(date: Date): string {
  // 밀리초 뒤에 마이크로초 자리 "000"을 붙여 DB의 to_char 결과와 같은 모양으로 만든다.
  return date.toISOString().replace("Z", "000Z");
}

function compareDesc(a: StoredRow, b: StoredRow): number {
  const t = cursorTs(b.created_at).localeCompare(cursorTs(a.created_at));
  return t !== 0 ? t : b.id.localeCompare(a.id);
}

export function createFakeDb() {
  const rows: StoredRow[] = [];
  let clock = Date.parse("2026-11-05T00:00:00.000Z");

  const db = {
    rows,

    /** 시험용으로 행을 직접 넣는다. 지정하지 않은 값은 분석 성공 일기의 기본값이다. */
    seed(partial: Partial<StoredRow> & { user_id: string }): StoredRow {
      clock += 1000;
      const row: StoredRow = {
        id: fakeUuid(),
        content: "시험용 일기",
        emotion: "평온",
        emotion_score: 3,
        empathy_message: "시험용 공감 메시지예요.",
        is_crisis: false,
        model_used: "test-model",
        created_at: new Date(clock),
        ...partial,
      };
      rows.push(row);
      return row;
    },

    reset() {
      rows.length = 0;
      counter = 0;
      clock = Date.parse("2026-11-05T00:00:00.000Z");
      db.insertEntry.mockClear();
      db.listEntries.mockClear();
      db.findEntry.mockClear();
      db.deleteEntry.mockClear();
    },

    insertEntry: vi.fn(async (userId: string, entry: NewEntry): Promise<EntryRecord> => {
      clock += 1000;
      const row: StoredRow = {
        id: fakeUuid(),
        user_id: userId,
        content: entry.content,
        emotion: entry.emotion,
        emotion_score: entry.emotionScore,
        empathy_message: entry.empathyMessage,
        is_crisis: entry.isCrisis,
        model_used: entry.modelUsed,
        created_at: new Date(clock),
      };
      rows.push(row);
      return toRecord(row);
    }),

    listEntries: vi.fn(
      async (
        userId: string,
        options: { limit: number; after?: ListPosition },
      ): Promise<EntryListRecord[]> => {
        const { limit, after } = options;
        return rows
          .filter((r) => r.user_id === userId)
          .filter(
            (r) =>
              !after ||
              cursorTs(r.created_at) < after.createdAt ||
              (cursorTs(r.created_at) === after.createdAt && r.id < after.id),
          )
          .sort(compareDesc)
          .slice(0, limit)
          .map((r) => ({ ...toRecord(r), cursor_ts: cursorTs(r.created_at) }));
      },
    ),

    findEntry: vi.fn(async (userId: string, id: string): Promise<EntryRecord | null> => {
      const row = rows.find((r) => r.id === id.toLowerCase() && r.user_id === userId);
      return row ? toRecord(row) : null;
    }),

    deleteEntry: vi.fn(async (userId: string, id: string): Promise<string | null> => {
      const index = rows.findIndex((r) => r.id === id.toLowerCase() && r.user_id === userId);
      if (index < 0) return null;
      const [removed] = rows.splice(index, 1);
      return removed.id;
    }),
  };

  return db;
}

/** 테스트 파일마다 하나씩 쓰는 가짜 DB. vi.mock 팩토리와 테스트 본문이 같은 인스턴스를 본다. */
export const fakeDb = createFakeDb();

function toRecord(row: StoredRow): EntryRecord {
  // user_id는 API로 나가는 행에 없다. (실제 SELECT도 user_id를 가져오지 않는다.)
  const record: Partial<StoredRow> = { ...row };
  delete record.user_id;
  return record as EntryRecord;
}

/** 시험용 요청 만들기 */
export function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
