# AI 공감 다이어리

오늘 있었던 일을 한 줄로 쓰면 AI가 감정을 읽고, 공감하며 위로해 주는 일기 앱입니다.

**배포 주소: <https://ai-empathy-diary-ch7.vercel.app>**

- [사용자 설명](#사용자-설명)
- [개발자 설명](#개발자-설명)

---

## 사용자 설명

### 이런 앱이에요

- 일기를 길게 쓰지 않아도 돼요. **한 줄(200자까지)** 만 쓰면 됩니다.
- 저장하면 AI가 글에 담긴 **감정**(기쁨·슬픔·분노·불안·평온 중 하나)과 **강도**(1~5)를 알려 주고, 짧은 **공감 메시지**를 건네요.
- 내 일기는 **나만** 볼 수 있어요. 원하면 지울 수도 있어요.

### 쓰는 방법

1. 배포 주소에 들어가 **"구글로 시작하기"** 를 눌러 구글 계정으로 로그인해요. 따로 회원 가입이나 비밀번호는 없어요.
2. **오늘의 일기** 화면에서 오늘 있었던 일을 한 줄로 쓰고 **저장**을 눌러요.
   - 입력창 아래에 글자 수(예: 37/200)가 보여요. 비어 있거나 200자를 넘으면 저장되지 않아요.
   - 저장하는 동안 "분석 중"이 보여요. 보통 몇 초, 길면 40초쯤 걸려요.
3. 감정과 공감 메시지가 담긴 결과 카드가 나와요.
4. **지난 기록**에서 날짜별로 지난 일기와 그날의 감정을 볼 수 있어요. 일기를 펼치면 공감 메시지를 다시 볼 수 있고, **삭제** 버튼으로 지울 수 있어요.
   - 지운 일기는 되돌릴 수 없어요.
   - 일기 수정 기능은 없어요. 고치고 싶으면 지우고 다시 써 주세요.

### 힘든 마음을 적었을 때

일기에 자해나 극단적 선택 같은 표현이 있으면, 공감 메시지 위에 **상담 연락처 안내**가 함께 나와요. 번호를 누르면 바로 전화가 걸려요.

| 기관 | 번호 |
|---|---|
| 자살예방상담전화 | 109 |
| 정신건강위기상담 | 1577-0199 |
| 청소년상담 | 1388 |
| 응급 | 119 |

- AI가 잠시 동작하지 않아도 이 안내는 나오도록 만들었어요.
- 평범한 문장에도 안내가 뜰 때가 있어요. 놓치는 것보다 한 번 더 안내하는 쪽을 택했기 때문이에요.
- **이 앱은 진단이나 치료를 하지 않는 일기 앱이에요.** 힘든 마음이 계속되면 전문 상담을 받아 보세요. 지금 위험하다고 느껴지면 119에 연락해 주세요.

### 알아 두면 좋은 점

- **무료 AI 모델을 사용해요.** 모델 제공자가 입력한 내용을 기록하거나 학습에 사용할 수 있으니, 개인정보나 민감한 정보는 적지 않는 것이 좋아요. 이 안내는 일기 쓰는 화면에도 항상 보여요.
- AI 분석이 실패해도 일기는 저장돼요. 이때는 기본 위로 문구가 나오고, 지난 기록에는 감정이 "분석 안 됨"으로 표시돼요.
- 한국어로 쓰는 것을 기준으로 만들었어요.
- 키보드만으로도 쓰고, 저장하고, 지난 기록을 볼 수 있어요. 스크린 리더는 분석 결과가 나오면 읽어 줘요.

---

## 개발자 설명

### 기술 구성

| 구분 | 사용한 것 |
|---|---|
| 웹 프레임워크 | Next.js 16 (App Router, TypeScript), React 19 |
| 로그인 | Auth.js(`next-auth` v5) 구글 로그인, JWT 세션 (DB 어댑터 없음) |
| DB | Supabase Postgres, `postgres` 드라이버. 표는 `diary` 스키마 안에만 둔다. |
| AI | OpenRouter. 1순위 `nvidia/nemotron-3-ultra-550b-a55b:free`, 실패하면 2순위 `nvidia/nemotron-3.5-super-vl:free` |
| 검증 | `zod` |
| 테스트 | Vitest, Testing Library, jsdom |
| 배포 | Vercel (GitHub `main` 브랜치 연결) |

### 동작 방식

```
[브라우저] --POST /api/entries--> [Next.js API]
                                   1. 세션에서 user_id 확인 (없으면 401)
                                   2. 입력 검사 (빈 글, 200자 초과면 400)
                                   3. 위기 키워드 검사 (crisis.ts)
                                   4. OpenRouter 호출: 1순위 → 실패 시 2순위 (모델당 20초)
                                   5. 위기 여부 = 키워드 OR AI 판단
                                   6. diary.entries에 저장 (AI가 실패해도 저장)
                          <-- 감정, 강도, 공감 메시지, 위기 여부
```

- 모든 조회·저장·삭제에 세션의 `user_id` 조건을 서버에서 붙인다. 남의 일기 id로 요청하면 `404`가 나온다.
- `user_id`는 구글 계정 ID다. 로그인할 때 `jwt` 콜백이 이 값을 세션에 넣는다(`src/auth-callbacks.ts`).
- 위기 키워드 검사는 규칙을 세 목록으로 나눠 비교한다(`src/lib/ai/crisis.ts`). 자세한 규칙은 `CLAUDE.md`의 "위기 감지"를 본다.

### 폴더 구조

```
src/
  app/
    (app)/            로그인한 사용자 화면: 오늘의 일기(/), 지난 기록(/history)
    login/            로그인 화면
    api/entries/      일기 API (목록·저장, [id] 조회·삭제)
    api/auth/         Auth.js 경로
  components/         화면 부품 (diary, crisis, layout, ui)
  lib/
    ai/               AI 호출(openrouter.ts), 프롬프트, 응답 검증, 위기 감지, 설정(config.ts)
    db/               DB 연결과 일기 쿼리
    client/           브라우저 쪽 API 호출, 입력 검사, 날짜 표시
  auth.ts             Auth.js 설정
  proxy.ts            로그인하지 않은 사용자를 /login으로 보냄 (Next.js 16의 middleware 대신)
db/
  migrations/         마이그레이션 SQL (diary 스키마만)
  migrate.mjs         마이그레이션 실행
  guard.mjs           diary 밖 객체·DROP 등을 막는 검사
  snapshot.mjs        스키마별 표 목록 스냅샷과 비교 (읽기 전용)
docs/                 PRD, 계획, API 명세, 설정 안내, QA 보고서
```

### 환경 변수

프로젝트 루트의 `.env`에 아래 5개를 넣는다. 이름은 `.env.example`에 있다. **값은 절대 커밋하지 않는다.** (저장소는 공개다.)

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | Supabase Postgres 연결 주소. 코드는 트랜잭션 풀러(포트 6543)에 맞춰 prepared statement를 끄고 있어, Vercel에서도 그대로 쓸 수 있다. |
| `OPENROUTER_API_KEY` | OpenRouter API 키 (서버에서만 사용) |
| `AUTH_SECRET` | 세션 암호화 키 |
| `AUTH_GOOGLE_ID` | 구글 OAuth 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | 구글 OAuth 클라이언트 비밀 값 |

구글 OAuth 클라이언트와 `AUTH_SECRET`을 만드는 방법은 [docs/SETUP.md](docs/SETUP.md)에 있다.

### 로컬에서 실행하기

개발과 시험은 Node.js v24.17.0에서 했다.

1. 의존성을 설치한다.

   ```bash
   npm install
   ```

2. `.env`에 환경 변수 5개를 넣는다.
3. DB에 `diary` 스키마와 표를 만든다. (처음 한 번)

   ```bash
   npm run db:migrate
   ```

4. 개발 서버를 띄운다. 구글 리디렉션 주소가 3000번 포트로 등록되어 있으므로 **3000번 포트**에서 띄운다.

   ```bash
   npm run dev
   ```

5. <http://localhost:3000> 에 들어가 구글로 로그인한다.

### 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run build` | 배포용 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint 검사 |
| `npm test` | 테스트 실행. 실제 DB·AI를 부르는 테스트는 기본으로 건너뛴다. |
| `npm run db:migrate` | `db/migrations/`의 SQL 중 아직 적용하지 않은 것을 실행한다. `diary` 밖 객체는 만들지 않는다. |
| `npm run db:snapshot` | 스키마별 표 목록을 출력한다. `-- --out 이름`으로 저장하고 `-- --compare 이름`으로 비교한다. (읽기 전용) |

- `lint`, `test`, `build`는 하나씩 순서대로 실행한다. 동시에 돌리면 화면 테스트가 시간 초과로 실패할 수 있다.
- 실제 DB·AI 테스트는 `RUN_DB_TESTS=1`, `RUN_E2E=1`, `AI_LIVE_CHECK=1`을 줄 때만 돈다. DB에 시험 행을 쓰거나 실제 OpenRouter를 부르므로 필요할 때만 쓴다.

### DB 주의

- 같은 Supabase DB를 다른 프로젝트도 쓴다. 이 앱의 표는 **`diary` 스키마 안에만** 만들고, 다른 스키마는 건드리지 않는다.
- 마이그레이션을 실행하기 전후로 다른 스키마의 표가 그대로인지 확인한다.

  ```bash
  npm run db:snapshot -- --out before-002
  npm run db:migrate
  npm run db:snapshot -- --compare before-002
  ```

- Auth.js DB 어댑터를 붙이지 않는다. 붙이면 `diary` 밖에 `users` 같은 표가 생긴다.

### API

로그인한 사용자만 부를 수 있다. 로그인하지 않으면 `401`이다. 자세한 요청·응답 형식은 [docs/API.md](docs/API.md)에 있다.

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| `POST` | `/api/entries` | 일기 저장과 분석 결과 반환 |
| `GET` | `/api/entries?cursor=...&limit=...` | 내 일기 목록 (최신순, 기본 20개씩) |
| `GET` | `/api/entries/[id]` | 내 일기 하나 (남의 일기는 `404`) |
| `DELETE` | `/api/entries/[id]` | 내 일기 삭제 (남의 일기는 `404`) |

### 배포 (Vercel)

1. Vercel에서 GitHub 저장소 `logistex/ai-empathy-diary-ch7`를 가져와 프로젝트를 만든다. (Vercel의 GitHub 연동을 쓰면 `main`에 푸시할 때 다시 배포된다.)
2. Vercel 프로젝트 설정의 환경 변수에 위 5개를 넣는다.
3. Google Cloud Console의 OAuth 클라이언트에 배포 주소를 추가한다.
   - 승인된 자바스크립트 원본: `https://ai-empathy-diary-ch7.vercel.app`
   - 승인된 리디렉션 URI: `https://ai-empathy-diary-ch7.vercel.app/api/auth/callback/google`

### 알려진 문제

4단계 QA에서 남은 문제는 [docs/qa/recheck-high-2.md](docs/qa/recheck-high-2.md)에 있다.

- 위기 키워드 오탐: "드디어 고생을 끝냈다", "술이 몸을 해친다" 같은 일상 문장에도 상담 안내가 뜬다.
- "목을 맬까", "세상을 떠날까" 같은 일부 활용형은 키워드 검사가 놓친다. 이때는 AI 판단에 기댄다.
- 그 밖에 1차 QA의 중간·낮음 문제는 [docs/qa/opus.md](docs/qa/opus.md)와 [docs/qa/haiku.md](docs/qa/haiku.md)에 있다.

### 문서

| 문서 | 내용 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 제품 요구사항, 기능별 완료 조건, 성공 기준 |
| [docs/PLAN.md](docs/PLAN.md) | 단계별 계획과 진행 이력 |
| [docs/API.md](docs/API.md) | API 명세 |
| [docs/SETUP.md](docs/SETUP.md) | 구글 로그인 준비 방법 |
| [docs/qa/](docs/qa/) | QA 보고서와 재검사 기록 |
| [CLAUDE.md](CLAUDE.md) | 개발 규칙과 주의할 점 |
