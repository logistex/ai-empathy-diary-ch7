import "server-only";

import { MODEL_CHAIN, OPENROUTER_API_KEY_ENV } from "./config";
import { detectCrisis } from "./crisis";
import { callOpenRouter, type CallFailureKind } from "./openrouter";
import { buildMessages } from "./prompts";
import { parseModelOutput, type ParseFailureKind } from "./schema";
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
 * 실패 이유를 로그에 남긴다.
 * 남기는 것: 모델 이름, 오류 종류, HTTP 상태 코드뿐이다.
 * 남기지 않는 것: 일기 원문, 프롬프트, 모델 응답 원문, API 키, 위기 키워드에 걸린 내용.
 */
function logModelFailure(
  model: string,
  kind: CallFailureKind | ParseFailureKind,
  status?: number,
): void {
  const statusPart = status === undefined ? "" : ` status=${status}`;
  console.warn(`[ai] 모델 호출 실패 model=${model} kind=${kind}${statusPart}`);
}

/**
 * 일기 한 줄을 분석해 감정·강도·공감 메시지·위기 여부를 돌려준다. (서버 전용)
 *
 * 약속
 *  - 예외를 던지지 않는다. 두 모델이 모두 실패하면 `{ status: "failed", isCrisis }`를 돌려준다.
 *  - `isCrisis`는 키워드 검사 OR AI 판단의 최종값이다. 실패 결과에도 키워드 검사 결과가 담긴다.
 *  - 일기 원문과 공감 메시지를 로그에 남기지 않는다.
 *
 * 동작 순서
 *  1. 키워드 검사(crisis.ts)를 AI 호출 전에 실행한다.
 *  2. OPENROUTER_API_KEY가 없으면 호출하지 않고 실패 결과를 돌려준다.
 *  3. MODEL_CHAIN 순서(1순위 -> 2순위)대로 부른다. 아래 중 하나면 다음 모델로 넘어간다.
 *     시간 초과(20초), HTTP 오류(429·5xx 등), 네트워크 오류, 빈 응답, JSON 파싱 실패, 스키마 검증 실패
 *  4. 처음 성공한 모델의 결과를 돌려준다. modelUsed에는 실제로 응답한 모델 이름이 들어간다.
 */
export async function analyzeDiary(content: string): Promise<AnalysisResult> {
  // 1. 키워드 검사. 만에 하나 검사 자체가 예외를 내면 안전한 쪽(위기)으로 본다.
  let keywordCrisis: boolean;
  try {
    keywordCrisis = detectCrisis(content).isCrisis;
  } catch {
    keywordCrisis = true;
  }

  // 2. 키는 서버 환경 변수에서만 읽는다. 값은 어디에도 출력하지 않는다.
  const apiKey = process.env[OPENROUTER_API_KEY_ENV];
  if (!apiKey || apiKey.trim().length === 0) {
    console.warn(`[ai] ${OPENROUTER_API_KEY_ENV}가 설정되지 않아 AI를 호출하지 않아요.`);
    return { status: "failed", isCrisis: keywordCrisis };
  }

  try {
    const messages = buildMessages(content, { keywordCrisis });

    // 3. 모델 전환.
    for (const model of MODEL_CHAIN) {
      const called = await callOpenRouter({ apiKey, model, messages });
      if (!called.ok) {
        logModelFailure(model, called.kind, called.status);
        continue;
      }

      const parsed = parseModelOutput(called.text);
      if (!parsed.ok) {
        logModelFailure(model, parsed.kind);
        continue;
      }

      // 4. 성공. 위기 여부는 키워드 검사 OR AI 판단.
      return {
        status: "success",
        emotion: parsed.data.emotion,
        emotionScore: parsed.data.emotionScore,
        empathyMessage: parsed.data.empathyMessage,
        isCrisis: keywordCrisis || parsed.data.isCrisis,
        modelUsed: model,
      };
    }
  } catch {
    // 예상하지 못한 오류도 밖으로 던지지 않는다. (오류 내용에 요청 정보가 섞일 수 있어 남기지 않는다.)
    console.warn("[ai] 예상하지 못한 오류로 분석을 마치지 못했어요.");
  }

  return { status: "failed", isCrisis: keywordCrisis };
}
