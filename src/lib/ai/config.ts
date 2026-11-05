/**
 * AI 모델 설정 (모델 이름, 대기 시간, 환경 변수 이름을 한곳에서 관리한다.)
 *
 * 2단계(OpenRouter 호출 구현)에서 쓴다. 1단계에서는 값을 두기만 하고 아무도 호출하지 않는다.
 * 모델을 바꾸려면 이 파일만 고친다. 단, 모델 이름을 바꾸기 전에는 사용자에게 먼저 알린다. (docs/PLAN.md 2-B)
 *
 * 비밀 값은 이 파일에 쓰지 않는다. API 키는 환경 변수 이름만 적고, 값은 2단계의 서버 코드에서 process.env로 읽는다.
 */

/** OpenRouter 기본 주소 (OpenAI 호환). 호출 경로는 `${OPENROUTER_BASE_URL}/chat/completions`. */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** API 키를 담은 환경 변수의 "이름". 값은 여기서 읽지 않는다. 서버 코드에서만 읽고, 브라우저로 내보내지 않는다. */
export const OPENROUTER_API_KEY_ENV = "OPENROUTER_API_KEY";

/** 1순위 모델. */
export const PRIMARY_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** 2순위 모델. 1순위가 시간 초과·오류·이상한 응답일 때 쓴다. */
export const FALLBACK_MODEL = "nvidia/nemotron-3.5-super-vl:free";

/** 모델 호출 순서. 앞에서부터 시도하고, 모두 실패하면 분석 실패(AnalysisFailure)를 돌려준다. */
export const MODEL_CHAIN = [PRIMARY_MODEL, FALLBACK_MODEL] as const;

/** 모델 하나당 기다리는 시간(밀리초). 20초. 최악의 경우 20초 x 2 = 40초 (PRD S1의 45초 이내 기준). */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * 모델이 만들 수 있는 최대 토큰 수.
 * 추론(reasoning) 모델은 생각하는 데 쓴 토큰도 여기에 들어가서, 너무 작으면 본문이 비어 돌아온다.
 * 공감 메시지 자체는 짧으므로(약 200자), 추론분을 감안해 넉넉히 잡는다.
 */
export const MAX_OUTPUT_TOKENS = 2_000;

/** 말투가 안정되도록 낮은 편으로 둔다. */
export const TEMPERATURE = 0.5;

/**
 * 모델별 요청 옵션.
 * 2026-11-05 기준 OpenRouter 공개 모델 목록(/api/v1/models)의 supported_parameters를 따랐다.
 *  - 1순위(ultra): response_format, structured_outputs를 지원 목록에 올려 두지 않았다. 프롬프트로 JSON을 요구한다.
 *  - 2순위(super-vl): response_format, structured_outputs 지원. JSON 객체 모드를 켠다.
 * 어느 쪽이든 응답은 schema.ts로 다시 검증하므로, 이 옵션은 "JSON이 나올 확률을 높이는 보조 수단"이다.
 */
export const MODEL_OPTIONS: Record<string, { jsonMode: boolean }> = {
  [PRIMARY_MODEL]: { jsonMode: false },
  [FALLBACK_MODEL]: { jsonMode: true },
};
