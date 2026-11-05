import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getSql } from "@/lib/db";

// 실제 DB에 접속하지 않는다. postgres 클라이언트는 첫 쿼리 때 연결하므로, 만들기만 하는 시험이다.
describe("DB 연결 모듈", () => {
  const saved = process.env.DATABASE_URL;

  beforeEach(() => {
    delete (globalThis as { __diarySql?: unknown }).__diarySql;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
    delete (globalThis as { __diarySql?: unknown }).__diarySql;
  });

  it("DATABASE_URL이 없으면 변수 이름만 알리는 오류를 낸다", () => {
    delete process.env.DATABASE_URL;
    expect(() => getSql()).toThrow("DATABASE_URL");
  });

  it("prepared statement를 끄고(트랜잭션 풀러 호환) 연결을 한 번만 만든다", async () => {
    process.env.DATABASE_URL = "postgres://user:pw@db.example.test:6543/postgres";
    const sql = getSql();
    expect(typeof sql).toBe("function");
    expect(sql.options.prepare).toBe(false);
    expect(getSql()).toBe(sql);
    await sql.end({ timeout: 0 });
  });
});
