import "server-only";

import postgres from "postgres";

/**
 * Postgres 연결 (서버 전용).
 *
 * - DATABASE_URL은 process.env로만 읽는다. 값을 로그에 남기지 않는다.
 * - Supabase 트랜잭션 풀러(포트 6543)는 prepared statement를 지원하지 않으므로 prepare: false로 둔다.
 * - 연결은 처음 쓸 때 만든다. 빌드 중이나 환경 변수가 없는 상태에서 import만 해서는 오류가 나지 않는다.
 * - 개발 서버(HMR)가 코드를 다시 불러와도 연결이 계속 늘어나지 않게 globalThis에 한 개만 보관한다.
 *
 * 쓰는 법 (모든 값은 템플릿의 ${} 로 넣어 매개변수 바인딩이 되게 한다. 문자열을 이어 붙이지 않는다.)
 *   const sql = getSql();
 *   const rows = await sql`SELECT id FROM diary.entries WHERE user_id = ${userId}`;
 */
export type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { __diarySql?: Sql };

/** 로컬 DB(localhost 등)면 SSL을 끄고, 그 밖에는 SSL을 요구한다. */
function needsSsl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !["localhost", "127.0.0.1", "[::1]"].includes(host);
  } catch {
    return true;
  }
}

function createSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // 값이 아니라 변수 이름만 알린다.
    throw new Error("환경 변수 DATABASE_URL이 설정되지 않았습니다.");
  }
  return postgres(url, {
    prepare: false, // 트랜잭션 풀러(6543) 호환
    max: 3, // 서버리스 인스턴스 하나가 잡는 연결 수를 작게 유지
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: needsSsl(url) ? "require" : false,
    onnotice: () => {},
  });
}

/** 공유 DB 연결을 돌려준다. 처음 부를 때 만든다. */
export function getSql(): Sql {
  globalForDb.__diarySql ??= createSql();
  return globalForDb.__diarySql;
}
