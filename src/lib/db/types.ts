/**
 * diary.entries 표의 한 행. 열 이름은 DB 그대로(snake_case)다.
 * 마이그레이션: db/migrations/001_create_diary_schema.sql
 *
 * 분석에 실패한 일기는 emotion, emotion_score, empathy_message, model_used가 모두 null이다.
 * (DB의 CHECK 제약이 "모두 있음" 또는 "모두 없음"만 허용한다.)
 *
 * API 응답(camelCase)과의 대응은 docs/API.md의 "일기 객체"를 본다.
 */
export type EntryRow = {
  id: string;
  user_id: string;
  content: string;
  emotion: string | null;
  emotion_score: number | null;
  empathy_message: string | null;
  is_crisis: boolean;
  model_used: string | null;
  created_at: Date;
};
