import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor, isEntryId, parseCreateBody, parseListQuery } from "./validation";

const ID = "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11";
const TS = "2026-11-05T05:12:34.567891Z";

describe("parseCreateBody", () => {
  it("앞뒤 공백을 지운 content만 돌려주고 다른 필드는 버린다", () => {
    const result = parseCreateBody({ content: "  안녕  ", userId: "x", isCrisis: true });
    expect(result).toEqual({ ok: true, value: { content: "안녕" } });
  });

  it("글자 수는 유니코드 문자 기준이다 (이모지 하나 = 1자)", () => {
    expect(parseCreateBody({ content: "👨‍👩‍👧".repeat(1) }).ok).toBe(true);
    expect(parseCreateBody({ content: "😀".repeat(200) }).ok).toBe(true);
    expect(parseCreateBody({ content: "😀".repeat(201) }).ok).toBe(false);
  });

  it("잘못된 입력은 항상 content 필드의 상세 오류 한 건이다", () => {
    for (const body of [undefined, null, 1, "x", [], {}, { content: 1 }, { content: "" }]) {
      const result = parseCreateBody(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.details).toHaveLength(1);
        expect(result.details[0].field).toBe("content");
      }
    }
  });
});

describe("cursor", () => {
  it("만든 cursor를 그대로 읽을 수 있다 (base64url 한 덩어리)", () => {
    const cursor = encodeCursor({ createdAt: TS, id: ID });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ createdAt: TS, id: ID });
  });

  it("id는 소문자로 맞춘다", () => {
    const cursor = encodeCursor({ createdAt: TS, id: ID.toUpperCase() });
    expect(decodeCursor(cursor)?.id).toBe(ID);
  });

  it.each([
    ["빈 문자열", ""],
    ["base64url 문자가 아님", "a b"],
    ["너무 김", "A".repeat(201)],
    ["JSON이 아님", Buffer.from("not json").toString("base64url")],
    ["객체가 아님", Buffer.from("[1,2]").toString("base64url")],
    ["필드 없음", Buffer.from("{}").toString("base64url")],
    ["시각 형식이 다름", encodeCursor({ createdAt: "2026-11-05T05:12:34.567Z", id: ID })],
    ["존재하지 않는 날짜", encodeCursor({ createdAt: "2026-02-31T05:12:34.567000Z", id: ID })],
    ["존재하지 않는 시각", encodeCursor({ createdAt: "2026-11-05T25:12:34.567000Z", id: ID })],
    ["id가 uuid가 아님", encodeCursor({ createdAt: TS, id: "not-a-uuid" })],
  ])("읽을 수 없는 cursor (%s) -> null", (_name, cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });
});

describe("parseListQuery", () => {
  it("아무것도 없으면 limit 20, cursor 없음", () => {
    expect(parseListQuery(new URLSearchParams())).toEqual({ ok: true, value: { limit: 20, cursor: null } });
  });

  it("limit과 cursor를 읽는다", () => {
    const cursor = encodeCursor({ createdAt: TS, id: ID });
    const result = parseListQuery(new URLSearchParams({ limit: "50", cursor }));
    expect(result).toEqual({ ok: true, value: { limit: 50, cursor: { createdAt: TS, id: ID } } });
  });

  it("limit과 cursor가 둘 다 잘못되면 상세 오류가 두 건이다", () => {
    const result = parseListQuery(new URLSearchParams({ limit: "0", cursor: "zzz" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.details.map((d) => d.code)).toEqual(["invalid_limit", "invalid_cursor"]);
  });
});

describe("isEntryId", () => {
  it("uuid 모양만 true", () => {
    expect(isEntryId(ID)).toBe(true);
    expect(isEntryId(ID.toUpperCase())).toBe(true);
    expect(isEntryId("abc")).toBe(false);
    expect(isEntryId(`${ID}x`)).toBe(false);
    expect(isEntryId("")).toBe(false);
  });
});
