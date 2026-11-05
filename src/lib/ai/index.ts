import "server-only";

import type { AnalysisResult } from "./types";

export type {
  AnalysisFailure,
  AnalysisResult,
  AnalysisSuccess,
  Emotion,
  EmotionScore,
} from "./types";
export { EMOTIONS, EMOTION_SCORES } from "./types";

/**
 * 일기 한 줄을 분석해 감정·강도·공감 메시지·위기 여부를 돌려준다. (서버 전용)
 *
 * 약속
 *  - 예외를 던지지 않는다. 두 모델이 모두 실패하면 `{ status: "failed", isCrisis }`를 돌려준다.
 *  - `isCrisis`는 키워드 검사 OR AI 판단의 최종값이다. 실패 결과에도 키워드 검사 결과가 담긴다.
 *  - 일기 원문과 공감 메시지를 로그에 남기지 않는다.
 *
 * !!! 임시 값(stub) !!!
 * 지금은 1단계 뼈대라서 content와 상관없이 항상 같은 "임시 값"을 돌려준다.
 * OpenRouter를 호출하지 않고, 위기 키워드 검사도 하지 않는다. (isCrisis는 항상 false)
 * 실제 구현(OpenRouter 호출, 모델 전환, 프롬프트, 위기 감지)은 2단계(2-B)에서 이 함수 안을 채운다.
 * 함수 이름과 반환 타입은 약속이므로 바꾸지 않는다.
 * 3단계 전에 이 임시 값이 실제 DB에 저장되지 않도록 modelUsed에 "stub"이라고 분명히 적어 둔다.
 */
export async function analyzeDiary(content: string): Promise<AnalysisResult> {
  // 임시 값: 2단계 전까지 content를 쓰지 않는다.
  void content;

  // 임시 값(stub): 실제 AI 분석 결과가 아니다. 타입(AnalysisSuccess)만 만족한다.
  return {
    status: "success",
    emotion: "평온",
    emotionScore: 3,
    empathyMessage:
      "(임시 값) 오늘의 마음을 한 줄로 남겨 주셨군요. 이 문장은 실제 AI가 만든 것이 아니에요. 곧 진짜 공감 메시지로 바뀔 거예요.",
    isCrisis: false,
    modelUsed: "stub (임시 값 - 실제 모델 아님)",
  };
}
