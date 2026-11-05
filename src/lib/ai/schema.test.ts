import { describe, expect, it } from "vitest";

import {
  EMPATHY_MAX_CHARS,
  countSentences,
  extractJsonText,
  normalizeEmpathyMessage,
  parseModelOutput,
} from "./schema";

const MESSAGE = "오늘 하루 많이 웃으셨군요. 마음이 한결 가벼워졌겠어요. 그 기분이 오래 이어지면 좋겠어요.";

function json(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    emotion: "기쁨",
    emotionScore: 4,
    empathyMessage: MESSAGE,
    isCrisis: false,
    ...overrides,
  });
}

describe("모델 응답 스키마", () => {
  it("올바른 응답을 통과시킨다", () => {
    const result = parseModelOutput(json());
    expect(result).toEqual({
      ok: true,
      data: { emotion: "기쁨", emotionScore: 4, empathyMessage: MESSAGE, isCrisis: false },
    });
  });

  it("```json 코드 블록으로 감싼 응답을 읽는다", () => {
    expect(parseModelOutput("```json\n" + json() + "\n```").ok).toBe(true);
    expect(parseModelOutput("```\n" + json() + "\n```").ok).toBe(true);
  });

  it("앞뒤에 설명이 붙은 응답에서 JSON을 꺼낸다", () => {
    expect(parseModelOutput("결과는 다음과 같아요.\n" + json() + "\n이상입니다.").ok).toBe(true);
  });

  it("빈 응답은 empty", () => {
    expect(parseModelOutput("")).toEqual({ ok: false, kind: "empty" });
    expect(parseModelOutput("   \n")).toEqual({ ok: false, kind: "empty" });
    expect(parseModelOutput(null)).toEqual({ ok: false, kind: "empty" });
  });

  it("JSON이 아니면 invalid_json", () => {
    expect(parseModelOutput("죄송하지만 도와드릴 수 없어요.")).toEqual({ ok: false, kind: "invalid_json" });
    expect(parseModelOutput("{emotion: 기쁨")).toEqual({ ok: false, kind: "invalid_json" });
  });

  it("감정 이름이 5개 밖이면 schema_mismatch", () => {
    expect(parseModelOutput(json({ emotion: "외로움" }))).toEqual({ ok: false, kind: "schema_mismatch" });
  });

  it.each([0, 6, 2.5, -1, "높음", null])("강도 %j는 schema_mismatch", (score) => {
    expect(parseModelOutput(json({ emotionScore: score }))).toEqual({ ok: false, kind: "schema_mismatch" });
  });

  it("글자로 적은 숫자 강도 \"3\"은 숫자로 받아 준다", () => {
    const result = parseModelOutput(json({ emotionScore: "3" }));
    expect(result.ok && result.data.emotionScore).toBe(3);
  });

  it("앞뒤 공백이 있는 감정 이름은 받아 준다", () => {
    const result = parseModelOutput(json({ emotion: " 불안 " }));
    expect(result.ok && result.data.emotion).toBe("불안");
  });

  it("isCrisis가 없으면 false, \"true\" 문자열은 true로 본다", () => {
    const parsed = JSON.parse(json());
    delete parsed.isCrisis;
    const missing = parseModelOutput(JSON.stringify(parsed));
    expect(missing.ok && missing.data.isCrisis).toBe(false);

    const asString = parseModelOutput(json({ isCrisis: "true" }));
    expect(asString.ok && asString.data.isCrisis).toBe(true);
  });

  it("알 수 없는 키는 무시한다", () => {
    const result = parseModelOutput(json({ reason: "그냥" }));
    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.data)).not.toContain("reason");
  });
});

describe("공감 메시지 기준 (느슨한 하한·상한)", () => {
  it("1문장도, 5~6문장도 버리지 않는다", () => {
    expect(parseModelOutput(json({ empathyMessage: "오늘 정말 수고 많으셨어요." })).ok).toBe(true);
    const five = "수고하셨어요. 힘든 날이었군요. 마음이 무거웠겠어요. 쉬어 가도 괜찮아요. 곁에 있을게요.";
    expect(countSentences(five)).toBe(5);
    expect(parseModelOutput(json({ empathyMessage: five })).ok).toBe(true);
  });

  it("마침표 없이 끝나는 메시지도 받아 준다", () => {
    expect(parseModelOutput(json({ empathyMessage: "많이 힘드셨겠어요 오늘은 푹 쉬어요" })).ok).toBe(true);
  });

  it("7문장 이상이면 버린다", () => {
    const seven = Array.from({ length: 7 }, (_, i) => `${i + 1}번째로 마음을 알아주고 싶어요.`).join(" ");
    expect(parseModelOutput(json({ empathyMessage: seven }))).toEqual({ ok: false, kind: "schema_mismatch" });
  });

  it("너무 짧거나 비었으면 버린다", () => {
    expect(parseModelOutput(json({ empathyMessage: "" })).ok).toBe(false);
    expect(parseModelOutput(json({ empathyMessage: "힘내요." })).ok).toBe(false);
  });

  it("상한(400자)을 넘으면 버린다", () => {
    const long = "마음을 알아줘요. ".repeat(60);
    expect(long.length).toBeGreaterThan(EMPATHY_MAX_CHARS);
    expect(parseModelOutput(json({ empathyMessage: long })).ok).toBe(false);
  });

  it("한국어가 없으면 버린다", () => {
    expect(parseModelOutput(json({ empathyMessage: "You did well today, take care of yourself." })).ok).toBe(false);
  });

  it("이모지는 지운 채로 받아 준다", () => {
    const result = parseModelOutput(json({ empathyMessage: "오늘 정말 수고 많으셨어요 😊 푹 쉬어요 ❤️" }));
    expect(result.ok && result.data.empathyMessage).toBe("오늘 정말 수고 많으셨어요 푹 쉬어요");
    expect(normalizeEmpathyMessage("가  나\n다 😀")).toBe("가 나 다");
  });
});

describe("JSON 꺼내기", () => {
  it("코드 블록 안쪽만 꺼낸다", () => {
    expect(extractJsonText("```json\n{\"a\":1}\n```")).toBe("{\"a\":1}");
  });
});
