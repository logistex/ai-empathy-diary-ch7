# API 명세 — AI 공감 다이어리

2단계에서 backend-developer(서버), frontend-developer(화면), ai-integration-specialist(AI)가 동시에 일할 때 서로 기대는 약속이다.
바꿀 필요가 생기면 혼자 고치지 말고 보고한다. (`docs/PLAN.md` 2단계 규칙)

> **AI 타입 대조**: 2026-11-05에 `src/lib/ai/types.ts`와 대조했다. 이름·값 범위·실패 표현이 모두 맞아 "확인 완료"로 표시했다. (7번 참고)
> 이름은 `emotion`, `emotionScore`, `empathyMessage`, `isCrisis`, `modelUsed`로 맞춰 두었다.

---

## 1. 공통 약속

| 항목 | 내용 |
|---|---|
| 기본 주소 | 같은 도메인의 `/api/...` (로컬: `http://localhost:3000`) |
| 형식 | 요청·응답 모두 JSON (`Content-Type: application/json`). 이름은 camelCase |
| 인증 | Auth.js 세션 쿠키(JWT). 화면에서 `fetch`를 부를 때 같은 도메인이므로 쿠키가 자동으로 붙는다. |
| 사용자 구분 | **서버가 세션에서 꺼낸 구글 계정 ID(`session.user.id`)** 로만 정한다. 요청 본문·주소·쿼리로 받은 `userId` 같은 값은 **무시한다.** 응답에도 `userId`를 담지 않는다. |
| 시간 | ISO 8601 UTC 문자열 (예: `2026-11-05T05:12:34.567Z`). 날짜별 묶기·표시는 화면이 사용자 시간대로 바꿔서 한다. |
| 캐시 | 모든 `/api/entries` 응답에 `Cache-Control: no-store`를 붙인다. |
| 로그 | 일기 원문(`content`), 공감 메시지를 서버 로그에 남기지 않는다. |

### 1.1 오류 응답 형식

모든 오류는 같은 모양이다. 화면은 `error.message`를 그대로 보여 줘도 되고, `error.code`로 분기한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "일기는 200자까지 쓸 수 있어요.",
    "details": [
      { "field": "content", "code": "too_long", "message": "일기는 200자까지 쓸 수 있어요." }
    ]
  }
}
```

- `details`는 `400`일 때만 있다. 그 밖의 상태에서는 생략한다.
- `message`는 사용자에게 보여도 되는 한국어 문장이다. 서버 내부 정보(SQL, 스택, 환경 변수 이름 등)는 절대 넣지 않는다.

### 1.2 상태 코드

| 상태 | `error.code` | 언제 | `message` 예 |
|---|---|---|---|
| `200` | — | 조회·삭제 성공 | |
| `201` | — | 일기 저장 성공 (AI 분석이 실패했어도 `201`) | |
| `400` | `VALIDATION_ERROR` | 본문이 JSON이 아님, `content` 규칙 위반, `limit`·`cursor` 값이 잘못됨 | "일기를 한 줄 이상 적어 주세요." |
| `401` | `UNAUTHORIZED` | 로그인하지 않았거나 세션이 만료됨 | "로그인이 필요해요." |
| `404` | `NOT_FOUND` | 그 id의 일기가 없거나, **남의 일기다.** (둘을 구분하지 않는다.) id 형식이 uuid가 아니어도 `404` | "일기를 찾을 수 없어요." |
| `500` | `INTERNAL_ERROR` | 서버·DB 오류. 상세는 서버 로그에만 남긴다. | "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요." |

- 순서: 먼저 로그인 확인(`401`) → 입력 검증(`400`) → 처리(`404`/`500`).
- AI 분석 실패는 오류가 **아니다.** 일기를 저장하고 `201`(또는 조회 시 `200`)과 `analysisStatus: "failed"`로 알린다. (2.2 참고)

---

## 2. 일기 객체 (Entry)

모든 엔드포인트가 같은 모양의 일기 객체를 쓴다.

| 필드 | 타입 | 설명 | AI 타입과 |
|---|---|---|---|
| `id` | string (uuid) | 일기 id | |
| `content` | string | 일기 원문 (앞뒤 공백을 지운 값) | |
| `createdAt` | string (ISO 8601) | 저장 시각 | |
| `analysisStatus` | `"success"` \| `"failed"` | 분석 성공 여부. DB에 따로 저장하지 않고 `emotion`이 null인지로 서버가 정한다. | 확인 완료 (AI 타입의 `status`와 값이 같음) |
| `emotion` | `"기쁨"` \| `"슬픔"` \| `"분노"` \| `"불안"` \| `"평온"` \| `null` | 감정 이름 (5개 중 하나). 분석 실패면 `null` | 확인 완료 |
| `emotionScore` | `1` \| `2` \| `3` \| `4` \| `5` \| `null` | 감정 강도(1 약함 ~ 5 강함). 분석 실패면 `null` | 확인 완료 |
| `empathyMessage` | string \| `null` | 공감 메시지(2~4문장, 한국어). 분석 실패면 `null` | 확인 완료 |
| `isCrisis` | boolean | 위기 표현 여부(서버 키워드 검사 **또는** AI 판단). 분석에 실패해도 `true`가 될 수 있다. | 확인 완료 |
| `modelUsed` | string \| `null` | 실제로 응답한 모델 이름. 분석 실패면 `null` | 확인 완료 |

DB 열과의 대응: `id`, `content`, `created_at`→`createdAt`, `emotion`, `emotion_score`→`emotionScore`, `empathy_message`→`empathyMessage`, `is_crisis`→`isCrisis`, `model_used`→`modelUsed`. (`user_id`는 응답에 넣지 않는다.)

분석 결과 4개(`emotion`, `emotionScore`, `empathyMessage`, `modelUsed`)는 **모두 값이 있거나 모두 `null`** 이다. DB의 CHECK 제약이 이를 보장한다.

### 2.1 분석 성공 예

```json
{
  "id": "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11",
  "content": "오늘 친구와 오랜만에 만나서 많이 웃었다.",
  "createdAt": "2026-11-05T05:12:34.567Z",
  "analysisStatus": "success",
  "emotion": "기쁨",
  "emotionScore": 4,
  "empathyMessage": "오랜만에 친구를 만나 많이 웃으셨군요. 마음이 한결 가벼워진 하루였겠어요. 그 따뜻한 기분이 오래 이어지면 좋겠어요.",
  "isCrisis": false,
  "modelUsed": "nvidia/nemotron-3-ultra-550b-a55b:free"
}
```

### 2.2 분석 실패 예

두 모델이 모두 실패하면 일기는 저장하고, 분석 필드는 `null`로 둔다.

```json
{
  "id": "5d1c0a7e-2b6e-4d57-8e19-0a5c1c7b3f22",
  "content": "오늘은 그냥 조용히 지나갔다.",
  "createdAt": "2026-11-05T05:20:00.000Z",
  "analysisStatus": "failed",
  "emotion": null,
  "emotionScore": null,
  "empathyMessage": null,
  "isCrisis": false,
  "modelUsed": null
}
```

화면 처리(PRD 확정):
- `analysisStatus === "failed"`이면 결과 카드 대신 **기본 위로 문구**를 보여 준다. 오류 화면을 띄우지 않는다.
  > 오늘의 마음을 한 줄로 남겨 주셔서 고마워요. 지금은 분석이 어려웠지만, 일기는 안전하게 저장했어요. 오늘도 수고 많으셨어요.
- 지난 기록 목록에서는 감정 자리에 **"분석 안 됨"** 을 표시한다.
- 기본 위로 문구는 화면이 가진 고정 문구다. 서버가 `empathyMessage`에 대신 채워 넣지 않는다.

### 2.3 위기 일기 예 (`isCrisis: true`)

위기 표현이 있으면 `isCrisis`가 `true`다. 분석 성공·실패와 관계없이 화면은 상담 연락처 상자를 공감 메시지(또는 기본 위로 문구) **위에** 보여 준다.

```json
{
  "id": "c91a7a52-6a35-4f3e-bc0d-2f7d6c2b8e33",
  "content": "(위기 표현이 담긴 일기 — 예시에는 원문을 쓰지 않는다)",
  "createdAt": "2026-11-05T06:00:00.000Z",
  "analysisStatus": "failed",
  "emotion": null,
  "emotionScore": null,
  "empathyMessage": null,
  "isCrisis": true,
  "modelUsed": null
}
```

| `analysisStatus` | `isCrisis` | 화면에 보이는 것 |
|---|---|---|
| `success` | `false` | 감정·강도·공감 메시지 카드 |
| `success` | `true` | 상담 연락처 상자 → 공감 메시지 카드(감정·강도 포함) |
| `failed` | `false` | 기본 위로 문구 |
| `failed` | `true` | 상담 연락처 상자 → 기본 위로 문구 |

**상담 연락처와 안내 문구는 API가 돌려주지 않는다.** `docs/PRD.md` F5의 확정 문구·번호 4개(109, 1577-0199, 1388, 119)와 "의료 서비스 아님" 한 줄은 화면의 고정 설정(한곳에서 관리)이며, `isCrisis === true`일 때 보여 준다.
지난 기록에서 위기 일기를 열 때도 목록·상세 응답의 `isCrisis`로 같은 상자를 다시 보여 준다.

---

## 3. 로그인 관련 (Auth.js)

| 경로 | 설명 |
|---|---|
| `/login` | 로그인 화면(공개). 앱 소개 한 줄과 "구글로 시작하기" 버튼. 로그인하지 않은 사용자는 `src/proxy.ts`가 이 화면으로 보낸다. |
| `/api/auth/*` | Auth.js가 처리하는 경로(로그인·콜백·로그아웃·세션). `src/app/api/auth/[...nextauth]/route.ts`. 구글 콜백은 `/api/auth/callback/google`. |

- 화면에서의 로그인: 서버 액션에서 `import { signIn } from "@/auth"` 후 `await signIn("google", { redirectTo: "/" })`.
- 로그아웃: `import { signOut } from "@/auth"` 후 `await signOut({ redirectTo: "/login" })`.
- 서버 코드에서 로그인한 사용자 확인: `import { auth } from "@/auth"` 후 `const session = await auth()`. 로그인한 사용자의 일기 `user_id`는 `session.user.id`다.
- 보호 규칙(`src/proxy.ts`): `/login`, `/api/auth/*`, 정적 파일을 뺀 모든 **화면 경로**는 로그인이 필요하고, 없으면 `/login`으로 이동한다. `/api/entries*`는 이동시키지 않고 `401` JSON을 돌려준다. 이 `401`은 proxy와 각 API 핸들러가 **둘 다** 확인한다.

---

## 4. 엔드포인트 요약

| 메서드 | 경로 | 설명 | 성공 | 실패 |
|---|---|---|---|---|
| `POST` | `/api/entries` | 일기 저장 + 분석 결과까지 돌려줌 | `201` | `400` `401` `500` |
| `GET` | `/api/entries` | 내 일기 목록(최신순, cursor 페이지 나눔) | `200` | `400` `401` `500` |
| `GET` | `/api/entries/[id]` | 내 일기 하나 | `200` | `401` `404` `500` |
| `DELETE` | `/api/entries/[id]` | 내 일기 삭제(실제 삭제, 복구 불가) | `200` | `401` `404` `500` |

---

## 5. 엔드포인트 상세

### 5.1 `POST /api/entries` — 일기 저장

**요청**

```http
POST /api/entries
Content-Type: application/json

{ "content": "오늘 친구와 오랜만에 만나서 많이 웃었다." }
```

| 필드 | 타입 | 규칙 |
|---|---|---|
| `content` | string | 필수. 서버가 **앞뒤 공백을 지운 뒤** 1자 이상 200자 이하. 글자 수는 **유니코드 문자 기준**(이모지 하나 = 1자, `Array.from(text).length`)으로 센다. 줄바꿈은 허용하고 1자로 센다. 빈 문자열, 공백·줄바꿈뿐인 글, 문자열이 아닌 값은 `400`. |

- 본문에 `userId`, `emotion`, `isCrisis` 같은 다른 필드가 있어도 **무시한다.** (분석 결과는 서버가 AI 모듈로 만든다.)
- HTML 문자열(`<script>` 등)은 그대로 저장한다. 화면이 글자로만 출력한다. (React 기본 출력 사용, `dangerouslySetInnerHTML` 금지)
- 하루 작성 횟수는 제한하지 않는다.

**처리 순서 (서버)**: 로그인 확인 → 입력 검증 → 분석(`analyzeDiary`) → `diary.entries`에 저장(`user_id`는 세션 값) → 저장된 일기를 응답.
AI가 실패해도 저장하고 `201`을 돌려준다. 저장 자체가 실패했을 때만 `500`이다.

**성공 `201`** — 분석 성공 예 (분석 실패·위기 예는 2.2, 2.3과 같은 모양)

```json
{
  "entry": {
    "id": "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11",
    "content": "오늘 친구와 오랜만에 만나서 많이 웃었다.",
    "createdAt": "2026-11-05T05:12:34.567Z",
    "analysisStatus": "success",
    "emotion": "기쁨",
    "emotionScore": 4,
    "empathyMessage": "오랜만에 친구를 만나 많이 웃으셨군요. 마음이 한결 가벼워진 하루였겠어요. 그 따뜻한 기분이 오래 이어지면 좋겠어요.",
    "isCrisis": false,
    "modelUsed": "nvidia/nemotron-3-ultra-550b-a55b:free"
  }
}
```

**오류 예**

```json
// 400 — 빈 입력 / 공백만
{ "error": { "code": "VALIDATION_ERROR", "message": "일기를 한 줄 이상 적어 주세요.",
  "details": [{ "field": "content", "code": "empty", "message": "일기를 한 줄 이상 적어 주세요." }] } }

// 400 — 200자 초과
{ "error": { "code": "VALIDATION_ERROR", "message": "일기는 200자까지 쓸 수 있어요.",
  "details": [{ "field": "content", "code": "too_long", "message": "일기는 200자까지 쓸 수 있어요." }] } }

// 400 — 본문이 JSON이 아니거나 content가 문자열이 아님
{ "error": { "code": "VALIDATION_ERROR", "message": "요청 형식이 올바르지 않아요.",
  "details": [{ "field": "content", "code": "invalid_type", "message": "요청 형식이 올바르지 않아요." }] } }

// 401
{ "error": { "code": "UNAUTHORIZED", "message": "로그인이 필요해요." } }
```

`details[].code` 값: `empty`(빈 값·공백뿐), `too_long`(200자 초과), `invalid_type`(형식 오류), `invalid_cursor`, `invalid_limit`.

`invalid_type`에는 NUL 문자(`\u0000`)가 들어 있는 내용과 64KB를 넘는 요청 본문도 포함된다. (2단계 구현에서 정함, 약속 변경 아님)

### 5.2 `GET /api/entries` — 내 일기 목록

**요청**

```http
GET /api/entries?limit=20&cursor=eyJjIjoiMjAyNi0xMS0wNVQwNToxMjozNC41NjdaIiwiaSI6IjBiNmYyYzFlIn0
```

| 쿼리 | 타입 | 규칙 |
|---|---|---|
| `limit` | 정수 | 선택. 기본 `20`, 범위 `1`~`50`. 범위 밖이면 `400` (`invalid_limit`) |
| `cursor` | string | 선택. 첫 페이지는 생략. 이전 응답의 `nextCursor`를 **그대로** 넣는다. 서버가 읽을 수 없는 값이면 `400` (`invalid_cursor`) |

**페이지 나눔 규칙**

- 정렬: `createdAt` 내림차순(최신 먼저), 같은 시각이면 `id` 내림차순. 이 순서는 항상 같다.
- `cursor`는 **불투명한 문자열**이다. 화면은 내용을 해석하거나 만들지 않고, 받은 `nextCursor`를 그대로 되돌려 보낸다. (서버는 마지막 항목의 `createdAt`과 `id`를 담은 값으로 만든다.)
- `nextCursor`가 `null`이면 마지막 페이지다. 화면은 "더 보기" 버튼을 숨긴다.
- 기록이 없으면 `entries: []`, `nextCursor: null`이고 상태는 `200`이다. (빈 상태 안내는 화면이 보여 준다.)
- 위치 기준(cursor)이라서, 목록을 보는 도중 새 일기가 써지거나 일기가 삭제돼도 이미 본 항목이 중복되거나 빠지지 않는다. 새로 쓴 일기는 화면이 목록 맨 위에 직접 끼워 넣는다.
- 목록의 항목은 일기 객체(2번) 전체다. 따로 상세 요청 없이 공감 메시지와 위기 안내를 보여 줄 수 있다.
- 조회는 항상 세션의 `user_id` 조건이 붙는다. 다른 사람의 일기는 나오지 않는다.

**성공 `200`**

```json
{
  "entries": [
    {
      "id": "5d1c0a7e-2b6e-4d57-8e19-0a5c1c7b3f22",
      "content": "오늘은 그냥 조용히 지나갔다.",
      "createdAt": "2026-11-05T05:20:00.000Z",
      "analysisStatus": "failed",
      "emotion": null,
      "emotionScore": null,
      "empathyMessage": null,
      "isCrisis": false,
      "modelUsed": null
    },
    {
      "id": "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11",
      "content": "오늘 친구와 오랜만에 만나서 많이 웃었다.",
      "createdAt": "2026-11-05T05:12:34.567Z",
      "analysisStatus": "success",
      "emotion": "기쁨",
      "emotionScore": 4,
      "empathyMessage": "오랜만에 친구를 만나 많이 웃으셨군요. 마음이 한결 가벼워진 하루였겠어요. 그 따뜻한 기분이 오래 이어지면 좋겠어요.",
      "isCrisis": false,
      "modelUsed": "nvidia/nemotron-3-ultra-550b-a55b:free"
    }
  ],
  "nextCursor": "eyJjIjoiMjAyNi0xMS0wNVQwNToxMjozNC41NjdaIiwiaSI6IjBiNmYyYzFlIn0"
}
```

**오류 예**

```json
// 400
{ "error": { "code": "VALIDATION_ERROR", "message": "요청 값이 올바르지 않아요.",
  "details": [{ "field": "cursor", "code": "invalid_cursor", "message": "요청 값이 올바르지 않아요." }] } }

// 401
{ "error": { "code": "UNAUTHORIZED", "message": "로그인이 필요해요." } }
```

### 5.3 `GET /api/entries/[id]` — 일기 하나

```http
GET /api/entries/0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11
```

**성공 `200`**

```json
{
  "entry": {
    "id": "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11",
    "content": "오늘 친구와 오랜만에 만나서 많이 웃었다.",
    "createdAt": "2026-11-05T05:12:34.567Z",
    "analysisStatus": "success",
    "emotion": "기쁨",
    "emotionScore": 4,
    "empathyMessage": "오랜만에 친구를 만나 많이 웃으셨군요. 마음이 한결 가벼워진 하루였겠어요. 그 따뜻한 기분이 오래 이어지면 좋겠어요.",
    "isCrisis": false,
    "modelUsed": "nvidia/nemotron-3-ultra-550b-a55b:free"
  }
}
```

**오류**

| 상태 | 경우 |
|---|---|
| `401` | 로그인하지 않음 |
| `404` | 없는 id, **남의 일기 id**, uuid 형식이 아닌 id. 존재 여부를 알려 주지 않으려고 모두 같은 응답이다. |

```json
// 404
{ "error": { "code": "NOT_FOUND", "message": "일기를 찾을 수 없어요." } }
```

### 5.4 `DELETE /api/entries/[id]` — 일기 삭제

```http
DELETE /api/entries/0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11
```

- 요청 본문은 없다.
- **DB에서 실제로 지운다.** (숨김 표시 아님, 복구 불가) 삭제 조건에 세션의 `user_id`를 함께 건다: `DELETE FROM diary.entries WHERE id = $1 AND user_id = $2`.
- 위기로 표시된 일기, 분석에 실패한 일기도 똑같이 지운다.
- 이미 지운 일기를 다시 지우면 `404`다. (멱등하게 `200`을 돌려주지 않는다.)
- 삭제 전 확인 창("이 일기를 지울까요? 지우면 되돌릴 수 없어요.")은 화면이 맡는다. API는 확인 없이 바로 지운다.

**성공 `200`**

```json
{ "deleted": true, "id": "0b6f2c1e-8f4a-4a53-9d0e-3c2f7f1a9b11" }
```

**오류**

```json
// 401
{ "error": { "code": "UNAUTHORIZED", "message": "로그인이 필요해요." } }

// 404 — 없는 id / 남의 일기 id / 이미 지운 id (남의 일기는 지워지지 않고 그대로 남는다)
{ "error": { "code": "NOT_FOUND", "message": "일기를 찾을 수 없어요." } }
```

---

## 6. 공통 응답 예 (참고)

```json
// 401 — 모든 /api/entries* 엔드포인트
{ "error": { "code": "UNAUTHORIZED", "message": "로그인이 필요해요." } }

// 500 — 모든 엔드포인트. 내부 오류 내용은 담지 않는다.
{ "error": { "code": "INTERNAL_ERROR", "message": "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요." } }
```

## 7. AI 타입과 맞춰 확인할 항목 (ai-integration-specialist)

`src/lib/ai/types.ts`가 정해지면 아래를 확인하고, 다르면 backend-developer에게 알린다. (이름을 바꾸려면 이 문서와 화면에 영향이 있으므로 먼저 보고한다.)

| 이 문서의 이름 | 확인할 점 | 상태 |
|---|---|---|
| `emotion` | 값이 `기쁨`·`슬픔`·`분노`·`불안`·`평온` 5개의 한국어 문자열인가 | 확인 완료 |
| `emotionScore` | 1~5 정수인가 | 확인 완료 |
| `empathyMessage` | 문자열(2~4문장)인가 | 확인 완료 |
| `isCrisis` | boolean이고, 키워드 검사와 AI 판단을 합친 최종값인가 (AI가 실패해도 키워드 검사 결과로 채워지는가) | 확인 완료 |
| `modelUsed` | 실제로 응답한 모델 이름 문자열, 실패 시 `null`인가 | 확인 완료 |
| 분석 실패 표현 | `analyzeDiary`가 두 모델 실패 시 예외 대신 "실패 상태"를 돌려주는데, 이때 `isCrisis`(키워드 결과)는 담기는가. 서버는 실패를 `emotion`·`emotionScore`·`empathyMessage`·`modelUsed`가 모두 `null`인 것으로 저장하고, API의 `analysisStatus: "failed"`로 바꿔 알린다. | 확인 완료 |

`analysisStatus`와 `nextCursor`, `entries` 같은 API 전용 필드는 AI 타입에 없어도 된다. 서버가 AI 결과를 DB 행으로, DB 행을 위 일기 객체로 바꾸는 일은 backend-developer(2-A)가 맡는다.

**AI 결과를 일기 객체로 바꾸는 규칙** (2026-11-05 대조 결과)

- `analyzeDiary`의 반환 타입은 `AnalysisResult = AnalysisSuccess | AnalysisFailure`이고, 판별 키는 `status`(`"success"` | `"failed"`)다. API에서는 같은 값을 `analysisStatus`라는 이름으로 내보낸다.
- `AnalysisFailure`는 `{ status: "failed", isCrisis }`뿐이다. 서버는 이때 `emotion`·`emotionScore`·`empathyMessage`·`modelUsed`를 `null`로 저장하고 응답한다.
- DB 행(`EntryRow`)의 `emotion`·`emotion_score`는 넓은 타입(`string`·`number`)이다. 일기 객체로 바꿀 때 `@/lib/ai`의 `Emotion`·`EmotionScore`로 좁힌다. (DB CHECK 제약이 값을 보장한다.)
- 공감 메시지 2~4문장은 타입이 아니라 2단계 `src/lib/ai/schema.ts`의 검증으로 보장한다.
