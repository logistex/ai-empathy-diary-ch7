import type { EntryRecord, NewEntry } from "@/lib/db";
// crisis.ts는 server-only가 아니고 다른 모듈을 불러오지 않는 순수 함수라 route에서 바로 불러도 된다.
import { detectCrisis } from "@/lib/ai/crisis";
import { EMOTIONS, EMOTION_SCORES } from "@/lib/ai/types";
import type { AnalysisResult, Emotion, EmotionScore } from "@/lib/ai/types";

/**
 * DB 행 <-> API 일기 객체 변환 (docs/API.md 2번, 7번 "AI 결과를 일기 객체로 바꾸는 규칙").
 * 응답에는 userId를 담지 않는다.
 */

export type Entry = {
  id: string;
  content: string;
  createdAt: string;
  analysisStatus: "success" | "failed";
  emotion: Emotion | null;
  emotionScore: EmotionScore | null;
  empathyMessage: string | null;
  isCrisis: boolean;
  modelUsed: string | null;
};

/**
 * DB 행을 일기 객체로 바꾼다. analysisStatus는 DB에 따로 두지 않고 emotion이 null인지로 정한다.
 * 넓은 타입(string, number)을 Emotion·EmotionScore로 좁힌다. 값은 DB CHECK 제약이 보장하지만,
 * 혹시 범위 밖 값이 와도 잘못된 값을 화면에 보내지 않도록 분석 실패(null)로 내려 보낸다.
 */
export function toEntry(row: EntryRecord): Entry {
  const emotion = EMOTIONS.find((e) => e === row.emotion) ?? null;
  const emotionScore = EMOTION_SCORES.find((s) => s === row.emotion_score) ?? null;
  const analyzed =
    emotion !== null && emotionScore !== null && row.empathy_message !== null && row.model_used !== null;

  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    analysisStatus: analyzed ? "success" : "failed",
    emotion: analyzed ? emotion : null,
    emotionScore: analyzed ? emotionScore : null,
    empathyMessage: analyzed ? row.empathy_message : null,
    isCrisis: row.is_crisis,
    modelUsed: analyzed ? row.model_used : null,
  };
}

/**
 * 키워드 검사만으로 위기 여부를 정한다. (analyzeDiary를 믿을 수 없을 때의 대체 검사)
 * 검사 함수가 예외를 내면 안전한 쪽(위기 true)으로 본다. 놓치는 것보다 잘못 띄우는 쪽이 낫다.
 * 일기 원문은 기록하지 않는다.
 */
export function fallbackCrisisCheck(content: string): boolean {
  try {
    return detectCrisis(content).isCrisis;
  } catch {
    return true;
  }
}

/**
 * analyzeDiary 결과를 저장할 값으로 바꾼다.
 * - 성공이고 값이 모두 약속대로면 그대로 저장한다. isCrisis는 analyzeDiary가 정한 최종값(키워드 OR AI)이다.
 * - 그 밖의 모든 경우(analyzeDiary 예외로 result가 없음, status "failed", 성공이지만 값이 약속과 다름)는
 *   네 열을 모두 null로 둔 분석 실패로 저장한다. (DB CHECK 제약 위반으로 일기 저장이 막히는 일을 피한다.)
 *   이때 is_crisis는 "결과가 알려 준 isCrisis OR 키워드 대체 검사"로 정한다.
 *   결과가 위기라고 했다면 그 값을 낮추지 않는다. 결과가 없거나 isCrisis가 불리언이 아니어도 위기 안내는 지킨다.
 */
export function toNewEntry(content: string, result: AnalysisResult | null | undefined): NewEntry {
  if (
    result?.status === "success" &&
    typeof result.isCrisis === "boolean" &&
    EMOTIONS.some((e) => e === result.emotion) &&
    EMOTION_SCORES.some((s) => s === result.emotionScore) &&
    typeof result.empathyMessage === "string" &&
    result.empathyMessage.trim().length > 0 &&
    typeof result.modelUsed === "string" &&
    result.modelUsed.trim().length > 0
  ) {
    return {
      content,
      emotion: result.emotion,
      emotionScore: result.emotionScore,
      empathyMessage: result.empathyMessage,
      isCrisis: result.isCrisis,
      modelUsed: result.modelUsed,
    };
  }

  // 분석 실패 경로. 위기 여부는 절대 낮추지 않는다.
  const isCrisis = result?.isCrisis === true || fallbackCrisisCheck(content);
  return { content, emotion: null, emotionScore: null, empathyMessage: null, isCrisis, modelUsed: null };
}
