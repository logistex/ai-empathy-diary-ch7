// db 스크립트(migrate, snapshot)가 함께 쓰는 연결 도우미.
// DATABASE_URL은 process.env로만 읽고, 값(호스트·사용자 이름 포함)을 절대 출력하지 않는다.
// 실행: package.json의 스크립트가 node --env-file=.env 로 환경 변수를 넣어 준다.

import postgres from "postgres";

/** 스크립트 전용 오류. 메시지에는 접속 정보가 들어가지 않는다. */
export class ScriptError extends Error {}

/** DATABASE_URL이 로컬 주소를 가리키는지 확인한다. (값은 출력하지 않는다.) */
function isLocalHost(url) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Postgres 연결을 만든다.
 * - prepare: false  → Supabase 트랜잭션 풀러(6543)는 prepared statement를 지원하지 않는다.
 * - max: 1          → 스크립트는 연결 하나면 충분하다.
 * - ssl: 로컬이 아니면 SSL을 요구한다. (Supabase 기본)
 */
export function createSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new ScriptError(
      "환경 변수 DATABASE_URL이 없습니다. .env에 DATABASE_URL을 넣었는지 확인하세요.",
    );
  }
  return postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 15,
    idle_timeout: 5,
    ssl: isLocalHost(url) ? false : "require",
    onnotice: () => {}, // "이미 있어서 건너뜀" 같은 알림은 출력하지 않는다.
  });
}

/**
 * 오류를 접속 정보 없이 요약한다.
 * - 네트워크 오류(ECONNREFUSED 등)의 메시지에는 호스트 주소가 들어갈 수 있으므로 코드만 쓴다.
 * - Postgres 서버 오류(PostgresError)의 메시지에는 접속 정보가 없으므로 그대로 쓴다.
 */
export function describeError(error) {
  if (error instanceof ScriptError) return error.message;
  if (error && error.name === "PostgresError") {
    // 28xxx(인증 실패)와 3D000(DB 없음) 메시지에는 사용자·DB 이름이 들어갈 수 있다.
    if (String(error.code).startsWith("28") || error.code === "3D000") {
      return `Postgres 오류 [${error.code}]: 인증 또는 접속 대상 문제입니다. DATABASE_URL을 확인하세요.`;
    }
    return `Postgres 오류 [${error.code}]: ${error.message}`;
  }
  const code = error && error.code ? ` [${error.code}]` : "";
  return `연결 또는 실행 중 오류가 났습니다${code}. 접속 정보 보호를 위해 상세 메시지는 출력하지 않습니다.`;
}
