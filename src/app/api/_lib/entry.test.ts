import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectCrisis } from "@/lib/ai/crisis";
import type { AnalysisResult } from "@/lib/ai/types";

import { fallbackCrisisCheck, toNewEntry } from "./entry";

// 진짜 키워드 검사를 쓰되, 시험에서 예외를 내게 바꿀 수 있도록 감싼다.
vi.mock("@/lib/ai/crisis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/crisis")>();
  return { ...actual, detectCrisis: vi.fn(actual.detectCrisis) };
});

const mockDetect = vi.mocked(detectCrisis);

const CRISIS_TEXT = "요즘 정말 죽고 싶다는 생각이 들어요.";
const PLAIN_TEXT = "오늘은 점심이 맛있었다.";

const SUCCESS: AnalysisResult = {
  status: "success",
  emotion: "슬픔",
  emotionScore: 4,
  empathyMessage: "많이 힘드셨군요. 곁에 있을게요.",
  isCrisis: false,
  modelUsed: "test-model",
};

beforeEach(() => {
  mockDetect.mockClear();
});

describe("fallbackCrisisCheck", () => {
  it("위기 표현이 있으면 true, 평범한 문장이면 false", () => {
    expect(fallbackCrisisCheck(CRISIS_TEXT)).toBe(true);
    expect(fallbackCrisisCheck(PLAIN_TEXT)).toBe(false);
  });

  it("키워드 검사가 예외를 내면 안전한 쪽(true)으로 본다", () => {
    mockDetect.mockImplementationOnce(() => {
      throw new Error("검사 오류");
    });
    expect(fallbackCrisisCheck(PLAIN_TEXT)).toBe(true);
  });
});

describe("toNewEntry — 위기 여부 지키기", () => {
  it("결과가 없어도(analyzeDiary 예외) 위기 문장이면 isCrisis true, 분석 열은 null", () => {
    expect(toNewEntry(CRISIS_TEXT, null)).toEqual({
      content: CRISIS_TEXT,
      emotion: null,
      emotionScore: null,
      empathyMessage: null,
      isCrisis: true,
      modelUsed: null,
    });
  });

  it("결과가 없고 평범한 문장이면 isCrisis false", () => {
    expect(toNewEntry(PLAIN_TEXT, null).isCrisis).toBe(false);
    expect(toNewEntry(PLAIN_TEXT, undefined).isCrisis).toBe(false);
  });

  it("결과가 없고 키워드 검사도 예외를 내면 isCrisis true", () => {
    mockDetect.mockImplementationOnce(() => {
      throw new Error("검사 오류");
    });
    expect(toNewEntry(PLAIN_TEXT, null).isCrisis).toBe(true);
  });

  it("status failed에서 isCrisis가 false여도 위기 문장이면 true로 다시 정한다", () => {
    expect(toNewEntry(CRISIS_TEXT, { status: "failed", isCrisis: false }).isCrisis).toBe(true);
  });

  it("status failed에서 isCrisis가 true면 평범한 문장이어도 낮추지 않는다", () => {
    expect(toNewEntry(PLAIN_TEXT, { status: "failed", isCrisis: true }).isCrisis).toBe(true);
  });

  it("성공이지만 값이 약속과 달라 실패로 낮출 때도 위기 문장이면 true", () => {
    const broken = { ...SUCCESS, emotion: "외로움", isCrisis: false } as unknown as AnalysisResult;
    const saved = toNewEntry(CRISIS_TEXT, broken);
    expect(saved.isCrisis).toBe(true);
    expect([saved.emotion, saved.emotionScore, saved.empathyMessage, saved.modelUsed]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("성공이지만 isCrisis가 불리언이 아니면 실패로 낮추고 키워드 검사로 정한다", () => {
    const broken = { ...SUCCESS, isCrisis: undefined } as unknown as AnalysisResult;
    expect(toNewEntry(CRISIS_TEXT, broken)).toMatchObject({ isCrisis: true, emotion: null });
    expect(toNewEntry(PLAIN_TEXT, broken)).toMatchObject({ isCrisis: false, emotion: null });
  });

  it("성공이지만 값이 약속과 달라 낮출 때 결과의 isCrisis true는 유지한다", () => {
    const broken = { ...SUCCESS, emotionScore: 9, isCrisis: true } as unknown as AnalysisResult;
    expect(toNewEntry(PLAIN_TEXT, broken).isCrisis).toBe(true);
  });

  it("정상 성공 결과는 그대로 저장하고 대체 검사를 부르지 않는다", () => {
    const saved = toNewEntry(CRISIS_TEXT, { ...SUCCESS, isCrisis: true });
    expect(saved).toMatchObject({ emotion: "슬픔", emotionScore: 4, isCrisis: true, modelUsed: "test-model" });
    expect(mockDetect).not.toHaveBeenCalled();
  });
});
