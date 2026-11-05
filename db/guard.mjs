// 마이그레이션 SQL 안전 검사.
// 마이그레이션이 diary 스키마 밖의 객체를 만들거나 바꾸거나 지우지 못하게, 실행 전에 SQL 글자를 검사한다.
// 완벽한 SQL 해석기는 아니다. 사람이 SQL을 읽고 승인하는 절차를 대신하지 않고, 실수를 한 번 더 막는 안전망이다.
// 의심스러우면 실행을 막는다. (막혔는데 정말 필요한 구문이면 SQL을 사람이 검토한 뒤 이 파일을 고친다.)

/** 주석과 문자열 리터럴을 지운다. (그 안에 든 단어가 검사에 걸리지 않게) */
export function stripSql(sql) {
  return sql.replace(
    /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"/g,
    (token) => {
      if (token.startsWith("--") || token.startsWith("/*")) return " ";
      if (token.startsWith("'")) return "''";
      return token; // 큰따옴표 식별자("diary"."entries")는 남긴다.
    },
  );
}

/** 이름이 diary 스키마 소속인지 본다. (diary.x 또는 "diary".x) */
const DIARY = String.raw`"?diary"?\s*\.\s*`;

/** 실행하면 안 되는 구문. */
const FORBIDDEN = [
  [/\bdrop\b/, "DROP 구문"],
  [/\btruncate\b/, "TRUNCATE 구문"],
  [/\bcreate\s+extension\b/, "CREATE EXTENSION"],
  [/\b(?:grant|revoke)\b/, "GRANT/REVOKE"],
  [/\bset\s+(?:local\s+|session\s+)?search_path\b/, "search_path 변경"],
  [/\balter\s+(?:system|role|user|database|default\s+privileges)\b/, "시스템·역할 설정 변경"],
  [/\bcreate\s+(?:role|user|database|publication|subscription|trigger|event)\b/, "역할·DB 등 생성"],
  [/\bcopy\b[\s\S]*\b(?:program|from\s+'|to\s+')/, "COPY ... PROGRAM/파일"],
];

/** diary. 접두어가 반드시 있어야 하는 구문. 캡처 그룹 1이 대상 이름이다. */
const MUST_BE_DIARY = [
  [/\bcreate\s+schema\s+(?:if\s+not\s+exists\s+)?("?[a-z_][\w$]*"?)/g, "CREATE SCHEMA", /^"?diary"?$/],
  [/\bcreate\s+(?:unlogged\s+|temp(?:orary)?\s+)?table\s+(?:if\s+not\s+exists\s+)?("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "CREATE TABLE"],
  [/\bcreate\s+(?:or\s+replace\s+)?(?:view|materialized\s+view|sequence|type|function|procedure)\s+(?:if\s+not\s+exists\s+)?("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "CREATE VIEW/SEQUENCE/TYPE/FUNCTION"],
  [/\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:"?[a-z_][\w$]*"?\s+)?on\s+(?:only\s+)?("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "CREATE INDEX ... ON"],
  [/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "ALTER TABLE"],
  [/\binsert\s+into\s+("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "INSERT INTO"],
  [/\bdelete\s+from\s+(?:only\s+)?("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "DELETE FROM"],
  [/\bupdate\s+(?:only\s+)?("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)\s+(?:as\s+\w+\s+)?set\b/g, "UPDATE"],
  [/\bcomment\s+on\s+(?:table|column|index)\s+("?[a-z_][\w$]*"?(?:\s*\.\s*"?[a-z_][\w$]*"?)?)/g, "COMMENT ON"],
];

/**
 * SQL을 검사해 문제 목록을 돌려준다. 빈 배열이면 통과다.
 * @param {string} sql
 * @returns {string[]}
 */
export function checkMigrationSql(sql) {
  const problems = [];
  const text = stripSql(sql).toLowerCase();

  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(text)) problems.push(`허용되지 않는 구문: ${label}`);
  }

  // 1) 점(.)으로 이어진 이름은 모두 diary 스키마여야 한다. (public.x, auth.x 등 차단)
  for (const match of text.matchAll(/(?<![\w$.])("?[a-z_][\w$]*"?)\s*\.\s*"?[a-z_][\w$]*"?/g)) {
    const schema = match[1].replace(/"/g, "");
    if (schema !== "diary") problems.push(`diary 밖 스키마 참조: ${schema}.`);
  }

  // 2) 객체를 만들거나 바꾸는 구문의 대상은 diary. 접두어가 있어야 한다.
  for (const [pattern, label, schemaOnly] of MUST_BE_DIARY) {
    for (const match of text.matchAll(pattern)) {
      const target = match[1].replace(/\s+/g, "");
      const ok = schemaOnly ? schemaOnly.test(target) : new RegExp(`^${DIARY}`).test(match[1]);
      if (!ok) problems.push(`${label} 대상에 diary. 접두어가 없습니다: ${target}`);
    }
  }

  return [...new Set(problems)];
}
