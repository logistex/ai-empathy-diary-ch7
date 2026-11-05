// 마이그레이션 실행 스크립트: npm run db:migrate
//
// 동작
//   1. db/migrations/*.sql 을 파일 이름순으로 읽는다.
//   2. 각 파일의 SQL을 db/guard.mjs 로 검사한다. (diary 밖 객체, DROP, 확장 설치 등이 있으면 실행하지 않는다.)
//   3. diary.schema_migrations 에 없는 파일만 트랜잭션 하나로 실행하고, 적용 기록을 같은 트랜잭션에 남긴다.
//
// 이 스크립트가 만드는 객체는 diary 스키마 안(diary.schema_migrations)과 마이그레이션 파일이 만드는 것뿐이다.
// DATABASE_URL은 process.env로만 읽고 출력하지 않는다.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSql, describeError, ScriptError } from "./connect.mjs";
import { checkMigrationSql } from "./guard.mjs";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

// 동시에 두 번 실행되어도 겹치지 않게 하는 잠금 번호 (임의의 고정 숫자)
const LOCK_KEY = 7_330_501;

async function loadMigrations() {
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const migrations = [];
  for (const name of names) {
    const sqlText = await readFile(path.join(migrationsDir, name), "utf8");
    const problems = checkMigrationSql(sqlText);
    if (problems.length > 0) {
      throw new ScriptError(
        `${name} 에 안전 검사에 걸린 구문이 있어 실행하지 않았습니다:\n  - ${problems.join("\n  - ")}`,
      );
    }
    migrations.push({
      version: name.replace(/\.sql$/, ""),
      sqlText,
      checksum: createHash("sha256").update(sqlText).digest("hex"),
    });
  }
  return migrations;
}

async function main() {
  // DB에 접속하기 전에 모든 파일을 먼저 검사한다.
  const migrations = await loadMigrations();
  if (migrations.length === 0) {
    console.log("적용할 마이그레이션 파일이 없습니다.");
    return;
  }

  const sql = createSql();
  try {
    // 적용 기록 표는 diary 스키마 안에 둔다.
    await sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS diary;
      CREATE TABLE IF NOT EXISTS diary.schema_migrations (
        version    text        PRIMARY KEY,
        checksum   text        NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = new Map(
      (await sql`SELECT version, checksum FROM diary.schema_migrations`).map((row) => [
        row.version,
        row.checksum,
      ]),
    );

    let count = 0;
    for (const migration of migrations) {
      const previous = applied.get(migration.version);
      if (previous !== undefined) {
        if (previous !== migration.checksum) {
          throw new ScriptError(
            `${migration.version} 은 이미 적용되었는데 파일 내용이 바뀌었습니다. 적용된 파일은 고치지 말고 새 번호의 파일을 추가하세요.`,
          );
        }
        console.log(`건너뜀 (이미 적용됨): ${migration.version}`);
        continue;
      }

      await sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
        await tx.unsafe(migration.sqlText);
        await tx`
          INSERT INTO diary.schema_migrations (version, checksum)
          VALUES (${migration.version}, ${migration.checksum})
          ON CONFLICT (version) DO NOTHING
        `;
      });
      count += 1;
      console.log(`적용함: ${migration.version}`);
    }

    console.log(count === 0 ? "새로 적용할 마이그레이션이 없습니다." : `완료: ${count}개 적용`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(`마이그레이션 실패: ${describeError(error)}`);
  process.exitCode = 1;
});
