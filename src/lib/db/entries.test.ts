import { describe, expect, it, vi } from "vitest";

import { deleteEntry, findEntry, insertEntry, listEntries } from "./entries";
import type { Sql } from "./client";

/**
 * 가짜 sql 템플릿 함수로 "어떤 SQL이 어떤 값과 함께 나가는지"를 확인한다. (실제 DB 접속 없음)
 * 템플릿의 문자열 조각은 SQL 본문, ${} 자리는 매개변수($1, $2, ...)로 바뀐다.
 */
function fakeSql(result: unknown[] = []) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const fn = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
    calls.push({ text: text.replace(/\s+/g, " ").trim(), values });
    return result;
  });
  return { sql: fn as unknown as Sql, calls };
}

const USER = "google-sub-123";
const EVIL = "x'; DROP TABLE diary.entries; --";
const ID = "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11";

describe("diary.entries 쿼리", () => {
  it("insertEntry: 값은 모두 매개변수이고 user_id는 인자로 받은 세션 값이다", async () => {
    const { sql, calls } = fakeSql([{ id: ID }]);
    await insertEntry(
      USER,
      {
        content: EVIL,
        emotion: null,
        emotionScore: null,
        empathyMessage: null,
        isCrisis: true,
        modelUsed: null,
      },
      sql,
    );

    const { text, values } = calls[0];
    expect(text).toContain("INSERT INTO diary.entries");
    expect(values).toEqual([USER, EVIL, null, null, null, true, null]);
    expect(text).not.toContain("DROP TABLE");
    expect(text).not.toContain(USER);
    // 응답으로 돌려받는 열에 user_id는 없다.
    expect(text.split("RETURNING")[1]).not.toContain("user_id");
  });

  it("listEntries(첫 페이지): user_id 조건과 정렬·limit이 매개변수로 붙는다", async () => {
    const { sql, calls } = fakeSql();
    await listEntries(USER, { limit: 21 }, sql);

    const { text, values } = calls[0];
    expect(text).toContain("FROM diary.entries");
    expect(text).toContain("WHERE user_id = $1");
    expect(text).toContain("ORDER BY created_at DESC, id DESC");
    expect(text).toContain("LIMIT $2");
    expect(values).toEqual([USER, 21]);
  });

  it("listEntries(다음 페이지): 위치 비교도 user_id 조건과 함께, 모두 매개변수로 들어간다", async () => {
    const { sql, calls } = fakeSql();
    await listEntries(USER, { limit: 3, after: { createdAt: "2026-11-05T05:12:34.567891Z", id: ID } }, sql);

    const { text, values } = calls[0];
    expect(text).toContain("WHERE user_id = $1");
    expect(text).toContain("(created_at, id) < ($2::timestamptz, $3::uuid)");
    expect(values).toEqual([USER, "2026-11-05T05:12:34.567891Z", ID, 3]);
    expect(text).not.toContain("2026-11-05");
  });

  it("findEntry: id와 user_id를 함께 건다. 없으면 null", async () => {
    const { sql, calls } = fakeSql([]);
    const row = await findEntry(USER, ID, sql);

    expect(row).toBeNull();
    expect(calls[0].text).toContain("FROM diary.entries");
    expect(calls[0].text).toContain("WHERE id = $1::uuid AND user_id = $2");
    expect(calls[0].values).toEqual([ID, USER]);
  });

  it("deleteEntry: DELETE에도 id와 user_id를 함께 건다. 지운 행이 없으면 null", async () => {
    const none = fakeSql([]);
    expect(await deleteEntry(USER, ID, none.sql)).toBeNull();
    expect(none.calls[0].text).toContain("DELETE FROM diary.entries");
    expect(none.calls[0].text).toContain("WHERE id = $1::uuid AND user_id = $2");
    expect(none.calls[0].values).toEqual([ID, USER]);

    const one = fakeSql([{ id: ID }]);
    expect(await deleteEntry(USER, ID, one.sql)).toBe(ID);
  });

  it("모든 쿼리는 diary. 접두어를 쓰고 다른 스키마를 가리키지 않는다", async () => {
    const { sql, calls } = fakeSql([]);
    await insertEntry(
      USER,
      { content: "a", emotion: null, emotionScore: null, empathyMessage: null, isCrisis: false, modelUsed: null },
      sql,
    );
    await listEntries(USER, { limit: 1 }, sql);
    await listEntries(USER, { limit: 1, after: { createdAt: "2026-11-05T05:12:34.567891Z", id: ID } }, sql);
    await findEntry(USER, ID, sql);
    await deleteEntry(USER, ID, sql);

    expect(calls).toHaveLength(5);
    for (const { text } of calls) {
      expect(text).toMatch(/diary\.entries/);
      expect(text).not.toMatch(/\b(public|auth)\./i);
      // 표 이름 앞에는 항상 diary. 가 붙는다.
      expect(text.match(/\b(FROM|INTO)\s+(\S+)/g)?.every((m) => m.endsWith("diary.entries"))).toBe(true);
    }
  });
});
