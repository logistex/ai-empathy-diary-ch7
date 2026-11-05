import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import { FALLBACK_MODEL, MODEL_CHAIN, PRIMARY_MODEL, REQUEST_TIMEOUT_MS } from "./config";
import {
  EMOTIONS,
  EMOTION_SCORES,
  type AnalysisFailure,
  type AnalysisResult,
  type AnalysisSuccess,
} from "./types";

// DB 마이그레이션 SQL을 글자로 읽어 CHECK 값을 뽑는다. (DB에 접속하지 않는다.)
const sql = readFileSync(
  path.resolve(import.meta.dirname, "../../../db/migrations/001_create_diary_schema.sql"),
  "utf8",
);

describe("AI 타입과 DB CHECK 제약", () => {
  it("감정 상수가 entries_emotion_valid의 값과 같다", () => {
    const match = sql.match(/emotion IN \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const dbEmotions = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...EMOTIONS]).toEqual(dbEmotions);
  });

  it("강도 상수가 entries_emotion_score_valid의 범위(1~5)와 같다", () => {
    const match = sql.match(/emotion_score BETWEEN (\d+) AND (\d+)/);
    expect(match).not.toBeNull();
    const [min, max] = [Number(match![1]), Number(match![2])];
    expect([...EMOTION_SCORES]).toEqual(
      Array.from({ length: max - min + 1 }, (_, i) => min + i),
    );
  });
});

describe("분석 결과 타입", () => {
  it("성공/실패를 status로 구분한다 (판별 유니온)", () => {
    const failed: AnalysisResult = { status: "failed", isCrisis: true };
    if (failed.status === "failed") {
      // 실패 결과에도 키워드 검사로 정한 isCrisis가 담긴다.
      expect(failed.isCrisis).toBe(true);
      expectTypeOf(failed).toEqualTypeOf<AnalysisFailure>();
    }
    const ok = { status: "success" } as AnalysisResult;
    if (ok.status === "success") {
      expectTypeOf(ok).toEqualTypeOf<AnalysisSuccess>();
    }
  });
});

describe("모델 설정", () => {
  it("1순위, 2순위, 대기 시간 20초가 PLAN.md와 같다", () => {
    expect(PRIMARY_MODEL).toBe("nvidia/nemotron-3-ultra-550b-a55b:free");
    expect(FALLBACK_MODEL).toBe("nvidia/nemotron-3.5-super-vl:free");
    expect([...MODEL_CHAIN]).toEqual([PRIMARY_MODEL, FALLBACK_MODEL]);
    expect(REQUEST_TIMEOUT_MS).toBe(20_000);
  });
});
