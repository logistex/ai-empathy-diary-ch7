import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkMigrationSql } from "./guard.mjs";

describe("마이그레이션 안전 검사", () => {
  it("001 마이그레이션 SQL은 통과한다", () => {
    const sql = readFileSync(path.join(import.meta.dirname, "migrations", "001_create_diary_schema.sql"), "utf8");
    expect(checkMigrationSql(sql)).toEqual([]);
  });

  it("diary 스키마 안의 표·색인·수정은 통과한다", () => {
    const sql = `
      CREATE SCHEMA IF NOT EXISTS diary;
      CREATE TABLE IF NOT EXISTS diary.notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      ALTER TABLE diary.notes ADD COLUMN IF NOT EXISTS memo text;
      CREATE INDEX IF NOT EXISTS notes_memo_idx ON diary.notes (memo);
    `;
    expect(checkMigrationSql(sql)).toEqual([]);
  });

  it("public 등 다른 스키마를 쓰면 막는다", () => {
    expect(checkMigrationSql("CREATE TABLE public.entries (id int);")).not.toEqual([]);
    expect(checkMigrationSql("SELECT * FROM auth.users;")).not.toEqual([]);
    expect(checkMigrationSql('ALTER TABLE "public"."x" ADD COLUMN a int;')).not.toEqual([]);
  });

  it("스키마 접두어가 없는 표 생성·수정은 막는다", () => {
    expect(checkMigrationSql("CREATE TABLE entries (id int);")).not.toEqual([]);
    expect(checkMigrationSql("ALTER TABLE entries ADD COLUMN a int;")).not.toEqual([]);
    expect(checkMigrationSql("CREATE INDEX i ON entries (id);")).not.toEqual([]);
    expect(checkMigrationSql("DELETE FROM entries;")).not.toEqual([]);
  });

  it("DROP, 확장 설치, search_path 변경 등은 막는다", () => {
    expect(checkMigrationSql("DROP TABLE diary.entries;")).not.toEqual([]);
    expect(checkMigrationSql("DROP SCHEMA diary CASCADE;")).not.toEqual([]);
    expect(checkMigrationSql("CREATE EXTENSION pgcrypto;")).not.toEqual([]);
    expect(checkMigrationSql("TRUNCATE diary.entries;")).not.toEqual([]);
    expect(checkMigrationSql("SET search_path TO public;")).not.toEqual([]);
    expect(checkMigrationSql("GRANT ALL ON diary.entries TO anon;")).not.toEqual([]);
    expect(checkMigrationSql("CREATE SCHEMA other;")).not.toEqual([]);
  });

  it("주석이나 문자열 안의 단어는 검사하지 않는다", () => {
    const sql = `
      -- drop table public.x; (주석)
      /* create extension foo; */
      CREATE TABLE IF NOT EXISTS diary.t (a text DEFAULT 'drop public.x');
    `;
    expect(checkMigrationSql(sql)).toEqual([]);
  });
});
