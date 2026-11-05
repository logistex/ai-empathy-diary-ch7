/**
 * 일기 입력 검사 — 서버(docs/API.md 5.1)와 같은 규칙을 화면에서도 미리 적용한다.
 * 서버가 최종 판단하므로 이 검사는 사용자에게 빨리 알려 주기 위한 것이다.
 */

export const DIARY_MAX_LENGTH = 200;

export const EMPTY_MESSAGE = "일기를 한 줄 이상 적어 주세요.";
export const TOO_LONG_MESSAGE = `일기는 ${DIARY_MAX_LENGTH}자까지 쓸 수 있어요.`;

/** 글자 수: 유니코드 문자 기준(이모지 하나 = 1자). 서버와 같은 Array.from 방식이다. */
export function countChars(text: string): number {
  return Array.from(text).length;
}

export type DiaryValidation =
  | { ok: true; content: string; length: number }
  | { ok: false; code: "empty" | "too_long"; message: string; length: number };

/**
 * 서버처럼 앞뒤 공백을 지운 값으로 검사한다.
 * 공백·줄바꿈만 있으면 빈 입력, 200자를 넘으면 너무 긺. 글 속의 줄바꿈은 1자로 센다.
 */
export function validateDiaryContent(raw: string): DiaryValidation {
  const content = raw.trim();
  const length = countChars(content);

  if (length === 0) {
    return { ok: false, code: "empty", message: EMPTY_MESSAGE, length };
  }
  if (length > DIARY_MAX_LENGTH) {
    return { ok: false, code: "too_long", message: TOO_LONG_MESSAGE, length };
  }
  return { ok: true, content, length };
}
