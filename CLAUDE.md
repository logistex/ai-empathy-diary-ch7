# 프로젝트 규칙

AI 공감 다이어리(`ai-empathy-diary-ch7`)를 개발하면서 정한 규칙과 주의할 점이다.
자세한 배경은 `docs/PRD.md`(요구사항), `docs/PLAN.md`(단계별 계획과 이력), `docs/API.md`(API 약속)에 있다.

## 언어

- 모든 답변과 문서(README, 주석, 커밋 메시지, 설명 등)는 **한국어**로 작성한다.
- 코드의 식별자(변수·함수 이름 등)와 명령어, 에러 메시지 원문은 그대로 두어도 된다.

## .env 파일 보안

- `.env` 파일(`.env.local`, `.env.production`, `.env.example` 등 `.env*` 파일 포함)은 **열거나 읽지 않는다.**
- `.env` 파일의 내용(값)을 화면에 출력하지 않는다. `cat`, `type`, `Get-Content` 등으로 내용을 표시하는 명령도 실행하지 않는다.
- `node --env-file=.env`로 값을 불러와 대조·출력하는 스크립트도 실행하지 않는다. (`npm run db:migrate`, `db:snapshot`처럼 값을 출력하지 않는 프로젝트 스크립트는 예외)
- 환경 변수를 언급해야 할 때는 **변수 이름만** 쓴다. (예: `DATABASE_URL`, `API_KEY`)
- 값이 필요하면 사용자에게 직접 확인을 요청한다.

## 비밀 값과 공개 저장소

- GitHub 저장소는 **공개**다. 한 번 푸시한 내용은 지워도 기록에 남으므로, 비밀 값을 코드·문서·커밋·채팅 어디에도 쓰지 않는다.
- 환경 변수는 5개다: `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- 비밀 값은 서버 코드에서만 쓴다. `"use client"` 파일이나 `NEXT_PUBLIC_` 변수에 넣지 않는다. `process.env`를 읽는 파일에는 `import "server-only"`를 둔다.
- 커밋 전에는 `git status`, 푸시 전에는 `git ls-files`로 `.env`가 들어가지 않았는지 확인한다. (추적하는 `.env*` 파일은 `.env.example`뿐이어야 한다.)

## 진행 방식과 에이전트

- 작업은 `docs/PLAN.md`의 단계대로 한다. 단계를 마치면 "완료 확인" 항목을 점검하고, PLAN의 진행 현황과 이력을 고친다.
- 에이전트(`.claude/agents/`) 역할:
  | 에이전트 | 맡는 일 | 주로 고치는 파일 |
  |---|---|---|
  | product-manager | PRD, 일정, 진행 현황 표 | `docs/PRD.md`, `docs/PLAN.md` |
  | backend-developer | API, DB, 인증 | `src/app/api/**`, `src/lib/db/**`, `src/auth*.ts`, `src/proxy.ts`, `db/**` |
  | ai-integration-specialist | AI 호출, 프롬프트, 위기 감지 | `src/lib/ai/**` |
  | frontend-developer | 화면, 접근성 | `src/app/**`(`api/` 제외), `src/components/**`, `src/lib/client/**` |
  | qa-engineer | 검사와 보고만 한다 (파일을 고치는 도구가 없다) | 없음 |
- QA 흐름: `qa-engineer`가 검사·보고 → 담당 개발 에이전트가 수정 → 메인 Claude가 직접 다시 실행해 확인 → `qa-engineer`가 그 부분만 재검사. QA 보고서는 메인 Claude가 `docs/qa/`에 그대로 옮겨 적는다.
- 에이전트 보고는 그대로 믿지 않는다. 핵심 결과(재현 문장, 테스트 결과)는 메인 Claude가 직접 실행해 확인한 뒤 사용자에게 전한다.
- 여러 에이전트가 동시에 일할 때는 담당 구역 밖의 파일과 `package.json`을 고치지 않는다.

## 사용자가 직접 하는 일

- 구글 로그인 시험(비밀번호 입력), 비밀 값 만들기와 입력, Vercel·Google Cloud Console 설정은 **사용자가 직접** 한다. 에이전트는 로그인을 흉내 내거나 `AUTH_SECRET`으로 세션 토큰을 만들지 않는다.
- 로그인이 필요한 화면·API 시험(두 계정 격리, 로그아웃 후 뒤로 가기 등)은 사용자에게 확인을 요청한다.

## DB (Supabase Postgres)

- 표는 **`diary` 스키마 안에만** 둔다. `public`, `auth` 등 다른 스키마의 표는 절대 건드리지 않는다. 같은 DB를 다른 프로젝트도 쓴다.
- 모든 SQL에 `diary.` 접두어를 붙이고 `search_path`에 기대지 않는다. 값은 항상 매개변수 바인딩으로 넣는다. 문자열을 이어 붙여 SQL을 만들지 않는다.
- 모든 조회·저장·삭제에 **세션의 `user_id` 조건을 서버에서** 붙인다. 요청 본문이나 주소의 `user_id`는 믿지 않는다. 남의 일기는 `404`로 답한다(존재 여부를 알리지 않는다).
- 마이그레이션은 `db/migrations/`에 SQL 파일로 두고 `npm run db:migrate`로 실행한다. `db/guard.mjs`가 `diary` 밖 객체, `DROP` 등을 막는다.
  - 실행 전 SQL 전문을 사용자에게 보여 주고 승인을 받는다.
  - 실행 전후로 `npm run db:snapshot -- --compare before-001`을 돌려 `diary` 밖 스키마의 표 목록과 개수가 같은지 확인한다.
- Vercel(서버리스)에서는 Supabase 연결 풀러(트랜잭션 모드)를 쓰므로 prepared statement를 끈 설정을 유지한다(`src/lib/db/client.ts`).
- QA와 시험 중에는 DB를 바꾸는 명령(`db:migrate`, `RUN_E2E=1`, `RUN_DB_TESTS=1`, 시험 행 넣기·지우기)을 사용자 승인 없이 실행하지 않는다.

## 로그인 (Auth.js)

- Auth.js(`next-auth` v5)를 **DB 어댑터 없이 JWT 세션**으로 쓴다. 어댑터를 쓰면 `diary` 밖 스키마에 표가 생긴다.
- 일기의 `user_id`는 **구글 계정 ID**(`account.providerAccountId`)다. `jwt` 콜백이 로그인 순간 이 값을 `token.sub`에 넣는다(`src/auth-callbacks.ts`). 어댑터가 없으면 Auth.js는 로그인마다 임의 UUID를 만들므로, 이 처리를 지우면 다시 로그인했을 때 지난 일기가 보이지 않는다.
- 로그인 오류는 Auth.js 기본 화면 대신 `/login?error=`로 보내 다시 시도 안내를 보여 준다.
- Next.js 16이라 `middleware.ts` 대신 `src/proxy.ts`에서 로그인하지 않은 사용자를 `/login`으로 보낸다.

## AI (OpenRouter)

- 모델 이름, 대기 시간 등은 `src/lib/ai/config.ts` 한곳에서 관리한다. 1순위 `nvidia/nemotron-3-ultra-550b-a55b:free` → 2순위 `nvidia/nemotron-3.5-super-vl:free`, 모델당 20초. **모델을 바꾸기 전에는 사용자에게 먼저 알린다.**
- 두 모델이 모두 실패해도 예외를 던지지 않는다. 일기는 저장하고 화면에는 기본 위로 문구를 보여 준다.
- 프롬프트는 `src/lib/ai/prompts.ts` 한곳에서 관리한다. 일기는 `<diary_entry>` 태그 안에 넣고 꺾쇠를 바꿔, 일기 속 문장이 지시처럼 작동하지 않게 한다. 응답은 `zod`(`schema.ts`)로 검증한다.
- 로그에는 모델 이름, 오류 종류, 상태 코드만 남긴다. 일기 원문, 공감 메시지, API 키는 남기지 않는다.
- 시험에서 실제 OpenRouter를 부르는 일(`AI_LIVE_CHECK=1`)은 사용자 승인을 받고 한다. 단위 테스트는 `fetch`를 가짜로 바꿔 쓴다.

## 위기 감지 (가장 조심할 부분)

- 감지는 **두 겹**이다. 서버 키워드 검사(`src/lib/ai/crisis.ts`)와 AI 판단 중 **하나라도** 위기면 상담 연락처를 보여 준다(OR). AI가 실패해도 키워드 검사 결과는 그대로 남아야 한다.
- 방침: **놓치는 것보다 잘못 띄우는 쪽**을 택한다. 다만 흔한 일상 문장이 걸리는 오탐은 줄인다.
- 규칙은 세 종류다. 규칙을 더하거나 옮길 때는 어느 목록에 둘지 먼저 정한다.
  - `CRISIS_SHORT_KEYWORDS`(자해·자살 등 2글자): 띄어쓰기를 그대로 둔 글에서 찾는다. ("이제 자 해야지"가 걸리지 않게)
  - `CRISIS_PHRASES`: 공백·문장부호를 지운 글에서 **음절 그대로** 비교한다.
  - `CRISIS_STEM_PHRASES`: 활용 어간만 둔다. **NFD 자모로 풀어** 앞부분을 비교하므로, "죽어버리"가 "죽어버릴까"도 잡는다.
- 자모 비교에서 주의할 점:
  - 규칙의 끝 글자에 받침이 없으면 받침이 붙은 다른 낱말과도 맞는다(예: "목매" → "목 맨날", "생을끝내" → "고생을 끝냈다"). 그래서 받침 활용이 꼭 필요한 어간만 `CRISIS_STEM_PHRASES`에 넣고, 넣기 전에 끝 글자 + 받침으로 만들어지는 흔한 일상 낱말을 확인한다.
  - NFD 분해는 반드시 `NOT_WORD_PATTERN`으로 낱자("ㅋ", "ㅠ")를 지운 **다음에** 한다. 순서를 바꾸면 "죽ㅋ고싶다" 같은 우회가 생긴다.
- 규칙을 고치면 `crisis.test.ts`에 위기 문장, 평범한 문장, 우회 입력, 관용 표현 현재 동작을 함께 넣는다. 수정 전(`git show HEAD:src/lib/ai/crisis.ts`)과 결과를 비교해 새 오탐·새 미탐을 따로 확인한다.
- 상담 연락처(109, 1577-0199, 1388, 119)와 위기 안내 문구는 사용자가 확인한 것이다. `src/components/crisis/crisis-config.ts`를 바꾸지 않는다. 운영 시간·무료 여부는 확인되지 않았으므로 화면에 쓰지 않는다.
- 위기 안내 상자에 자극적인 빨강을 쓰지 않는다. 상자는 공감 메시지 **위**에 둔다.
- 남은 문제(2026-11-06 기준)는 `docs/qa/recheck-high-2.md` 4절에 있다. ("고생을 끝냈다" 오탐 등)

## 입력과 화면

- 일기는 한 줄, **200자**까지다. 글자 수는 `trim()` 뒤 `Array.from` 길이(코드 포인트)로 센다. 서버(`src/app/api/_lib/validation.ts`), 화면(`src/lib/client/validation.ts`), DB CHECK가 같은 기준이어야 한다. 하나를 바꾸면 셋을 같이 바꾼다.
- 일기 원문은 React 기본 출력으로만 보여 준다. `dangerouslySetInnerHTML`, `innerHTML`을 쓰지 않는다.
- 무료 모델 안내 문구는 일기 쓰기 화면의 입력창 아래, 저장 버튼 위에 **항상** 보인다. 접거나 닫을 수 없게 둔다.
- 화면은 종이 일기장 느낌(크림·베이지, 둥근 모서리)이다. 모바일(375px) 우선, 키보드 조작, 포커스 표시, `aria-live`, 색 대비(본문 4.5:1, UI 3:1)를 지킨다.

## 개발과 검증

- 개발 서버는 `http://localhost:3000`에서만 띄운다(구글 리디렉션 주소가 3000번 포트로 등록되어 있다). 사용자가 띄운 서버를 끄거나 재시작하지 않는다.
- `npm run lint`, `npm test`, `npm run build`는 **하나씩 순서대로** 실행한다. 동시에 돌리면 화면 테스트가 시간 초과로 실패할 수 있다.
- 실제 DB·AI를 부르는 테스트는 `RUN_DB_TESTS`, `RUN_E2E`, `AI_LIVE_CHECK`가 있을 때만 돈다. 기본 실행에서는 건너뛴다.
- `next.config.ts`의 `agentRules: false`는 `next dev`가 `AGENTS.md`를 만들지 않게 한다. 프로젝트 지침은 이 `CLAUDE.md` 하나로 관리한다.

## 커밋과 태그

- 커밋 메시지는 한국어로, 첫 줄에 무엇을 했는지 쓰고 본문에 이유를 적는다. 내용이 다른 변경은 커밋을 나눈다.
- 단계를 마치면 마지막 커밋에 `DIARY_단계_번호` 형식의 메시지 있는 태그를 단다. (예: `DIARY_04_01`, 메시지 "4단계 QA")
- 푸시는 사용자가 요청할 때만 `origin`(`logistex/ai-empathy-diary-ch7`)의 `main`에 한다.
