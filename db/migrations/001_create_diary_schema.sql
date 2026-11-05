-- 001_create_diary_schema.sql
-- AI 공감 다이어리: diary 스키마와 일기 표(diary.entries)를 만든다.
--
-- 규칙
--   * 이 파일은 diary 스키마 안의 객체만 만든다. (public 등 다른 스키마는 건드리지 않는다.)
--   * 모든 객체 이름에 diary. 접두어를 붙인다. search_path에 기대지 않는다.
--   * CREATE EXTENSION을 쓰지 않는다. gen_random_uuid()는 Postgres 13 이상 기본 함수다.
--   * IF NOT EXISTS를 써서 다시 실행해도 안전하다. DROP / TRUNCATE 구문은 없다.
--   * 마이그레이션 적용 기록(diary.schema_migrations)은 db/migrate.mjs가 만든다.

CREATE SCHEMA IF NOT EXISTS diary;

CREATE TABLE IF NOT EXISTS diary.entries (
  -- 일기 하나의 고유 번호
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 구글 계정의 고유 ID (Auth.js JWT의 token.sub). 서버가 세션에서 꺼내 넣는다.
  user_id         text        NOT NULL,

  -- 일기 원문. 서버가 앞뒤 공백을 지운 뒤 1~200자(유니코드 문자 기준)만 저장한다.
  content         text        NOT NULL,

  -- AI 분석 결과. 분석에 실패한 일기는 아래 네 열이 모두 NULL이다.
  emotion         text,       -- 기쁨, 슬픔, 분노, 불안, 평온 중 하나
  emotion_score   smallint,   -- 감정 강도 1(약함) ~ 5(강함)
  empathy_message text,       -- 공감 메시지
  model_used      text,       -- 실제로 응답한 모델 이름

  -- 위기 표현 여부. 서버 키워드 검사 또는 AI 판단 중 하나라도 참이면 true.
  -- 분석에 실패해도 키워드 검사로 true가 될 수 있으므로 NULL을 허용하지 않는다.
  is_crisis       boolean     NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),

  -- 내용: 공백만 있는 글과 200자 초과 글은 DB에서도 막는다. (서버 검증의 안전망)
  CONSTRAINT entries_content_not_blank
    CHECK (content !~ '^\s*$'),
  CONSTRAINT entries_content_max_length
    CHECK (char_length(content) <= 200),

  -- 감정 이름은 5개 중 하나, 강도는 1~5
  CONSTRAINT entries_emotion_valid
    CHECK (emotion IS NULL OR emotion IN ('기쁨', '슬픔', '분노', '불안', '평온')),
  CONSTRAINT entries_emotion_score_valid
    CHECK (emotion_score IS NULL OR emotion_score BETWEEN 1 AND 5),

  -- 분석 결과는 "모두 있음" 또는 "모두 없음(분석 실패)" 둘 중 하나여야 한다.
  CONSTRAINT entries_analysis_all_or_none
    CHECK (
      (emotion IS NOT NULL AND emotion_score IS NOT NULL
        AND empathy_message IS NOT NULL AND model_used IS NOT NULL)
      OR
      (emotion IS NULL AND emotion_score IS NULL
        AND empathy_message IS NULL AND model_used IS NULL)
    )
);

-- 내 일기 목록(최신순, cursor 페이지 나눔) 조회용 색인.
-- id를 끝에 더해 created_at이 같은 일기끼리도 순서가 정해지게 한다.
CREATE INDEX IF NOT EXISTS entries_user_id_created_at_idx
  ON diary.entries (user_id, created_at DESC, id DESC);
