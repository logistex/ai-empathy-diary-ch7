import type { EntryRecord, NewEntry } from "@/lib/db";
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
 * analyzeDiary 결과를 저장할 값으로 바꾼다.
 * - 실패(status "failed")면 네 열을 모두 null로 두고, is_crisis는 결과의 isCrisis를 쓴다.
 * - 성공이라도 값이 약속과 다르면(모르는 감정 이름, 범위 밖 강도, 빈 메시지 등) 분석 실패로 낮춰 저장한다.
 *   DB CHECK 제약 위반으로 일기 저장 자체가 막히는 일을 피하기 위해서다. isCrisis는 그대로 살린다.
 */
export function toNewEntry(content: string, result: AnalysisResult | null | undefined): NewEntry {
  const isCrisis = result?.isCrisis === true;

  if (
    result?.status === "success" &&
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
      isCrisis,
      modelUsed: result.modelUsed,
    };
  }

  return { content, emotion: null, emotionScore: null, empathyMessage: null, isCrisis, modelUsed: null };
}
