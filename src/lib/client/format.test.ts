import { describe, expect, it } from "vitest";

import { formatKoreanDate, formatKoreanTime, koreanDateKey } from "./format";

describe("한국 시간 날짜 표시", () => {
  it("UTC 문자열을 한국 시간(+9시간)의 한국어 형식으로 보여 준다", () => {
    expect(formatKoreanDate("2026-11-05T05:12:34.567Z")).toBe("2026년 11월 5일 목요일");
    expect(formatKoreanTime("2026-11-05T05:12:34.567Z")).toBe("오후 2:12");
  });

  it("UTC로는 전날이어도 한국 시간으로 자정을 넘기면 다음 날로 묶는다", () => {
    expect(koreanDateKey("2026-11-04T15:30:00.000Z")).toBe("2026-11-05");
    expect(koreanDateKey("2026-11-04T14:59:00.000Z")).toBe("2026-11-04");
    expect(formatKoreanTime("2026-11-04T15:30:00.000Z")).toBe("오전 12:30");
  });

  it("잘못된 날짜 문자열이면 빈 문자열을 돌려준다", () => {
    expect(formatKoreanDate("엉터리")).toBe("");
    expect(formatKoreanTime("엉터리")).toBe("");
    expect(koreanDateKey("엉터리")).toBe("");
  });
});
