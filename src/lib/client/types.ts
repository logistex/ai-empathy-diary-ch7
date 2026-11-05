/**
 * 화면에서 쓰는 타입. docs/API.md 의 "일기 객체(Entry)"와 같은 모양이다.
 *
 * 감정 이름·강도 타입은 서버·AI와 같은 값 목록을 쓰려고 `@/lib/ai/types`(순수 타입)에서 가져온다.
 * (@/lib/ai 의 index.ts·config.ts 는 서버 전용이므로 화면에서 불러오지 않는다.)
 */
import type { Emotion, EmotionScore } from "@/lib/ai/types";

export type { Emotion, EmotionScore };

/** 분석 성공 여부. DB에는 따로 저장하지 않고 서버가 emotion 이 null 인지로 정한다. */
export type AnalysisStatus = "success" | "failed";

/** API 일기 객체 (docs/API.md 2번). userId 는 응답에 없다. */
export type Entry = {
  id: string;
  content: string;
  /** ISO 8601 UTC 문자열 */
  createdAt: string;
  analysisStatus: AnalysisStatus;
  emotion: Emotion | null;
  emotionScore: EmotionScore | null;
  empathyMessage: string | null;
  isCrisis: boolean;
  modelUsed: string | null;
};

/** GET /api/entries 응답 (docs/API.md 5.2) */
export type EntryPage = {
  entries: Entry[];
  /** null 이면 마지막 페이지. 값은 화면이 해석하지 않고 그대로 되돌려 보낸다. */
  nextCursor: string | null;
};

export type ListEntriesOptions = {
  /** 이전 응답의 nextCursor. 첫 페이지는 생략한다. */
  cursor?: string | null;
  /** 1~50. 생략하면 서버 기본값(20). */
  limit?: number;
};

/** 일기 API 호출 함수 묶음. 진짜 fetch 구현과 mock 구현이 같은 모양을 따른다. */
export type EntriesApi = {
  /** POST /api/entries — 저장하고 분석 결과까지 받는다. AI 분석이 실패해도 일기는 저장된다. */
  createEntry(content: string): Promise<Entry>;
  /** GET /api/entries — 내 일기 목록(최신순, cursor 페이지 나눔) */
  listEntries(options?: ListEntriesOptions): Promise<EntryPage>;
  /** GET /api/entries/[id] — 내 일기 하나 */
  getEntry(id: string): Promise<Entry>;
  /** DELETE /api/entries/[id] — 내 일기 삭제(복구 불가) */
  deleteEntry(id: string): Promise<void>;
};
