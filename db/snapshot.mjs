// 스키마별 표 목록 스냅샷 (읽기 전용): npm run db:snapshot
//
// 쓰는 법
//   npm run db:snapshot                          화면에 출력만 한다.
//   npm run db:snapshot -- --out before-001      db/snapshots/before-001.json 으로도 저장한다.
//   npm run db:snapshot -- --compare before-001  저장해 둔 스냅샷과 비교한다. (diary 밖 스키마가 같아야 통과)
//
// 이 스크립트는 information_schema.tables 를 SELECT 만 한다. (읽기 전용 트랜잭션)
// DATABASE_URL 값은 출력하지도, 파일에 저장하지도 않는다.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSql, describeError, ScriptError } from "./connect.mjs";

const snapshotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "snapshots");
const EXCLUDED_SCHEMAS = ["pg_catalog", "information_schema"];

function parseArgs(argv) {
  const options = { out: null, compare: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") options.out = argv[++i];
    else if (argv[i] === "--compare") options.compare = argv[++i];
    else throw new ScriptError(`알 수 없는 옵션: ${argv[i]}`);
  }
  for (const name of [options.out, options.compare]) {
    if (name !== null && !/^[A-Za-z0-9._-]+$/.test(name ?? "")) {
      throw new ScriptError("파일 이름은 영문, 숫자, 점, 밑줄, 하이픈만 쓸 수 있습니다. (확장자 .json은 자동으로 붙습니다.)");
    }
  }
  return options;
}

const filePath = (name) => path.join(snapshotsDir, `${name}.json`);

/** information_schema.tables 를 읽어 스키마별 표 목록으로 만든다. (읽기 전용) */
async function takeSnapshot() {
  const sql = createSql();
  try {
    const rows = await sql.begin("read only", (tx) => tx`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);
    const schemas = {};
    for (const { table_schema: schema, table_name: table } of rows) {
      (schemas[schema] ??= { count: 0, tables: [] }).tables.push(table);
      schemas[schema].count += 1;
    }
    return { takenAt: new Date().toISOString(), totalTables: rows.length, schemas };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function printSnapshot(snapshot) {
  console.log(`스냅샷 시각: ${snapshot.takenAt}`);
  console.log(`전체 표 수: ${snapshot.totalTables} (시스템 스키마 ${EXCLUDED_SCHEMAS.join(", ")} 제외)`);
  for (const [schema, info] of Object.entries(snapshot.schemas)) {
    console.log(`\n[${schema}] ${info.count}개`);
    for (const table of info.tables) console.log(`  - ${table}`);
  }
}

/** diary 밖 스키마의 표 목록이 같은지 비교한다. */
function compareOutsideDiary(before, after) {
  const names = new Set([...Object.keys(before.schemas), ...Object.keys(after.schemas)]);
  const differences = [];
  for (const schema of [...names].sort()) {
    if (schema === "diary") continue;
    const a = before.schemas[schema]?.tables ?? [];
    const b = after.schemas[schema]?.tables ?? [];
    if (a.length !== b.length || a.some((table, i) => table !== b[i])) {
      differences.push(`[${schema}] 전 ${a.length}개 → 후 ${b.length}개`);
    }
  }
  return differences;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await takeSnapshot();
  printSnapshot(snapshot);

  if (options.out) {
    await mkdir(snapshotsDir, { recursive: true });
    await writeFile(filePath(options.out), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(`\n저장함: db/snapshots/${options.out}.json`);
  }

  if (options.compare) {
    let before;
    try {
      before = JSON.parse(await readFile(filePath(options.compare), "utf8"));
    } catch {
      throw new ScriptError(`비교할 스냅샷을 읽을 수 없습니다: db/snapshots/${options.compare}.json`);
    }
    const differences = compareOutsideDiary(before, snapshot);
    console.log(`\n비교 기준: db/snapshots/${options.compare}.json (${before.takenAt})`);
    if (differences.length === 0) {
      console.log("결과: 통과 - diary 밖 스키마의 표 목록과 개수가 같습니다.");
    } else {
      console.log("결과: 실패 - diary 밖 스키마가 달라졌습니다.");
      for (const line of differences) console.log(`  - ${line}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(`스냅샷 실패: ${describeError(error)}`);
  process.exitCode = 1;
});
