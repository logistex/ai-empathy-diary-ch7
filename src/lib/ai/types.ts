/**
 * AI 분석 결과 타입 (1단계 "AI 결과 약속").
 *
 * 이 파일은 서버·화면 어디서든 불러도 되도록 순수 타입과 상수만 둔다.
 * (server-only, zod, 환경 변수를 쓰지 않는다. 서버 전용 코드는 index.ts에 있다.)
 *
 * 맞춰야 하는 곳
 *  - DB: db/migrations/001_create_diary_schema.sql 의 CHECK 제약 (감정 5개, 강도 1~5)
 *  - API: docs/API.md 의 일기 객체(Entry). 이름은 emotion, emotionScore, empathyMessage, isCrisis, modelUsed.
 *
 * 2단계에서 AI 응답 JSON을 검증할 zod 스키마는 이 파일이 아니라 `src/lib/ai/schema.ts`에 따로 둔다.
 *  - 모델이 돌려주는 JSON(emotion, emotionScore, empathyMessage, isCrisis)은 이 파일의 결과 타입과 모양이 다르다.
 *    (modelUsed와 status는 모델이 아니라 우리 코드가 채운다.)
 *  - 이 파일을 zod 없이 두면 화면 코드가 타입만 가져다 써도 번들이 커지지 않는다.
 *  - 스키마는 이 파일의 EMOTIONS, EMOTION_SCORES를 가져다 써서 값 목록이 한곳에만 있게 한다.
 */

/** 감정 이름 5개. DB의 entries_emotion_valid CHECK 값과 같아야 한다. (types.test.ts가 확인한다.) */
export const EMOTIONS = ["기쁨", "슬픔", "분노", "불안", "평온"] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 감정 강도 1(약함) ~ 5(강함) 정수. DB의 entries_emotion_score_valid CHECK 값과 같아야 한다. */
export const EMOTION_SCORES = [1, 2, 3, 4, 5] as const;
export type EmotionScore = (typeof EMOTION_SCORES)[number];

/**
 * 분석 성공. 모델 응답을 검증해 통과한 경우다.
 * 네 값(emotion, emotionScore, empathyMessage, modelUsed)은 항상 모두 채워져 있다.
 */
export type AnalysisSuccess = {
  /** docs/API.md 의 analysisStatus 값과 같은 문자열을 쓴다. */
  status: "success";
  emotion: Emotion;
  emotionScore: EmotionScore;
  /** 공감 메시지. 한국어 해요체 2~4문장 (PRD F3). 길이·문장 수 검증은 2단계 schema.ts에서 한다. */
  empathyMessage: string;
  /** 위기 여부 최종값 = 서버 키워드 검사 OR AI 판단. */
  isCrisis: boolean;
  /**
   * 실제로 응답한 모델 이름 (예: 2순위로 넘어갔다면 2순위 모델 이름).
   * 설정 값은 바뀔 수 있으므로 특정 모델 이름의 유니온이 아니라 string으로 둔다.
   */
  modelUsed: string;
};

/**
 * 분석 실패. 두 모델이 모두 실패(시간 초과, HTTP 오류, 빈 응답, JSON 오류, 검증 실패)한 경우다.
 * analyzeDiary는 이때 예외를 던지지 않고 이 값을 돌려준다.
 *
 * 감정·강도·공감 메시지·모델 이름은 아예 없다. (DB에는 네 열 모두 NULL로 저장된다.)
 * 그러나 isCrisis는 반드시 있다. AI를 부르기 전에 돌린 키워드 검사 결과이므로,
 * 두 모델이 모두 실패해도 위기 안내는 동작해야 한다. (PRD F5 완료 조건 4)
 */
export type AnalysisFailure = {
  status: "failed";
  /** 키워드 검사로 정한 위기 여부. */
  isCrisis: boolean;
};

/** analyzeDiary의 반환 타입. `status`로 성공/실패를 구분한다. */
export type AnalysisResult = AnalysisSuccess | AnalysisFailure;
