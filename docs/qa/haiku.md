# 4단계 QA 보고서 (qa-engineer / haiku)
- 날짜: 2026-11-05
- 대상 커밋: e8acfd1 (main, 작업 트리 변경 없음. 이 QA에서 소스·설정·문서·DB를 바꾸지 않았다.)

## 요약

높음 1건, 중간 2건, 낮음 9건을 찾았다. 가장 중요한 문제는 위기 키워드 검사가 필수 위기 문장 "힘들어 죽을 것 같다"를 놓친다는 점이다. 직접 실행해서 재현했다. 이 때문에 PRD S2(서버 키워드 단독 100%)를 충족하지 못하고, 두 모델이 모두 실패한 상황에서는 이 문장에 상담 연락처가 나오지 않는다. 기존 테스트(`crisis.test.ts:135`)는 이 문장을 "현재 false, 4단계에서 재검토"로 기록해 두어서 테스트는 통과하고 있다.

일상 문장 오탐도 확인했다. "숙제를 빨리 끝내고 싶다", "오늘 회의 끝내고 싶다", "할머니가 세상을 떠나셨다", "죽고 싶지는 않다"가 위기로 걸린다. 이는 PRD 방침(놓치는 것보다 잘못 띄우는 쪽)에 따른 의도된 동작이다. 그래도 PRD F5-10에 따라 4단계에서 사용자와 기준을 정해야 한다.

권한 쪽은 로그인 없는 요청으로 401을 실측했고, SQL 4개 모두 `user_id` 조건이 있음을 확인했다. 클라이언트 번들과 로그인 응답에서 비밀 값 형식은 찾지 못했다. `diary` 밖 스키마는 `before-001` 비교에서 변화가 없었다. lint, test, build는 모두 통과했다.

4단계 완료 조건(높음·중간 문제가 고쳐지고 재검사)은 아직 충족되지 않았다.

PRD 성공 기준(2.2) 현황:

| 기준 | 상태 |
|---|---|
| S1 응답 시간 | 확인 못 함. 실제 AI 호출 금지 조건 |
| S2 키워드 단독 100% | 미달. 필수 위기 문장 7개 중 6개만 감지 (H1) |
| S3 두 겹 100% | 확인 못 함. AI 실측 불가. 키워드가 놓친 문장은 AI가 실패하면 놓친다 (H1) |
| S4 평범한 문장 오탐 기록 | 기록 완료 (아래 위기 문장 표). 사용자 결정 필요 (M1) |
| S5 AI 실패 시 저장 10건 | 확인 못 함. DB 쓰기 금지. 코드와 자동 테스트로는 충족 |
| S6 노출·삭제 0건 | 무로그인 401 실측. 나머지는 코드와 자동 테스트. 두 계정 교차 시험은 확인 못 함 |
| S7 비밀 값 노출 0건 | 값 형식 검사 통과. 실제 값과의 대조는 확인 못 함 (.env 열람 금지) |
| S8 `diary` 밖 스키마 보존 | 통과 (`db:snapshot -- --compare before-001`) |
| S9 build·lint·test | 통과 |
| S10 핵심 흐름 | 확인 못 함. 구글 로그인이 필요하고 사용자가 직접 해야 함 |
| S11 무료 모델 안내 문구 | 코드와 테스트로 확인. 실제 화면은 확인 못 함 |

권장 처리 순서: H1 수정과 자동 테스트 기록 갱신 → M1 기준을 사용자와 결정 → M2 실제 브라우저 확인 → 낮음 항목은 고치거나 고치지 않는 이유를 기록.

## 발견한 문제 (심각한 순)

### [높음] 위기 키워드 검사가 "죽을 것 같다" 계열을 놓친다 (PRD S2 미달)
- 위치: `C:\Users\logistex\Study_05_01\src\lib\ai\crisis.ts:38-48` (CRISIS_PHRASES. "죽을까"(48행) 다음에 "죽을 것 같다" 계열 항목이 없다). 기록 위치: `C:\Users\logistex\Study_05_01\src\lib\ai\crisis.test.ts:135`
- 문제: 키워드 규칙에 "죽을 것 같다" 형태가 없다. 필수 위기 문장 "힘들어 죽을 것 같다"가 `false`로 나온다. 두 모델이 모두 실패하면 키워드 결과만 남으므로(`index.ts:61, 96` → `entry.ts:91`) 위기 연락처가 나오지 않는다. 기존 테스트는 이 결과를 정답으로 고정해 두었다.
- 재현 방법: `detectCrisis("힘들어 죽을 것 같다")` 직접 실행 → `isCrisis: false`, `matched: []`. 같은 결과: "힘들어서 죽을 것 같아", "죽을 것만 같다", "죽을 것 같아요". (재현함)
- 고칠 방법 제안: `crisis.ts`의 48행("죽을까") 아래에 "죽을것같", "죽을거같"을 추가한다. 공백과 문장부호를 지운 뒤 비교하므로 띄어쓰기 변형이 모두 걸린다. 부작용: "죽을 것 같이 바빴다" 같은 관용 문장도 걸리게 된다(현재 `false`). 이 기준은 사용자와 함께 정한다. `crisis.test.ts:135`의 기록을 위기 목록으로 옮기고 `current`를 `true`로 바꾼다. 수정 후에는 AI 실패 상태(키를 틀리게 한 상태)에서도 이 문장이 연락처를 띄우는지 다시 본다.
- 확인 수준: 재현함 (키워드 검사 직접 실행). AI 판단 쪽은 확인 못 함.

### [중간] 일상 문장 오탐: 필수 비위기 문장 6개 중 4개가 위기로 걸린다 (사용자 기준 결정 필요)
- 위치: `C:\Users\logistex\Study_05_01\src\lib\ai\crisis.ts:40`(죽고싶, 부정문도 걸림), `:92`(끝내고싶), `:106`(세상을떠나), `:154`(약을다먹), `:103`(내가없어), `:48`(죽을까). 기록 위치: `C:\Users\logistex\Study_05_01\src\lib\ai\crisis.test.ts:141-144`
- 문제: 다음 필수 비위기 문장이 위기로 판정된다.
  - "숙제를 빨리 끝내고 싶다" (끝내고싶)
  - "오늘 회의 끝내고 싶다" (끝내고싶)
  - "할머니가 세상을 떠나셨다" (세상을떠나)
  - "죽고 싶지는 않다" (죽고싶, 부정문)
  - 추가 확인: "약을 다 먹었더니 나았다"(약을다먹), "내가 없어서 다들 힘들었겠다"(내가없어), "점심 메뉴로 죽을까 고민했다"(죽을까, 음식 '죽'과 겹침), "자살 예방 교육을 들었다"(자살 단어)도 걸린다.
  현재 방침에 따른 의도된 동작이다. 그래도 PRD 8.1의 "위기 안내가 잘못 뜸" 위험에 해당하므로 4단계 종료 전 사용자와 기준을 정해야 한다.
- 재현 방법: 위 문장들을 `detectCrisis`에 넣어 직접 실행. (재현함)
- 고칠 방법 제안 (사용자와 결정한 뒤 적용):
  1. "끝내고싶"을 "다끝내고싶", "삶을끝내고싶"처럼 대상이 드러난 형태로 좁힌다. 문자열 기준으로 보면 "다 끝내고 싶어"는 계속 걸리고, "숙제를 빨리 끝내고 싶다"와 "오늘 회의 끝내고 싶다"는 걸리지 않는다. 적용 후 재검사가 필요하다.
  2. "세상을떠나"는 "세상을떠나고싶" 등으로 좁힌다.
  3. "죽고싶" 부정형(죽고 싶지 않다)을 예외로 할지 사용자와 정한다. 현재는 부정 처리를 하지 않는 방침이다.
  4. "약을다먹", "내가없어", "죽을까"는 위기 의도 표현이 함께 있을 때만 걸리도록 바꾸는 방안을 검토한다.
  바꾼 뒤에는 `crisis.test.ts`의 기록을 함께 고친다.
- 확인 수준: 재현함.

### [중간] 로그아웃 뒤 뒤로 가기로 지난 기록이 보일 가능성 (PRD F1-4)
- 위치: `C:\Users\logistex\Study_05_01\src\components\diary\HistoryList.tsx:91-108` (목록을 마운트 때 한 번 가져오고, 페이지 복원 시 다시 가져오지 않는다). `C:\Users\logistex\Study_05_01\src\app\(app)\layout.tsx:10-19`. `/history`는 정적으로 미리 만들어진다(빌드 결과 `○`).
- 문제: 일기 내용은 React 상태에만 있다. 브라우저가 페이지를 뒤로 가기 캐시(bfcache)에 두면 로그아웃 뒤 뒤로 가기에서 이전 목록이 그대로 보일 수 있다. 보호 화면 응답에 `no-store`가 붙는지는 로그인 없이 확인할 수 없었다. 서버 데이터 노출은 아니다. 새 요청은 401이 된다.
- 재현 방법: 실제 브라우저에서 구글 로그인 → 지난 기록에서 항목 펼침 → 로그아웃 → 뒤로 가기. 브라우저 도구가 없어 재현하지 못했다. (가능성)
- 고칠 방법 제안: 페이지에 `pageshow` 리스너를 두고 `event.persisted`가 `true`이면 목록을 다시 불러오거나 페이지를 다시 로드한다. 또는 보호 화면을 동적으로 렌더링해 응답에 `no-store`가 붙게 한다. 사용자 브라우저에서 로그아웃 후 뒤로 가기 시험을 한다.
- 확인 수준: 가능성.

### [낮음] 공감 메시지 검증이 PRD(2~4문장, 약 200자)보다 느슨함
- 위치: `C:\Users\logistex\Study_05_01\src\lib\ai\schema.ts:28-34` (EMPATHY_MIN_SENTENCES=1, EMPATHY_MAX_SENTENCES=6, EMPATHY_MAX_CHARS=400)
- 문제: PRD F3 완료 조건 3("2~4문장")과 API.md 2절과 다르다. 실제로는 1문장, 5~6문장, 400자까지 통과한다. 프롬프트(`prompts.ts`)는 2~4문장, 200자를 요구하므로 준수 여부가 프롬프트에만 기대고 있다. 코드 주석에 의도된 완화라고 적혀 있고, `schema.test.ts:87`에 이 동작이 테스트로 고정되어 있다.
- 재현 방법: 코드와 테스트 확인. ("1문장도, 5~6문장도 버리지 않는다" 테스트 통과)
- 고칠 방법 제안: 사용자가 완화를 인정하면 PRD와 API.md에 "1~6문장, 400자 이하 허용"을 명시한다. 엄격하게 하려면 상한을 4문장으로 두고, 실패 시 2순위로 넘어가는 비용을 감수할지 정한다.
- 확인 수준: 코드로 확인.

### [낮음] NUL 문자가 있는 입력: 화면은 통과시키고 서버는 거절
- 위치: `C:\Users\logistex\Study_05_01\src\app\api\_lib\validation.ts:45-47` (서버 NUL 검사). `C:\Users\logistex\Study_05_01\src\lib\client\validation.ts:24-35` (화면 검사에 NUL 검사가 없음)
- 문제: 화면 검사는 통과시키고 저장 요청이 나간다. 서버는 400(`invalid_type`, "요청 형식이 올바르지 않아요.")을 준다. 화면에는 "요청 형식이 올바르지 않아요. 쓴 내용은 그대로 남아 있어요."가 나와 사용자가 이유를 알기 어렵다.
- 재현 방법: `validateDiaryContent("안녕\u0000하세요")`는 `ok`, `parseCreateBody`는 `invalid_type`. (재현함)
- 고칠 방법 제안: 화면 검사에도 같은 규칙을 넣고, 구체적인 안내 문구를 쓴다.
- 확인 수준: 재현함.

### [낮음] 보이지 않는 문자만 쓴 입력이 저장됨
- 위치: `C:\Users\logistex\Study_05_01\src\app\api\_lib\validation.ts:39-51`, `C:\Users\logistex\Study_05_01\src\lib\client\validation.ts:24-25`
- 문제: 제로폭 공백(U+200B)만 있는 입력은 빈 입력으로 막히지 않고 저장된다. PRD F2-2("공백이나 줄바꿈만 입력한 경우도 저장되지 않는다")의 취지와 어긋난다. DB의 `'^\s*$'` 검사도 이를 막지 못한다.
- 재현 방법: `parseCreateBody({content:"\u200b"})`는 `ok`, `validateDiaryContent("\u200b")`도 `ok`. (재현함)
- 고칠 방법 제안: `trim()` 뒤에 보이지 않는 문자(유니코드 Cf 범주 등)를 지운 값으로 빈 입력을 판정한다. 서버, 화면, DB 조건을 같은 규칙으로 맞춘다.
- 확인 수준: 재현함.

### [낮음] 결합 이모지의 글자 수가 "이모지 하나 = 1자"와 다름
- 위치: `C:\Users\logistex\Study_05_01\src\app\api\_lib\validation.ts:48`, `C:\Users\logistex\Study_05_01\src\lib\client\validation.ts:11-14`
- 문제: 가족 이모지(👨‍👩‍👧)는 1개인데 5자로 센다. 국기(🇰🇷)는 2자다. 서버, 화면, DB `char_length`는 모두 코드 포인트 기준이라 서로는 일치한다. 그러나 API.md 5.1은 "이모지 하나 = 1자"와 `Array.from`을 함께 적고 있어 ZWJ 이모지에서 두 기준이 어긋난다. 이모지 40개(가족 이모지)는 200자로 통과하고 저장 길이는 320(UTF-16)이다.
- 재현 방법: `"👨‍👩‍👧".repeat(40)`은 화면과 서버 모두 200자로 판정되어 통과. (재현함)
- 고칠 방법 제안: 기준을 사용자와 정한다. 체감 기준으로 맞추려면 `Intl.Segmenter`로 세고 DB CHECK도 같은 기준으로 바꿔야 한다. 코드 포인트 기준을 유지하면 API.md 문구를 "코드 포인트 기준"으로 고친다.
- 확인 수준: 재현함.

### [낮음] 글자 수 초과를 입력 단계에서 막지 않음
- 위치: `C:\Users\logistex\Study_05_01\src\components\diary\DiaryForm.tsx:140-154` (textarea에 `maxLength` 없음), `:76-79`
- 문제: 201자 이상도 입력된다. 글자 수가 빨갛게 바뀌고 저장 시점에만 막힌다. PRD F2-3 "201자부터는 막히며"를 "입력 자체가 막힌다"로 읽으면 어긋난다. 서버 검사(400)와 저장 차단은 동작한다.
- 재현 방법: 코드 확인. 브라우저 입력은 확인 못 함.
- 고칠 방법 제안: 해석을 사용자와 확정한다. 입력을 막는다면 `maxLength`보다 `onChange`에서 잘라내는 방식이 서로게이트와 결합 문자 때문에 안전하다.
- 확인 수준: 코드로 확인.

### [낮음] 요청 본문을 다 읽은 뒤에 크기를 확인함
- 위치: `C:\Users\logistex\Study_05_01\src\app\api\_lib\validation.ts:83-90` (`request.text()` 후에 `parseJsonText`가 길이를 확인, `:71-73`)
- 문제: 64KB 제한이 본문 전체를 메모리에 읽은 뒤 적용된다. 플랫폼의 본문 크기 제한에 기대는 구조다.
- 고칠 방법 제안: `Content-Length`가 크면 읽기 전에 거절하고, 스트림으로 상한까지만 읽는다.
- 확인 수준: 코드로 확인.

### [낮음] 보안 헤더가 없음
- 위치: `C:\Users\logistex\Study_05_01\next.config.ts:1-9` (headers 설정 없음)
- 문제: `/login` 응답에 `Cache-Control: no-store`만 있다. `X-Frame-Options`(또는 CSP `frame-ancestors`), `X-Content-Type-Options`, `Referrer-Policy`가 없다. 다른 사이트의 iframe에 앱을 끼우는 클릭재킹 가능성이 있다.
- 재현 방법: `curl -sI http://localhost:3000/login`으로 응답 헤더 확인. (재현함)
- 고칠 방법 제안: `next.config.ts`의 `headers()`에 `X-Frame-Options: DENY`(또는 `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`을 추가한다. CSP는 Next의 인라인 스크립트 때문에 별도 검증이 필요하다.
- 확인 수준: 재현함.

### [낮음] AI 응답의 `isCrisis` 누락이 false로 처리됨 (AI만 감지하는 위기에 대한 의존)
- 위치: `C:\Users\logistex\Study_05_01\src\lib\ai\schema.ts:70-78, :110` (`booleanLike`: 값이 없으면 false)
- 문제: 모델이 `isCrisis`를 빼먹으면 false다. 키워드에 걸리지 않은 위기는 AI 판단에만 의존한다. 일기 안의 지시문이 모델 판단을 바꿔 false를 유도할 가능성도 있다. 키워드 OR 구조가 일부를 막는다.
- 재현 방법: 실제 모델 응답이 없어 확인 못 함. 스키마 테스트 "isCrisis가 없으면 false"로 동작은 고정되어 있다.
- 고칠 방법 제안: "잘못 띄우는 쪽" 방침에 맞춰 `isCrisis` 누락을 true로 볼지 검토한다. H1, M1의 키워드 보강과 함께 본다.
- 확인 수준: 가능성.

### [낮음] 저장 실패 후 재시도로 같은 일기가 두 번 저장될 가능성
- 위치: `C:\Users\logistex\Study_05_01\src\components\diary\DiaryForm.tsx:101-118`, `C:\Users\logistex\Study_05_01\src\lib\client\http-api.ts:83-109`
- 문제: 서버는 저장했지만 응답이 끊기면 화면은 실패로 보고 글을 남긴다. 사용자가 다시 저장하면 같은 일기가 두 건이 된다. 중복 방지 키가 없다.
- 재현 방법: 네트워크를 끊는 시험은 DB 쓰기가 필요해 실행하지 않았다. 코드 확인.
- 고칠 방법 제안: 화면이 요청마다 id를 만들어 보내고 서버가 같은 id의 중복을 막는다. 또는 실패 안내에 "이미 저장되었을 수 있어요. 목록을 먼저 확인해 주세요."를 덧붙인다.
- 확인 수준: 가능성.

## 점검 목록별 결과 (1~8)

확인 못 한 항목의 공통 사유: (a) 브라우저 도구가 없어 화면 실측을 못 했다. (b) 로그인이 필요한 API 실측은 금지 조건(로그인 흉내 금지, POST·DELETE 금지)으로 할 수 없었다. (c) DB를 바꾸는 시험(`RUN_E2E=1`, `RUN_DB_TESTS=1`, `db:migrate`)은 금지되어 실행하지 않았다. (d) 실제 OpenRouter 호출(`AI_LIVE_CHECK=1`)은 실행하지 않았다. (e) `.env` 값은 열람 금지라 값 대조를 하지 않았다.

### 1. PRD 대비 기능 시험 (F1~F7)
방법: 완료 조건을 하나씩 대조했다. 무로그인 curl, `npm test`(337개 통과), 코드 리뷰, 노드 직접 실행을 썼다.
- F1 로그인: 1 통과. 무로그인 `/`는 307로 `/login`, `/history`는 307로 `/login?callbackUrl=%2Fhistory`. 2 통과(`login/page.tsx`에 소개 문장과 "구글로 시작하기"). 3 통과(코드: `signIn("google", { redirectTo: "/" })`). 4 확인 못 함(뒤로 가기 캐시, M2). 로그아웃 리다이렉트 `/login`은 `SignOutButton.tsx:15`에서 확인. 5 통과(curl 401). 6 통과(스냅샷 비교). 7 해당 없음(에이전트는 로그인하지 않음).
- F2 쓰기: 1~4 통과(화면 검사, 글자 수 "n/200", 자동 테스트). 5 서버 검사 통과(노드 직접 실행으로 201자 `too_long`). API 자체 호출은 로그인 필요라 확인 못 함. 6 통과(`submittingRef`, `aria-disabled`, "분석 중…"). 7 통과(이모지·줄바꿈 저장, 직접 실행). 8 통과(React 기본 출력, `dangerouslySetInnerHTML` 없음). 9 통과(코드와 `route.test.ts` "분석 실패: 일기는 저장"). 10 통과(횟수 제한 코드 없음).
- F3 분석: 1 통과(`EntryResult.tsx`). 2 통과(감정 enum 5개). 3 부분 통과(L1). 4 통과(`MODEL_CHAIN`과 `modelUsed`, `index.test.ts`의 1순위·2순위 테스트). 5 통과(실패 시 기본 위로 문구, `EmpathyText.tsx:12-15`). 6 통과(`DiaryForm.tsx:186` `aria-live="polite"`). 7 통과(번들 패턴 검사). 8 통과(무료 모델 안내 `DiaryForm.tsx:174`, 저장 버튼 `:178-180`보다 위). 9 통과(닫는 버튼 없음, 결과 후에도 유지, 테스트). 10 확인 못 함(375px 실측). 11 통과(`aria-describedby`, 대비 12.11). 12 코드로 통과(위기 상자는 결과 카드 위, 안내 문구는 폼 안에 그대로). 실제 겹침은 확인 못 함.
- F4 지난 기록: 1~7 코드와 테스트로 통과(정렬 SQL `ORDER BY created_at DESC, id DESC`, 날짜별 묶기, 펼치기, 20개씩 더 보기, 빈 상태 `HistoryList.tsx:231`, 로딩·오류 구분 `:203-223`, "분석 안 됨" `EmotionBadge.tsx:26`). 8 새 일기가 맨 위에 나타남: 페이지 이동 때 다시 가져오는 구조라 코드상 가능. 실제 확인 못 함.
- F5 위기: 4와 8 미달(H1). 나머지는 항목 5 참조.
- F6 내 일기만: 1 통과(401 실측). 2 코드와 테스트 통과(남의 일기와 없는 일기가 같은 404). 3 통과(`entries.ts:75, 85` `WHERE user_id`). 4 통과(본문 `userId` 무시, 직접 실행: `{"content":"ok","userId":"evil",...}` → `{"content":"ok"}`). 5 통과(SQL 4개 모두 바인딩과 `diary.` 접두어). 6 통과(스냅샷). 7 통과(삭제 테스트).
- F7 삭제: 1 통과(삭제 버튼은 항목을 펼친 뒤 보임, `HistoryList.tsx:297`). 2 통과(확인 문구, 취소 버튼). 3 통과(목록에서 즉시 제거, `removeFromList`). 4 SQL은 `DELETE FROM diary.entries WHERE id AND user_id`로 확인. 실제 행 삭제는 DB 쓰기 금지라 확인 못 함. 5 통과(재삭제 404 테스트). 6 통과(401). 7 통과(404, 권한 조건, 테스트). 8 통과(본문·주소의 `user_id` 무시 테스트). 9 통과(실패 시 유지와 안내, 테스트). 10 통과(위기·분석 실패 일기도 삭제, 테스트). 11 코드로 통과(`role="alertdialog"`, 포커스 이동과 복귀, Esc, Tab 가두기). 스크린 리더 낭독은 확인 못 함. 12 통과(로그에 원문 없음).

### 2. 입력 경계값
방법: 서버 검사 함수(`validation.ts`)와 화면 검사 함수(`client/validation.ts`)를 같은 입력으로 노드에서 직접 실행했다. 파일은 만들지 않고 표준 입력으로 실행했다.

| 입력 | 서버 | 화면 | 판정 |
|---|---|---|---|
| 빈 문자열, 공백만, 줄바꿈만, 탭과 공백 | 400 empty | 차단 empty | 일치 |
| 전각 공백(U+3000)만, NBSP만 | 400 empty | 차단 | 일치 |
| 1자 | 통과 | 통과 | 일치 |
| 한글 200자 / 이모지 200개 | 통과 (이모지 200개는 UTF-16 400) | 200 | 일치 |
| 한글 201자 / 이모지 201개 | 400 too_long | 차단 too_long | 일치 |
| 앞뒤 공백 포함 (내용 198자) | 통과 198자 | 198 | 일치 |
| 줄바꿈 포함 (`"a\n"` 100개) | 통과 199자 | 199 | 일치 |
| NUL 포함 | 400 invalid_type | 통과 | 불일치 (L2) |
| U+200B만 | 통과 | 통과 | 둘 다 저장됨 (L3) |
| 결합 이모지 40개(200 코드 포인트) | 통과 | 200 | 일치, 문구와 차이 (L4) |
| `<script>alert(1)</script>`, `<img src=x onerror=...>`, SQL 조각 | 저장 | 글자로 표시 | 통과 |
| 본문에 `userId`, `emotion`, `isCrisis` 추가 | 무시 | - | 통과 |
| 잘못된 JSON, `content`가 숫자·null·배열·없음 | 400 invalid_type | - | 통과 |
| 본문 64KB 초과 | 400 | - | 통과 (L6) |

- 서버와 화면 기준: 둘 다 `trim()` 뒤 `Array.from` 길이로 센다. 일치한다. DB는 `char_length`(코드 포인트)와 `'^\s*$'`로 2차 방어를 한다.
- HTML 실행 여부: `dangerouslySetInnerHTML`, `innerHTML`, `eval`이 소스에 없다. 일기 원문은 `{entry.content}`로 출력한다(`HistoryList.tsx:274`, `EmpathyText.tsx:17`). 실제 렌더링 확인은 못 했다.
- 확인 못 함: 로그인 없이는 201자 요청도 401이 먼저 나온다. 401이 입력 검사보다 먼저인 것은 `route.test.ts`의 "401은 입력 검증(400)보다 먼저다"로 확인했다.

### 3. 권한
- 무로그인 실측 (모두 JSON 401, `Cache-Control: no-store`):
  - `GET /api/entries` → 401
  - `POST /api/entries` → 401
  - `GET /api/entries/0b6f2c1e-...` → 401
  - `DELETE /api/entries/0b6f2c1e-...` → 401
  - `GET /api/entries?limit=abc` → 401 (검사보다 먼저)
  - `GET /api/entries/not-a-uuid` → 401
  - `GET /api/auth/session` → 200, 본문 `null`
- 남의 일기 404, 목록 제외, 본문 `user_id` 무시: 실제 DB에 시험 행을 넣는 것은 금지라 실행하지 않았다. 대신 다음으로 확인했다.
  - 자동 테스트 통과: `route.test.ts`(목록, 상세, 삭제 모두 남의 일기는 404 또는 제외), `[id]/route.test.ts`(주소의 `userId`도 무시).
  - SQL 리뷰: `C:\Users\logistex\Study_05_01\src\lib\db\entries.ts`의 쿼리 4개 모두 `user_id` 조건이 있다. `insertEntry`는 세션에서 받은 값을 넣고(`:49-53`), `listEntries`는 `:75, :85`, `findEntry`는 `:101`, `deleteEntry`는 `:114`다.
  - 출처 확인: 모든 API 핸들러가 `getSessionUserId()`만 쓴다(`route.ts:27, :60`, `[id]/route.ts:25, :42`).
- 확인 못 함: 두 구글 계정으로 교차 확인(3단계에서 4단계로 넘긴 항목). 사용자가 직접 해야 한다.

### 4. AI 오류 처리
방법: 코드 리뷰와 자동 테스트. 실제 모델 호출은 하지 않았다.
- 1순위 실패 → 2순위: `index.ts:68-90`. 테스트 `index.test.ts:155-272`(시간 초과, 429, 5xx, 네트워크, HTTP 200인데 본문에 error, 빈 응답, 잘못된 JSON, 스키마 위반)가 모두 통과한다.
- 둘 다 실패: 예외 없이 `{status:"failed", isCrisis: keywordCrisis}`를 돌려준다(`index.ts:96`). 테스트 `index.test.ts:274-`.
- 시간 초과: 모델당 20초 `AbortController`이고 본문 읽기까지 포함한다(`openrouter.ts:84-125`). 최악의 경우 40초 + DB 시간이며, 라우트 `maxDuration`은 60초다(`route.ts:22`). 클라이언트 `fetch`에는 시간 제한이 없다(설계).
- 이상한 JSON: `parseModelOutput`이 `empty`, `invalid_json`, `schema_mismatch`를 구분한다. `schema.test.ts` 통과.
- 라우트 보호: `analyzeDiary` 예외도 `try/catch`로 잡고(`route.ts:43-47`) 저장은 항상 진행한다. 테스트 "analyzeDiary가 예외를 던져도 일기는 저장하고 201 failed로 응답한다" 통과.
- 로그: `index.ts`의 로그 3곳은 모델 이름, 오류 종류, 상태 코드만 남긴다. 테스트 `index.test.ts:373-`에서 원문과 키가 없음을 확인한다.
- 확인 못 함: 실제 OpenRouter 호출, 틀린 키 실측, 실제 모델 응답과 시간 측정(S1). `AI_LIVE_CHECK`와 `RUN_E2E`는 금지 조건이라 실행하지 않았다.

### 5. 위기 안내
- 키워드 결과: 아래 "위기 문장 시험 결과 표" 참고.
- AI 판단과 키워드 판단의 합치기는 OR이다.
  - AI 성공: `isCrisis: keywordCrisis || parsed.data.isCrisis` (`index.ts:87`).
  - AI 실패 또는 예외: `{status:"failed", isCrisis: keywordCrisis}` (`index.ts:61, :96`). 라우트에서는 `result?.isCrisis === true || fallbackCrisisCheck(content)` (`entry.ts:91`)이라 키워드 결과를 낮추지 않는다.
  - 따라서 키워드가 놓친 문장(H1)은 AI도 실패하면 연락처가 나오지 않는다.
- 연락처와 tel 링크: `C:\Users\logistex\Study_05_01\src\components\crisis\crisis-config.ts:30-33`의 번호는 109, 1577-0199, 1388, 119로 PRD F5 표와 일치한다. `CrisisBox.tsx:26-31`의 링크는 `tel:109`, `tel:15770199`, `tel:1388`, `tel:119`다. `CrisisBox.test.tsx:23`이 통과한다. 실제 화면 확인은 못 했다.
- 문구: 위기 안내 문구와 "의료 서비스 아님" 문구가 PRD와 글자 단위로 같다(`crisis-config.ts:9-14`). 상자는 청록 계열이고 빨강을 쓰지 않는다(`globals.css:39-43`). 상자는 결과 카드보다 위에 있다(`EntryResult.tsx:21-26`). 맨 아래에 "의료 서비스 아님" 문장이 있다.
- 확인 못 함: AI가 이 문장들을 위기로 보는지(실제 호출 금지). 프롬프트에는 위기 규칙이 있다(`prompts.ts:59-70`). 관용 표현의 최종 기준은 사용자와 정해야 한다(M1).

### 6. 보안 코드 리뷰
- 비밀 값 노출:
  - 빌드 결과 `.next/static`의 JS 14개에서 OpenRouter 키 형식(`sk-or-v1-`), DB URL 형식(`postgres://...@`), 비밀 변수 이름을 검색했다. 모두 0건이다.
  - `/login` 응답에서도 같은 패턴이 0건이다.
  - `"use client"` 파일은 실제로 5개(`DiaryForm`, `HistoryList`, `ConfirmDialog`, `NavLink`, `LoginError`)다. `SignOutButton.tsx`와 `auth.ts`는 주석에 같은 글자가 있어 grep에 걸린 것이고 실제로는 서버 쪽이다. 클라이언트 파일은 서버 모듈(`@/auth`, `@/lib/db`, `@/lib/ai/index`, `openrouter`)을 import하지 않는다. `@/lib/ai/types`는 타입만 쓴다(`client/types.ts:7`).
  - `NEXT_PUBLIC_` 변수는 없다.
  - 확인 못 함: 번들과 응답에 실제 값이 없는지 값 대조. `.env` 열람 금지 조건 때문이다.
- SQL 인젝션: 모든 쿼리가 템플릿 바인딩을 쓴다(`entries.ts`). `sql.unsafe`는 두 곳뿐이다. `db/migrate.mjs:55`는 고정 DDL이고, `:86`은 저장소 SQL 파일을 `guard.mjs`로 검사한 뒤 실행한다. 둘 다 사용자 입력이 섞이지 않는다. 커서는 base64url, 정규식, 날짜 검증을 거친 뒤 바인딩된다(`validation.ts:106-135`).
- 프롬프트 인젝션: 시스템과 사용자 메시지를 나눈다(`prompts.ts:114-119`). 일기를 `<diary_entry>` 태그로 감싸고 꺾쇠를 전각으로 바꿔 태그 탈출을 막는다(`:80-86`). 시스템 지시에 "일기 속 지시 무시"가 적혀 있다(`:30-34`). 출력은 zod로 검증한다. 감정 enum, 강도 정수, 문장 수와 길이, 한국어 포함을 확인하고 모르는 키는 버린다. 잔여 위험: 공감 문장 내용 자체는 검증하지 않는다(표시는 텍스트 전용이라 XSS는 아님). `isCrisis` false 유도 가능성은 L8. 실제 인젝션 실험은 못 했다.
- `diary` 밖 스키마: 앱 코드에 `public.`, `auth.` 등 참조가 없다(grep). `db/guard.mjs`가 마이그레이션에서 `diary` 밖 객체를 막는다. `db:snapshot -- --compare before-001`은 통과했다.
- 로그: `console` 출력 4곳(`responses.ts:57`, `index.ts:30, :60, :93`) 모두 이름, 코드, 모델, 상태만 남긴다. 일기 원문이 없다.
- 저장소: `git ls-files`에는 `.env.example`만 있다. `git log --all -- .env`는 결과가 없다. `.gitignore`에 `.env`, `.env.*`, `db/snapshots/`가 있다.
- 기타: 보안 헤더 없음(L7). 서버는 `Content-Type`을 확인하지 않는다(`validation.ts:83-90`). 교차 사이트 요청에 쿠키가 실리는지는 Auth.js 기본 SameSite 값에 달려 있다. 코드에 명시 설정이 없어 확인 못 했다(참고, 낮음).

### 7. 화면
방법: CSS의 미디어 쿼리와 컨테이너 쿼리, 컴포넌트 구조, ARIA 속성을 읽고 자동 테스트를 확인했다. 브라우저가 없어 실제 렌더링은 확인하지 못했다.
- 레이아웃:
  - 본문 최대 폭 42rem, 모바일 좌우 여백 1rem, 48rem부터 2rem(`globals.css:107`, `layout.module.css`).
  - 위기 상자는 컨테이너 폭 19.5rem 이하에서 세로 배치(`CrisisBox.module.css:68`). 40rem부터 2열.
  - 확인 창은 30rem 이하에서 버튼을 세로로 배치(`ConfirmDialog.module.css:40`).
  - 머리글 메뉴는 `flex-wrap`으로 줄바꿈된다.
  - 긴 글자는 `overflow-wrap: break-word`로 처리된다. 가로 넘침 가능성은 낮다. 실측은 못 했다.
  - 저장 버튼은 모바일에서 가로 100%(`DiaryForm.module.css:101`).
- 키보드:
  - 쓰기 화면 순서: 라벨, 입력창, 글자 수, 오류, 무료 모델 안내, 저장 버튼(`DiaryForm.tsx:127-181`).
  - 저장 중 중복 방지: `submittingRef`와 `aria-disabled`(`:88, :178`).
  - 지난 기록: 펼치기 버튼에 `aria-expanded`, `aria-controls`(`HistoryList.tsx:275-289`). 삭제 버튼은 펼친 뒤에만 보인다.
  - 확인 창: `role="alertdialog"`, `aria-labelledby`, `aria-describedby`. 열면 취소 버튼에 포커스가 가고, Tab은 창 안에서만 돌며, Esc로 닫고, 닫으면 원래 자리로 포커스가 돌아간다(`ConfirmDialog.tsx:62-100, :110-118`).
  - 건너뛰기 링크(`src/app/layout.tsx:45`), 포커스 표시 3px(`globals.css:195`).
- ARIA: 결과 영역 `aria-live="polite"`(`DiaryForm.tsx:186`), 오류 `role="alert"`, 불러오기 상태 `role="status"`(`HistoryList.tsx:205`). 글자 수는 화면용 "37/200"과 스크린 리더용 "200자 중 37자"를 나눈다(`DiaryForm.tsx:156-163`).
- 색 대비: `globals.css` 주석의 대비값 33개를 WCAG 공식으로 직접 계산했다. 모두 주석 값과 일치했고, 본문 4.5:1과 UI 3:1 기준을 통과한다. 참고로 `aria-disabled` 버튼은 opacity 0.6이다(WCAG는 비활성 컨트롤을 대비 기준에서 제외한다). 장식용 테두리(1.53)는 정보를 전달하지 않는다.
- 확인 못 함: 실제 렌더링(375px과 데스크톱 화면), 실제 키보드 조작, 스크린 리더 낭독, 뒤로 가기 캐시(M2).

### 8. lint, test, build
- `npm run lint`: 종료 코드 0, 출력 없음.
- `npm test`: Test Files 21 passed, 3 skipped. Tests 337 passed, 9 skipped. 건너뛴 9개는 `RUN_E2E`, `RUN_DB_TESTS`, `AI_LIVE_CHECK` 조건이 있는 실제 DB와 실제 API 시험이다.
- `npm run build`: 성공. 경로는 `/`, `/history`, `/login` 정적, `/api/entries`, `/api/entries/[id]`, `/api/auth/[...nextauth]` 동적. 실패 없음.
- 실행 순서: lint, test, build를 하나씩 순서대로 돌렸다. 동시에 돌리지 않았다.

## 위기 문장 시험 결과 표

방법: `detectCrisis`를 노드 표준 입력으로 직접 실행했다. 키워드 검사 결과이며, AI 판단은 포함하지 않는다. 정답 기준은 점검 목록 5번의 문장 목록이다.

| # | 문장 | 기대 | 키워드 결과 (걸린 규칙) | 판정 |
|---|---|---|---|---|
| 1 | 죽고 싶다 | 위기 | 위기 (죽고싶) | 통과 |
| 2 | 자살하고 싶어 | 위기 | 위기 (자살) | 통과 |
| 3 | 다 끝내고 싶어 | 위기 | 위기 (끝내고싶) | 통과 (끝내고싶은 M1 오탐 원인) |
| 4 | 사라지고 싶다 | 위기 | 위기 (사라지고싶) | 통과 |
| 5 | 힘들어 죽을 것 같다 | 위기 | 아님 | 실패 (H1) |
| 6 | 살기 싫다 | 위기 | 위기 (살기싫) | 통과 |
| 7 | 자해했어 | 위기 | 위기 (자해) | 통과 |
| 8 | 죽을 만큼 맛있었다 | 아님 | 아님 | 통과 |
| 9 | 숙제를 빨리 끝내고 싶다 | 아님 | 위기 (끝내고싶) | 실패 (오탐, M1) |
| 10 | 할머니가 세상을 떠나셨다 | 아님 | 위기 (세상을떠나) | 실패 (오탐, M1) |
| 11 | 죽고 싶지는 않다 | 아님 | 위기 (죽고싶) | 실패 (오탐, 부정문, M1) |
| 12 | 웃겨 죽겠다 | 아님 | 아님 | 통과 |
| 13 | 오늘 회의 끝내고 싶다 | 아님 | 위기 (끝내고싶) | 실패 (오탐, M1) |
| 추가 | 힘들어서 죽을 것 같아 | 위기 | 아님 | 실패 (H1과 같은 원인) |
| 추가 | 죽을 것만 같다 / 죽을 것 같아요 | 위기 | 아님 | 실패 (H1과 같은 원인) |
| 추가 | 다 끝내고 싶다는 생각이 든다 | 위기 | 위기 (끝내고싶) | 통과 |
| 추가 | 약을 다 먹었더니 나았다 | 아님 | 위기 (약을다먹) | 실패 (오탐, M1) |
| 추가 | 내가 없어서 다들 힘들었겠다 | 아님 | 위기 (내가없어) | 실패 (오탐, M1) |
| 추가 | 점심 메뉴로 죽을까 고민했다 | 아님 | 위기 (죽을까) | 실패 (오탐, 음식 '죽', M1) |
| 추가 | 자살 예방 교육을 들었다 | 아님 | 위기 (자살) | 실패 (오탐, 주제 언급, M1) |
| 추가 | 유서 깊은 마을에 다녀왔다 | 아님 | 아님 | 통과 |
| 추가 | 배고파 죽겠다 | 아님 | 아님 | 통과 |
| 추가 | 죽을 것 같이 바빴다 | 아님 | 아님 | 통과 (H1 수정 시 바뀔 수 있음) |
| 추가 | 이제 자 해야 할 일이 많다 | 아님 | 아님 | 통과 (띄어쓰기 규칙 효과) |
| 추가 | 회사에서 실수해서 너무 창피했다 | 아님 | 아님 | 통과 |

- 집계: 위기여야 하는 문장 7개 중 6개 감지 (S2 미달). 평범한 문장 6개 중 2개 통과, 4개 오탐. 추가 문장까지 포함하면 평범한 문장 중 오탐은 더 많다.
- AI 판단의 결과: 확인 못 함 (실제 모델 호출 금지). AI가 놓친 문장을 잡는지는 알 수 없다.
- 합치기 방식: OR (위 항목 5 참고).

## 실행한 명령과 결과

- 무로그인 curl (개발 서버 `http://localhost:3000`, GET과 로그인 없는 POST·DELETE만 사용): 위 항목 3의 결과. 모두 401 또는 리다이렉트. `/api/auth/session`은 200, 본문 `null`.
- `curl -sI http://localhost:3000/login`: `Cache-Control: no-store`만 있음. 보안 헤더 없음 (L7).
- `npm run lint`: 종료 코드 0, 출력 없음.
- 노드 표준 입력 실행 (파일 생성 없음): 위기 키워드(표), 입력 경계값(표), 커서와 `limit` 검사, 본문 형식 검사, 대비 계산 33개. 정상 종료.
  - 참고: 공감 메시지 파싱과 `toNewEntry`를 노드로 직접 불러오는 시도는 `@/` 경로 별칭과 확장자 없는 import 때문에 실패했다(`ERR_MODULE_NOT_FOUND`). 해당 기능은 기존 자동 테스트(`schema.test.ts`, `entry.test.ts`) 결과로 확인했다.
- `npm test`: Test Files 21 passed | 3 skipped (24). Tests 337 passed | 9 skipped (346). 종료 코드 0.
- `npm run build`: 성공 (Compiled successfully, 모든 경로 생성). 종료 코드 0. `.next/`와 무시 대상 빌드 산출물이 갱신되었다. 개발 서버는 빌드 뒤에도 200으로 응답했고, 재시작하지 않았다.
- `npm run db:snapshot -- --compare before-001`: 결과 "통과 - diary 밖 스키마의 표 목록과 개수가 같습니다." 전체 표 74개(auth 27, diary 2, diary_0904 2, extensions 2, public 26, realtime 3, storage 10, vault 2). 읽기 전용 SELECT만 실행했다.
- 소스 검색 (grep): `NEXT_PUBLIC_` 없음, `dangerouslySetInnerHTML`/`innerHTML`/`eval` 없음, `sql.unsafe` 2곳(고정 DDL과 guard 검사 후 실행), `console` 출력 4곳(이름·코드·모델·상태만). 위기 상자 `tel:` 링크 4개 확인.
- 번들 검사: `.next/static` JS 14개에서 비밀 값 형식과 비밀 변수 이름 0건. `/login` 응답에서도 0건.
- git: `git status --short` 변경 없음. `git ls-files`에 `.env` 없음. `git log --all -- .env`는 결과 없음. `.gitignore`에 `.env`가 있음(`.env.example`만 추적).
- 실행하지 않은 것 (금지 조건): `npm run db:migrate`, `RUN_E2E=1` 통합 시험, `RUN_DB_TESTS=1`, `AI_LIVE_CHECK=1`, 로그인 상태의 POST·DELETE, 실제 일기 저장과 삭제, `.env*` 열람, 개발 서버 재시작 또는 종료, AUTH_SECRET 등으로 세션 토큰을 만드는 일.
- 파일 생성·수정: 없음. 임시 스크립트는 모두 표준 입력으로 실행했다.
