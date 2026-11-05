/**
 * 모델 응답 JSON의 검증 스키마 (zod).
 *
 * 모델이 돌려주는 JSON은 { emotion, emotionScore, empathyMessage, isCrisis } 네 개다.
 * (modelUsed와 status는 모델이 아니라 index.ts가 채운다. types.ts 주석 참고)
 * 값 목록(감정 5개, 강도 1~5)은 types.ts의 상수를 그대로 써서 한곳에서만 관리한다.
 *
 * 이 파일은 서버·테스트에서만 쓴다. (화면 코드에서 불러오지 않는다.)
 */
import { z } from "zod";

import { EMOTIONS, EMOTION_SCORES } from "./types";

// ---------------------------------------------------------------------------
// 공감 메시지 기준
// ---------------------------------------------------------------------------
//
// PRD F3의 기준은 "해요체 2~4문장, 전체 약 200자 이내"이다.
// 이 기준은 "프롬프트의 목표"로 쓰고(prompts.ts), 여기 검증은 "버릴 응답을 가르는 하한과 상한"으로
// 일부러 느슨하게 잡았다. 이유:
//  1. 검증에 걸리면 응답 하나를 통째로 버리고 2순위 모델을 부르거나, 둘 다 실패해 기본 위로 문구가 나간다.
//     문장이 한 개 모자라거나 한 개 많다는 이유로 멀쩡한 공감 메시지를 버리는 것은 사용자에게 손해다.
//  2. 한국어 문장 수 세기는 정확하지 않다. ("3.5kg", "ㅎㅎ", 마침표 없이 끝나는 문장, 말줄임표)
//     정확하지 않은 계산으로 엄격하게 거르면 잘못 버리는 일이 생긴다.
//  3. 반대로 "일기보다 훨씬 긴 글", "한국어가 아닌 글", "빈 글"은 서비스 품질을 해치므로 막는다.

/** 공감 메시지 최소 글자 수. 이보다 짧으면 공감이라 보기 어렵다. */
export const EMPATHY_MIN_CHARS = 10;
/** 공감 메시지 최대 글자 수. PRD 기준(약 200자)의 두 배. 프롬프트에서는 200자 이내를 요구한다. */
export const EMPATHY_MAX_CHARS = 400;
/** 문장 수 하한. PRD는 2문장이지만 1문장짜리도 버리지 않는다. */
export const EMPATHY_MIN_SENTENCES = 1;
/** 문장 수 상한. PRD는 4문장이지만 5~6문장까지는 받는다. */
export const EMPATHY_MAX_SENTENCES = 6;

// 이모지: 정규식 리터럴 대신 문자열로 만든다. (tsconfig target이 ES2017이라 유니코드 속성 이스케이프를 리터럴로 쓸 수 없다.)
const EMOJI_PATTERN = new RegExp("[\\p{Extended_Pictographic}\\u200D\\uFE0F\\u20E3]", "gu");
const HANGUL_PATTERN = new RegExp("[\\uAC00-\\uD7A3]");

/** 문장 끝으로 보는 기호. 마침표가 없는 응답도 있으므로 개수 계산에만 쓴다. */
const SENTENCE_END_PATTERN = /[.!?。！？…]+/;

/** 공감 메시지에서 문장 수를 대략 센다. (정확한 값이 아니라 상·하한 검사용 근사치) */
export function countSentences(text: string): number {
  return text.split(SENTENCE_END_PATTERN).filter((part) => part.trim().length > 0).length;
}

/**
 * 공감 메시지 정리: 이모지를 지우고 공백을 한 칸으로 줄인 뒤 앞뒤를 자른다.
 * PRD F3은 이모지를 쓰지 않는다고 했다. 이모지 때문에 응답을 버리지 않고, 지운 채로 쓴다.
 */
export function normalizeEmpathyMessage(text: string): string {
  return text.replace(EMOJI_PATTERN, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// 필드별 스키마
// ---------------------------------------------------------------------------

/** 문자열이면 앞뒤 공백을 자른다. (모델이 " 불안 " 처럼 돌려주는 경우 대비) */
const trimString = (value: unknown) => (typeof value === "string" ? value.trim() : value);

/** "3" 처럼 숫자를 문자열로 준 경우를 숫자로 바꾼다. 그 밖의 값은 그대로 두어 검증에서 걸리게 한다. */
const numberLike = (value: unknown) => {
  if (typeof value === "string" && /^\s*\d+(\.0+)?\s*$/.test(value)) return Number(value);
  return value;
};

/** "true"/"false" 문자열을 boolean으로 바꾼다. 값이 아예 없으면 false로 본다. */
const booleanLike = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return value;
};

export const emotionSchema = z.preprocess(trimString, z.enum(EMOTIONS));

export const emotionScoreSchema = z.preprocess(numberLike, z.literal(EMOTION_SCORES));

export const empathyMessageSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeEmpathyMessage(value) : value),
  z
    .string()
    .min(EMPATHY_MIN_CHARS)
    .max(EMPATHY_MAX_CHARS)
    .refine((text) => HANGUL_PATTERN.test(text), { message: "한국어 글자가 없어요." })
    .refine(
      (text) => {
        const count = countSentences(text);
        return count >= EMPATHY_MIN_SENTENCES && count <= EMPATHY_MAX_SENTENCES;
      },
      { message: "문장 수가 기준을 벗어났어요." },
    ),
);

/**
 * 모델 응답 JSON 전체의 스키마.
 *  - 정해진 네 키 말고 다른 키가 와도 무시한다(zod 기본 동작). 모델이 "reason" 같은 키를 덧붙여도 버리지 않는다.
 *  - isCrisis가 없으면 false로 본다. 위기 여부는 서버 키워드 검사와 OR로 합치므로,
 *    이 필드가 빠졌다는 이유만으로 공감 메시지를 버리지 않는다.
 */
export const modelAnalysisSchema = z.object({
  emotion: emotionSchema,
  emotionScore: emotionScoreSchema,
  empathyMessage: empathyMessageSchema,
  isCrisis: z.preprocess(booleanLike, z.boolean()),
});

/** 검증을 통과한 모델 응답. */
export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>;

// ---------------------------------------------------------------------------
// 응답 문자열 -> 검증된 값
// ---------------------------------------------------------------------------

/** 실패 종류. 로그에는 이 값만 남긴다. (응답 원문은 남기지 않는다.) */
export type ParseFailureKind = "empty" | "invalid_json" | "schema_mismatch";

export type ParseResult =
  | { ok: true; data: ModelAnalysis }
  | { ok: false; kind: ParseFailureKind };

/**
 * 모델이 돌려준 글에서 JSON 객체 문자열을 꺼낸다.
 *  1. 그대로 JSON이면 그대로 쓴다.
 *  2. ```json ... ``` 코드 블록으로 감쌌으면 안쪽을 쓴다.
 *  3. 앞뒤에 설명이 붙었으면 첫 "{"부터 마지막 "}"까지를 쓴다.
 */
export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

/** 모델이 돌려준 글을 읽어 검증한다. 예외를 던지지 않는다. */
export function parseModelOutput(text: string | null | undefined): ParseResult {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, kind: "empty" };
  }

  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(text));
  } catch {
    return { ok: false, kind: "invalid_json" };
  }

  const parsed = modelAnalysisSchema.safeParse(json);
  if (!parsed.success) return { ok: false, kind: "schema_mismatch" };
  return { ok: true, data: parsed.data };
}
