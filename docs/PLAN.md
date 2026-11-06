# AI 공감 다이어리 — 단계별 작업 계획

오늘 있었던 일을 한 줄로 쓰면 AI가 감정을 분석하고, 공감하며 위로해 주는 일기 앱을 만드는 계획이다.
`.claude/agents`의 에이전트 5개에게 단계마다 역할을 나눠 맡긴다.

> **진행 규칙**: 사용자가 "N단계 진행해"라고 말할 때만 그 단계를 시작한다.
> 각 단계가 끝나면 "완료 확인" 항목을 모두 점검해 결과를 보고하고, 다음 지시가 올 때까지 멈춘다.

---

## 진행 현황

| 단계 | 내용 | 맡을 에이전트 | 상태 |
|---|---|---|---|
| 0 | PRD 작성 | product-manager | 완료 (2026-11-05 승인) |
| 1 | 프로젝트 뼈대 | backend-developer → ai-integration-specialist, frontend-developer | 완료 (2026-11-05) |
| 2 | 백엔드 · AI · 화면 동시 개발 | backend-developer ∥ ai-integration-specialist ∥ frontend-developer | 완료 (2026-11-05) |
| 3 | 통합 | backend-developer → frontend-developer | 완료 (2026-11-05) |
| 4 | QA | qa-engineer (수정은 담당 개발 에이전트) | 진행 중 (높음 2건 수정·재검사 완료, 남은 문제 중간 1·낮음 3) |
| 5 | 배포 | backend-developer, qa-engineer (+ 사용자 직접 작업) | 완료 (2026-11-06, https://ai-empathy-diary-ch7.vercel.app) |

상태 표시는 `대기 / 진행 중 / 완료`로 쓰고, 단계가 끝날 때마다 product-manager가 이 표를 고친다.

---

## 요구사항 요약

| 항목 | 내용 |
|---|---|
| 사용자 | 구글 계정으로 로그인한 사용자. 로그인은 **Auth.js**(`next-auth` v5)로 처리한다. 사용자는 **자기 일기만** 볼 수 있다. |
| 핵심 기능 | ① 한 줄 일기 쓰기 ② 감정 분석과 공감 메시지 ③ 지난 기록 보기 ④ 위기 표현(자해, 극단적 선택 등)이 있으면 공감 메시지와 함께 전문 상담 연락처 안내 ⑤ 일기 삭제(0단계에서 추가, 수정은 범위 밖) |
| 기술 | Next.js(App Router, TypeScript) |
| 저장소(DB) | `DATABASE_URL`이 가리키는 Supabase Postgres에 **`diary` 스키마를 새로 만들어** 저장한다. **다른 스키마의 표는 건드리지 않는다.** |
| AI 모델 | OpenRouter. 1순위 `nvidia/nemotron-3-ultra-550b-a55b:free` → 응답이 없거나 오류가 나면 2순위 `nvidia/nemotron-3.5-super-vl:free`. API 키는 `OPENROUTER_API_KEY`. |
| 배포 | GitHub 저장소 `ai-empathy-diary-ch7`에 올리고 Vercel에 배포한다. 저장소는 사용자가 이미 **공개**로 만들었고, 이 폴더의 `origin`으로 연결되어 있다. |
| 화면 느낌 | 따뜻하고 편안한 일기장 |

### 미리 정해 두는 설계 방향

단계 사이에서 에이전트끼리 어긋나지 않도록, 아래 내용은 계획 단계에서 정해 둔다. 바꿀 필요가 생기면 사용자에게 먼저 확인한다.

- **앱 위치**: Next.js 앱은 이 저장소(`Study_05_01`)의 **루트**에 만든다. 이 저장소가 그대로 GitHub `ai-empathy-diary-ch7`이 된다.
- **로그인 세션은 JWT 방식**: Auth.js의 DB 어댑터를 쓰면 `public` 등 다른 스키마에 `users`·`accounts` 같은 표가 생길 수 있다. 그래서 DB 어댑터 없이 JWT 세션을 쓰고, 일기에는 구글 계정의 고유 ID(`token.sub`)를 `user_id`로 저장한다.
- **DB 표는 `diary` 스키마 안에만** 만든다. 모든 SQL은 `diary.` 접두어를 붙여 쓰고, `search_path`에 기대지 않는다.
- **위기 표현 감지는 두 겹**으로 한다. 서버의 키워드 규칙 검사와 AI의 판단 중 하나라도 위기로 보면 상담 연락처를 띄운다. AI가 두 모델 모두 실패해도 키워드 검사와 연락처 안내는 동작해야 한다.
- **비밀 값은 서버에서만** 쓴다. `OPENROUTER_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`은 브라우저 코드(`"use client"`)나 `NEXT_PUBLIC_` 변수에 절대 넣지 않는다.
- **`.env` 파일은 아무 에이전트도 열거나 출력하지 않는다.** 필요한 변수 이름은 `.env.example`에 이름만 적는다. 스크립트는 `process.env`로 값을 읽기만 한다.

### 쓰게 될 환경 변수 (이름만)

| 이름 | 용도 | 현재 `.env`에 있는지 |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres 연결 | 있음(사용자 안내) |
| `OPENROUTER_API_KEY` | OpenRouter API 키 | 있음(사용자 안내) |
| `AUTH_SECRET` | Auth.js 세션 암호화 키 | 없음 — 1단계에서 만드는 방법 안내 |
| `AUTH_GOOGLE_ID` | 구글 OAuth 클라이언트 ID | 없음 — 1단계에서 만드는 방법 안내 |
| `AUTH_GOOGLE_SECRET` | 구글 OAuth 클라이언트 비밀 값 | 없음 — 1단계에서 만드는 방법 안내 |

---

## 0단계 — PRD 작성

**맡을 에이전트**: `product-manager`

**할 일**

1. 위 요구사항을 바탕으로 `docs/PRD.md`를 쓴다. (에이전트 정의의 "PRD 기본 구성" 8개 항목을 따른다.)
2. 기능마다 우선순위를 매긴다.
   - 필수: 구글 로그인, 한 줄 일기 쓰기, 감정 분석·공감 메시지, 지난 기록 보기, 위기 표현 시 상담 연락처 안내, 내 일기만 보기
   - 있으면 좋음 / 나중에: 일기 수정·삭제, 감정 통계 그래프, 다크 모드 등은 PM이 제안하고 사용자가 고른다.
3. 기능별 완료 조건을 구체적으로 적는다. 예시:
   - 한 줄 일기: 빈 입력과 최대 글자 수(예: 200자) 초과는 막는다.
   - 감정 분석: 감정 이름(예: 기쁨·슬픔·분노·불안·평온 중 하나), 강도, 공감 메시지(2~4문장)를 보여 준다.
   - 위기 안내: 감지되면 공감 메시지 위에 상담 연락처 상자를 눈에 띄게 보여 준다.
4. 위기 안내에 넣을 상담 연락처 목록 초안을 만든다. (예: 자살예방상담전화 109, 정신건강위기상담 1577-0199, 청소년상담 1388, 응급 시 119) 번호는 PRD에서 "사용자 확인 필요"로 표시하고, 최신 번호인지 사용자가 확인한다.
5. "열린 질문"을 정리해 사용자에게 묻는다. 최소한 아래 내용은 넣는다.
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`가 준비되어 있는지
   - GitHub 저장소를 공개로 할지 비공개로 할지
   - 일기 수정·삭제 기능을 이번 범위에 넣을지
   - 무료 모델(`:free`)은 제공자가 입력을 기록하거나 학습에 쓸 수 있다는 점을 받아들일지, 화면에 이를 알릴지
6. 이 문서의 "진행 현황" 표를 고친다.

**산출물**: `docs/PRD.md`

**완료 확인**

- [x] `docs/PRD.md`에 8개 항목(개요, 목표·성공 기준, 대상 사용자, 사용자 스토리, 기능 명세, 범위 밖 항목, 일정, 위험·열린 질문)이 모두 있다.
- [x] 필수 기능 6개가 모두 들어 있고, 기능마다 완료 조건이 확인 가능한 문장으로 적혀 있다. (사용자 답변으로 F7 일기 삭제가 더해져 7개)
- [x] 위기 안내 문구와 상담 연락처 초안이 있다. (사용자 확인 완료)
- [x] 열린 질문에 사용자가 답했고, 답한 내용이 PRD에 반영되었다.
- [x] 사용자가 PRD를 읽고 승인했다. (2026-11-05)

---

## 1단계 — 프로젝트 뼈대

2단계에서 세 에이전트가 동시에 일하려면, 서로 기대는 **약속(API 명세, 타입, DB 구조, 의존성)** 을 이 단계에서 먼저 정해야 한다. 그래서 순서대로 진행한다.

**맡을 에이전트**: `backend-developer`(주도) → `ai-integration-specialist`, `frontend-developer`(검토와 보완)

**할 일**

1. **backend-developer — 프로젝트 생성**
   - 루트에 Next.js(App Router, TypeScript, ESLint) 프로젝트를 만든다. 루트에 `.claude/`, `CLAUDE.md`, `.env`가 있어 `create-next-app`이 충돌하면, 임시 폴더에 만든 뒤 파일을 옮긴다. 이때 `.env`는 건드리지 않는다.
   - 2단계에 필요한 의존성을 **이 단계에서 모두 설치**한다. (예: `next-auth@beta`, Postgres 드라이버, `zod`, 테스트 도구 `vitest`) 2단계의 동시 작업 중에 `npm install`이 겹치지 않게 하기 위해서다.
   - `.env.example`에 위 환경 변수 5개를 **이름만** 적는다.
   - `npm run dev`, `build`, `lint`, `test`, `db:migrate`, `db:snapshot` 스크립트를 준비한다.
2. **backend-developer — DB 구조와 연결**
   - `db/migrations/001_create_diary_schema.sql`을 만든다. 내용은 `CREATE SCHEMA IF NOT EXISTS diary`와 `diary.entries` 표다.
     - 열 예시: `id`(uuid), `user_id`(text, 구글 계정 ID), `content`(text), `emotion`(text), `emotion_score`(정수), `empathy_message`(text), `is_crisis`(boolean), `model_used`(text), `created_at`(timestamptz)
     - `(user_id, created_at desc)` 색인
   - 마이그레이션 실행 스크립트(`npm run db:migrate`)를 만든다. 이 스크립트는 `diary` 스키마 밖의 객체를 만들거나 바꾸거나 지우지 않는다.
   - **실행 전**: SQL 전문을 사용자에게 보여 주고 승인을 받는다. 또 다른 스키마의 표 목록과 개수를 기록해 둔다(아래 "다른 스키마 보호 점검").
   - Vercel 같은 서버리스 환경에서는 Supabase 연결 풀러(트랜잭션 모드)를 쓸 수 있으므로, 드라이버의 prepared statement 설정을 그에 맞춘다.
   - DB 연결 모듈 `src/lib/db/`를 만든다.
3. **backend-developer — 인증 뼈대**
   - `src/auth.ts`에 Auth.js 구글 로그인을 JWT 세션으로 설정한다. 로그인하지 않은 사용자는 로그인 화면으로 보낸다.
4. **backend-developer — API 명세**
   - `docs/API.md`에 엔드포인트, 요청·응답 형식, 오류 형식, 상태 코드를 적는다. 예시:
     - `POST /api/entries` — 일기 저장, 분석 결과까지 돌려줌
     - `GET /api/entries?cursor=...` — 내 일기 목록(최신순, 페이지 나눔)
     - `GET /api/entries/[id]` — 내 일기 하나. 남의 일기는 `404`
     - `DELETE /api/entries/[id]` — 내 일기 삭제. 남의 일기는 `404`
     - 공통: 로그인하지 않으면 `401`, 입력 오류는 `400`
5. **ai-integration-specialist — AI 결과 약속**
   - `src/lib/ai/types.ts`에 AI 분석 결과 타입을 정한다. (예: `{ emotion, emotionScore, empathyMessage, isCrisis, modelUsed }`)
   - `src/lib/ai/index.ts`에 `analyzeDiary(content)` 함수의 이름과 형태만 만들고, 내용은 임시 값(stub)을 돌려주게 둔다.
   - `docs/API.md`의 응답 형식이 이 타입과 맞는지 확인한다.
6. **frontend-developer — 화면 기반**
   - 일기장 느낌의 기본 디자인 값(색, 글꼴, 여백, 둥근 모서리)을 CSS 변수로 정한다.
   - 페이지 구조(로그인, 오늘의 일기 쓰기, 지난 기록)를 정하고 빈 페이지를 만든다.
7. 모두 끝나면 로컬에 커밋한다. (푸시는 5단계에서 한다.)

**2단계 파일 담당 구역** (1단계에서 확정)

| 에이전트 | 맡는 파일 |
|---|---|
| backend-developer | `src/app/api/**`, `src/lib/db/**`, `src/auth.ts`, `src/proxy.ts`(Next.js 16.4.5라서 `middleware.ts` 대신 사용), `db/**` |
| ai-integration-specialist | `src/lib/ai/**` |
| frontend-developer | `src/app/**`(단, `api/` 제외), `src/components/**`, `src/lib/client/**`, 스타일 파일 |

**산출물**: Next.js 프로젝트, `.env.example`, `db/migrations/001_create_diary_schema.sql`, `docs/API.md`, `src/lib/ai/types.ts`, 빈 페이지들

**완료 확인**

- [x] `npm run dev`로 로컬(`http://localhost:3000`)에서 첫 화면이 열린다. (빌드본으로 확인: `/` → `/login` 이동, `/login` 200, `/api/entries` 401)
- [x] `npm run build`와 `npm run lint`가 오류 없이 끝난다.
- [x] `npm run db:migrate` 실행 후 `diary.entries` 표가 있다. (`information_schema.tables`에서 `table_schema = 'diary'` 조회) (`diary.entries`, `diary.schema_migrations` 생성)
- [x] **다른 스키마 보호 점검**: 마이그레이션 전후로 `diary` 밖 스키마의 표 목록과 개수가 똑같다. (`db:snapshot -- --compare before-001` 통과)
- [x] `.env.example`에 변수 이름 5개가 있고, 값은 비어 있다. `git status`에 `.env`가 나타나지 않는다.
- [x] `docs/API.md`의 응답 형식과 `src/lib/ai/types.ts`가 서로 맞는다.
- [x] 2단계 파일 담당 구역이 정해져 있다.

---

## 2단계 — 백엔드 · AI · 화면 동시 진행

세 에이전트를 **동시에** 실행한다. 1단계의 약속(`docs/API.md`, `src/lib/ai/types.ts`)만 보고 일하며, 서로의 결과물을 기다리지 않는다.

**동시 진행 규칙**

- 각자 **자기 담당 구역의 파일만** 고친다.
- `package.json`은 고치지 않는다. 의존성이 더 필요하면 보고만 하고, 3단계에서 한 번에 설치한다.
- 약속(API 명세, 타입)을 바꿔야 하면 혼자 바꾸지 말고 보고한다. 바꿀지는 3단계 전에 정한다.
- 커밋은 2단계가 모두 끝난 뒤 한 번에 한다.

### 2-A. backend-developer — API와 데이터

- `docs/API.md`대로 `/api/entries` API를 구현한다. AI 부분은 1단계의 임시 `analyzeDiary`를 그대로 부른다.
- 모든 조회·저장 쿼리에 **세션의 `user_id` 조건을 서버에서** 붙인다. 요청 본문이나 주소로 받은 `user_id`는 믿지 않는다.
- `zod`로 입력을 검증한다. (빈 문자열, 공백만 있는 입력, 최대 글자 수 초과)
- 모든 SQL은 매개변수 바인딩으로 쓴다. 문자열을 이어 붙여 SQL을 만들지 않는다.
- 테스트: 입력 검증, 로그인하지 않은 요청은 `401`, 남의 일기 id 조회·삭제는 `404`

### 2-B. ai-integration-specialist — AI 분석과 위기 감지

- OpenRouter 호출을 구현한다. (`https://openrouter.ai/api/v1/chat/completions`, 서버 전용)
- **모델 전환 규칙**
  1. 1순위 `nvidia/nemotron-3-ultra-550b-a55b:free`를 부른다.
  2. 아래 경우에는 2순위 `nvidia/nemotron-3.5-super-vl:free`로 넘어간다.
     - 정해진 시간(예: 20초) 안에 응답이 없음
     - HTTP 오류(429, 5xx 등)나 네트워크 오류
     - 응답 내용이 비었거나, JSON으로 읽을 수 없거나, 타입 검증에 실패함
  3. 두 모델이 모두 실패하면 예외를 던지지 않고 "분석 실패" 상태를 돌려준다. 이때 화면에는 기본 위로 문구가 나온다.
  - 실제로 응답한 모델 이름을 `modelUsed`에 담는다.
  - 모델 이름은 설정 파일 한곳에서 관리한다. 작업 시작 전에 OpenRouter 모델 목록에서 두 모델이 실제로 있는지 확인하고, 없으면 다른 모델로 바꾸지 말고 사용자에게 알린다.
- **프롬프트**: `src/lib/ai/prompts.ts` 한곳에서 관리한다. 따뜻하고 판단하지 않는 말투로, 한국어로, 정해진 JSON 형식으로 답하게 한다. 일기 내용은 시스템 지시와 분리해 넣어, 일기 속 문장이 지시처럼 작동하지 않게 한다.
- **위기 감지 두 겹**
  - `src/lib/ai/crisis.ts`: 키워드·표현 규칙 검사 (예: 자해, 자살, 죽고 싶, 극단적 선택, 사라지고 싶 등). AI를 부르기 전에 실행한다.
  - AI 응답의 `isCrisis`
  - 둘 중 하나라도 참이면 위기로 본다. 위기일 때는 공감 메시지를 더 조심스럽게 쓰도록 프롬프트에 지시한다.
- 테스트 (`fetch`를 가짜로 바꿔 실제 API는 부르지 않음): 1순위 성공, 1순위 시간 초과 → 2순위 성공, 1순위 잘못된 JSON → 2순위 성공, 둘 다 실패, 위기 키워드 감지

### 2-C. frontend-developer — 화면

- `docs/API.md` 형식의 **임시 데이터(mock)** 로 화면을 먼저 만든다.
  - 화면 전용 타입, mock 데이터, `/api/entries` 호출 함수는 `src/lib/client/**`에 둔다. (frontend-developer 담당 구역)
- 화면 구성
  - 로그인 화면: 앱 소개 한 줄과 "구글로 시작하기" 버튼
  - 오늘의 일기: 한 줄 입력창, 글자 수 표시, 저장 버튼 → 분석 중 표시 → 감정과 공감 메시지 카드
  - 위기 안내 상자: 공감 메시지와 함께 상담 연락처를 눈에 띄게, 전화 걸기 링크(`tel:`)로 보여 준다.
  - 지난 기록: 날짜별 목록, 감정 표시, 더 보기(페이지 나눔), 기록이 없을 때 안내
  - 일기 삭제: 삭제 버튼 → 확인을 받은 뒤 지움 → 목록에서 사라짐
  - 무료 AI 모델 안내 문구: 일기 쓰는 화면에 짧게 보여 준다. (문구는 `docs/PRD.md` F3)
  - 로딩·오류·빈 상태 화면
- 느낌: 종이 일기장처럼 따뜻한 색(크림·베이지 계열), 부드러운 글꼴, 넉넉한 여백, 둥근 모서리. 자극적인 빨강은 위기 안내에도 쓰지 않고, 차분하지만 눈에 띄게 만든다.
- 반응형(모바일 우선)과 접근성(키보드 조작, 포커스 표시, 레이블, 색 대비, 분석 결과가 나오면 스크린 리더가 읽도록 `aria-live`)을 챙긴다.

**산출물**: API 구현과 테스트, AI 모듈과 테스트, mock 데이터로 동작하는 화면

**완료 확인**

- [x] `npm run test`가 모두 통과한다. (백엔드 테스트, AI 모델 전환·위기 감지 테스트) (전체 310개 통과, 실제 DB·실제 API 확인용 7개는 기본 건너뜀)
- [x] `npm run build`와 `npm run lint`가 오류 없이 끝난다.
- [x] 각 에이전트가 자기 담당 구역 밖의 파일을 고치지 않았다. (`git status`와 `git diff --stat`으로 확인) (구역 밖 변경 0건, package.json·설정·docs 변경 없음)
- [x] AI 모듈을 실제 API로 한 번 불러 본 결과(성공한 모델 이름, 받은 JSON 형식)를 보고했다. 일기 원문이나 키는 로그에 남기지 않는다. (두 모델 모두 OpenRouter에 있음, 시험 문장 3개 모두 1순위 성공)
- [x] 화면을 모바일 폭(375px)과 데스크톱 폭에서 열어 보고, mock 데이터로 일기 쓰기, 결과 카드, 위기 안내 상자, 지난 기록, 빈 상태가 모두 보인다. (frontend-developer가 mock 미리보기로 확인)
- [x] 약속 변경 요청과 추가 의존성 요청을 정리했다. (없으면 "없음") (세 에이전트 모두 없음)

---

## 3단계 — 통합

**맡을 에이전트**: `backend-developer` → `frontend-developer` (순서대로)

**할 일**

1. 2단계에서 나온 추가 의존성과 약속 변경 요청을 처리한다. 약속을 바꾸면 `docs/API.md`를 고친다.
2. **backend-developer**: `POST /api/entries`에서 임시 `analyzeDiary` 대신 실제 AI 모듈을 부르게 연결한다.
   - 일기는 AI가 실패해도 저장한다. 분석 결과는 비워 두거나 "분석 실패"로 표시한다.
   - 위기 여부(`is_crisis`)를 함께 저장하고 응답에 담는다.
   - `analyzeDiary`가 예외를 던지면 지금은 위기 여부가 `false`가 된다. 그때도 `src/lib/ai/crisis.ts`의 `detectCrisis`로 키워드 검사를 해서 위기 안내를 지킨다. (2단계 backend 보고)
   - 시험 중 쌓인 행이 있으면 실제 AI 연결 전에 지운다.
3. **frontend-developer**: `src/lib/client/config.ts`의 `USE_MOCK_API`를 `false`로 바꿔 실제 API에 연결한다. 로그인·로그아웃 흐름과 `401` 응답 시 로그인 화면 이동을 연결한다.
4. 로컬에서 처음부터 끝까지 직접 써 본다. 구글 로그인은 **사용자가 직접** 한다. (에이전트는 비밀번호를 입력하지 않는다.)
5. 로컬에 커밋한다.

**산출물**: 로컬에서 끝까지 동작하는 앱

**완료 확인**

- [x] 로컬에서 구글 로그인 → 한 줄 일기 저장 → 감정과 공감 메시지 표시 → 지난 기록에 나타남 → 로그아웃까지 동작한다. (삭제도 확인)
- [x] 위기 표현이 들어간 시험 문장을 쓰면 공감 메시지와 상담 연락처가 함께 나온다.
- [x] `OPENROUTER_API_KEY`를 일부러 틀린 값으로 바꾼 상태(셸에서만 임시로)에서도 일기는 저장되고, 화면에 기본 위로 문구와 (위기일 때) 상담 연락처가 나온다.
- [x] DB의 `diary.entries`에 행이 쌓이고, `user_id`가 로그인한 계정의 ID와 같다.
- [x] 브라우저 개발자 도구의 네트워크 응답과 화면 코드(번들)에 `OPENROUTER_API_KEY`·`DATABASE_URL` 값이 없다. (번들 332개 파일과 로그인 전 서버 응답을 값 대조로 검사)
- [x] `npm run build`, `lint`, `test`가 모두 통과한다. (테스트 337개 통과, 실제 AI·DB를 부르는 9개는 기본 실행에서 건너뜀)
  - 개발 서버와 빌드를 함께 돌리던 중에는 화면 테스트 6개가 실패했다. 따로 다시 돌리면 모두 통과해서, 컴퓨터가 바빠 생긴 시간 초과로 보았다. 4단계에서 다시 보이면 원인을 따로 살핀다.

**3단계 시험에서 찾아 고친 것 (2026-11-05)**

- **user_id가 로그인마다 바뀜**: DB 어댑터가 없으면 Auth.js는 로그인할 때마다 `user.id`를 임의 UUID로 새로 만들고, 그 값이 `token.sub`가 된다. 다시 로그인하면 지난 일기가 보이지 않았다.
  - `src/auth-callbacks.ts`의 `jwt` 콜백이 로그인 순간 구글 계정 ID(`account.providerAccountId`)를 `sub`에 넣게 고쳤다.
  - 고치기 전에 저장된 시험 행 2개는 새 구글 계정 ID로 옮겼다.
- **로그인 오류 화면**: 로그인 시작 순간 서버에서 구글 설정 주소 연결이 잠깐 실패(`fetch failed`)하자, Auth.js 기본 오류 화면 "Server error"가 떴다.
  - 코드·설정 문제는 아니었고, 다시 시도하면 정상이었다.
  - `pages.error`를 `/login`으로 바꾸고, 로그인 화면에 "잠시 후 다시 시도해 주세요" 안내를 띄우게 했다. (`src/app/login/LoginError.tsx`)

**4·5단계로 넘기는 것**

- 4단계: 다른 구글 계정으로 로그인해 서로의 일기가 보이지 않는지 실제로 확인한다. (지금까지는 자동 테스트로만 확인)
- 5단계: 구글 OAuth 클라이언트에 배포 주소의 승인된 출처와 리디렉션 URI(`https://<배포 주소>/api/auth/callback/google`)를 추가한다.
- 틀린 키 시험은 `.env`를 건드리지 않고 셸에서만 키를 바꿔 서버를 띄운다. (Windows cmd 예: `set OPENROUTER_API_KEY=invalid-key-for-test&& npm run dev`)

---

## 4단계 — QA

**맡을 에이전트**: `qa-engineer` (검사와 보고) → 문제가 있으면 담당 개발 에이전트가 수정 → `qa-engineer` 재검사

`qa-engineer`는 파일을 고치는 도구가 없으므로, 보고 내용은 메인 Claude가 `docs/QA-REPORT.md`에 옮겨 적는다.

**점검 목록**

1. **PRD 대비 기능 시험**: 필수 기능(0단계에서 추가한 삭제 포함)의 완료 조건을 하나씩 확인한다.
2. **입력 경계값**: 빈 입력, 공백만, 최대 글자 수, 최대+1, 이모지, 줄바꿈, HTML·스크립트 문자열(화면에서 실행되지 않고 글자로만 보이는지)
3. **권한**
   - 로그인하지 않은 상태에서 API 호출 → `401`
   - 다른 `user_id`로 DB에 직접 넣은 시험 행을 id로 조회·삭제 → `404`, 목록에도 나오지 않고 행도 지워지지 않음
   - 요청 본문에 다른 `user_id`를 넣어도 무시됨
4. **AI 오류 처리**: 1순위 실패 → 2순위 전환, 둘 다 실패, 시간 초과, 이상한 JSON (자동 테스트와 코드 리뷰로 확인)
5. **위기 안내**: 여러 위기 표현에서 연락처가 나오는지, 평범한 문장에서 잘못 뜨지 않는지(예: "죽을 만큼 맛있었다" 같은 관용 표현은 결과를 기록하고 사용자와 기준을 정한다)
6. **보안 코드 리뷰**: 비밀 값 노출, SQL 인젝션, 프롬프트 인젝션(일기에 "이전 지시를 무시해" 같은 문장), `diary` 밖 스키마를 건드리는 코드가 없는지
7. **화면**: 모바일·데스크톱 레이아웃, 키보드만으로 쓰기·저장·기록 보기, 색 대비
8. `npm run build`, `lint`, `test` 실행 결과

**산출물**: `docs/QA-REPORT.md` (심각도 / 위치 / 문제 / 재현 방법 / 고칠 방법 제안)

- 2026-11-05 1차 검사: `qa-engineer`(haiku 모델)가 검사하고 보고만 했다. 코드는 고치지 않았다. 보고서는 사용자 요청에 따라 `docs/qa/haiku.md`에 저장했다. (높음 1, 중간 2, 낮음 9)
- 2026-11-05 2차 검사: `qa-engineer`(opus 모델)가 같은 조건으로 다시 검사했다. 보고서는 `docs/qa/opus.md`, 두 모델 비교는 `docs/qa/compare.md`. (높음 1, 중간 3, 낮음 9)
- 2026-11-05 높음 2건 수정: `ai-integration-specialist`가 `src/lib/ai/crisis.ts`, `crisis.test.ts`를 고쳤다("죽을 것 같다" 계열 추가, 긴 표현을 자모 단위로 비교). `qa-engineer`(opus) 재검사 결과 두 건 모두 해결됨. 다만 자모 비교 때문에 새 오탐(중간 1: "목 맨날", "세상을 떠났다" 등)과 새 미탐(낮음 1: "사라 버리다"), 테스트 보강(낮음 1)이 나왔다. 보고서는 `docs/qa/recheck-high.md`.
- 2026-11-05 1차 재검사 문제 수정: 위기 규칙을 두 목록으로 나눴다(음절 비교 `CRISIS_PHRASES`, 활용 어간만 자모 비교 `CRISIS_STEM_PHRASES`). `qa-engineer`(opus) 2차 재검사 결과 원래 높음 2건과 1차 재검사의 중간·낮음 1건씩 해결됨, 테스트 보강은 일부 해결. HEAD 대비 새 미탐은 0건(무작위 입력 20만 개 확인). 새로 나온 문제는 중간 1("고생을 끝냈다"가 "생을끝내"에 걸림), 낮음 3. 보고서는 `docs/qa/recheck-high-2.md`.

**완료 확인**

- [ ] 점검 목록 8개를 모두 확인했고, 확인한 내용이 보고서에 적혀 있다.
- [ ] 심각도 "높음"과 "중간" 문제가 모두 고쳐졌고, `qa-engineer`가 재검사해 확인했다.
- [ ] "낮음" 문제는 고쳤거나, 고치지 않기로 한 이유를 사용자와 정해 보고서에 적었다.
- [ ] `npm run build`, `lint`, `test`가 모두 통과한다.

---

## 5단계 — 배포

**맡을 에이전트**: `backend-developer`(배포 준비), `qa-engineer`(배포 후 점검), 메인 Claude(GitHub 올리기). 비밀 값 입력과 계정 연결은 **사용자가 직접** 한다.

**할 일**

1. **backend-developer — 배포 준비**
   - `README.md`에 앱 소개, 로컬 실행 방법, 필요한 환경 변수 이름, 마이그레이션 방법을 한국어로 적는다.
   - 배포 체크리스트를 만든다. (Vercel에 넣을 환경 변수 이름 5개, 구글 OAuth 리디렉션 주소)
2. **메인 Claude — GitHub 올리기** (사용자 승인 후)
   - 저장소는 이미 공개로 있으므로 새로 만들지 않는다. 그동안 로컬에 쌓은 커밋을 `origin`(`logistex/ai-empathy-diary-ch7`)의 `main`에 푸시한다.
   - 푸시 전에 `git ls-files`로 `.env`가 포함되지 않았는지 확인한다.
3. **사용자 직접 작업**
   - Vercel에서 GitHub 저장소를 가져와 프로젝트를 만든다.
   - Vercel 프로젝트 설정에 환경 변수 5개의 값을 입력한다.
   - Google Cloud Console의 OAuth 클라이언트에 승인된 리디렉션 주소 `https://<배포 주소>/api/auth/callback/google`을 추가한다.
4. 배포한 뒤 **qa-engineer**가 배포 주소를 점검하고, 로그인이 필요한 부분은 사용자가 직접 확인한다.

**산출물**: GitHub 저장소 `ai-empathy-diary-ch7`, Vercel 배포 주소, `README.md`

- 2026-11-06 배포 완료: 배포 주소는 <https://ai-empathy-diary-ch7.vercel.app>. 사용자가 Vercel 배포를 마치고, 배포 주소에서 구글 로그인과 일기 저장을 직접 확인했다. `README.md`(사용자·개발자 설명, 배포 주소)와 `CLAUDE.md`(개발 규칙과 주의할 점)는 메인 Claude가 썼다.

**완료 확인**

- [x] GitHub 저장소에 코드가 올라가 있고, `.env`는 없다. (`git ls-files`의 `.env*`는 `.env.example`뿐)
- [x] Vercel 빌드가 성공했다. (배포 주소가 응답함)
- [x] 배포 주소에서 구글 로그인 → 일기 쓰기 → 공감 메시지 → 지난 기록 보기가 동작한다. (사용자가 로그인과 일기 저장을 확인)
- [ ] 배포 주소에서 위기 표현 시험 문장을 쓰면 상담 연락처가 나온다. (아직 확인 안 함)
- [x] 로그인하지 않고 `/api/entries`를 부르면 `401`이 나온다. (메인 Claude가 `curl`로 확인: `/` → `/login` 307, `/login` 200, `/api/entries` 401)
- [ ] 배포 후 DB에서 `diary` 밖 스키마의 표 목록과 개수가 1단계 기록과 같다. (아직 확인 안 함. `npm run db:snapshot -- --compare before-001`)
- [ ] "진행 현황" 표의 모든 단계가 "완료"다. (4단계는 남은 QA 문제 때문에 "진행 중")

---

## 위험 요소와 대응

| 위험 | 대응 |
|---|---|
| 무료 모델이 없어지거나 느려짐 | 2순위 모델로 전환하고, 둘 다 실패해도 일기 저장과 위기 안내는 동작하게 한다. 모델 이름은 설정 한곳에서 바꾼다. |
| 무료 모델 제공자가 입력을 기록·학습에 쓸 수 있음 | 0단계에서 사용자가 받아들일지 정하고, 필요하면 화면에 안내 문구를 넣는다. |
| AI가 위기 표현을 놓침 | 서버 키워드 검사를 함께 쓰는 두 겹 감지로 줄인다. 4단계에서 여러 표현으로 시험한다. |
| 다른 스키마의 표가 바뀜 | 마이그레이션은 `diary` 스키마만 다루고, 실행 전에 SQL을 보여 주며, 전후로 표 목록을 비교한다. |
| 다른 사람의 일기가 보임 | 모든 쿼리에 세션의 `user_id` 조건을 서버에서 붙이고, 4단계에서 권한 시험을 한다. |
| 비밀 값 유출 | 저장소가 **공개**라서 한 번 푸시하면 누구나 볼 수 있고, 나중에 지워도 기록에 남는다. `.env`는 커밋하지 않고(이미 `.gitignore`에 있음), 비밀 값은 서버 코드에서만 쓴다. 단계마다 커밋 전에 `git status`로 확인하고, 푸시 전에는 `git ls-files`와 커밋 내용에 비밀 값이 없는지 한 번 더 확인한다. |
| 2단계 동시 작업 중 파일 충돌 | 파일 담당 구역을 나누고, 의존성 설치는 1단계와 3단계에서만 한다. |
