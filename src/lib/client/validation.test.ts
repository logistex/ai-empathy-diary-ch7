import { describe, expect, it } from "vitest";

import {
  DIARY_MAX_LENGTH,
  EMPTY_MESSAGE,
  TOO_LONG_MESSAGE,
  countChars,
  validateDiaryContent,
} from "./validation";

describe("countChars", () => {
  it("이모지 하나를 1자로 센다 (Array.from 기준)", () => {
    expect(countChars("😀")).toBe(1);
    expect(countChars("가나다😀")).toBe(4);
    // 글자 길이(length)로는 2로 세지만 우리는 1로 센다.
    expect("😀".length).toBe(2);
  });

  it("줄바꿈도 1자로 센다", () => {
    expect(countChars("가\n나")).toBe(3);
  });
});

describe("validateDiaryContent", () => {
  it("빈 입력은 막는다", () => {
    const result = validateDiaryContent("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("empty");
      expect(result.message).toBe(EMPTY_MESSAGE);
    }
  });

  it("공백이나 줄바꿈만 있으면 막는다", () => {
    expect(validateDiaryContent("   ").ok).toBe(false);
    expect(validateDiaryContent("\n \n\t").ok).toBe(false);
  });

  it("200자까지는 통과하고 앞뒤 공백은 지운다", () => {
    const result = validateDiaryContent(`  ${"가".repeat(DIARY_MAX_LENGTH)}  `);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.length).toBe(DIARY_MAX_LENGTH);
      expect(result.content).toBe("가".repeat(DIARY_MAX_LENGTH));
    }
  });

  it("201자부터는 막고 이유를 알려 준다", () => {
    const result = validateDiaryContent("가".repeat(DIARY_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("too_long");
      expect(result.message).toBe(TOO_LONG_MESSAGE);
      expect(result.length).toBe(201);
    }
  });

  it("이모지 200개는 통과하고 201개는 막는다", () => {
    expect(validateDiaryContent("😀".repeat(200)).ok).toBe(true);
    expect(validateDiaryContent("😀".repeat(201)).ok).toBe(false);
  });
});
