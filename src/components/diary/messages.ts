/**
 * 일기 화면의 고정 문구 (PRD에서 확정된 문구는 출처를 적어 둔다).
 * 위기 안내 문구와 연락처는 여기가 아니라 src/components/crisis/crisis-config.ts 에 있다.
 */

/** 무료 모델 안내 문구 — 일기 쓰기 화면의 입력창 바로 아래, 저장 버튼보다 위에 항상 보인다. (PRD F3 확정) */
export const FREE_MODEL_NOTICE =
  "이 앱은 무료 AI 모델을 사용해요. 모델 제공자가 입력한 내용을 기록하거나 학습에 사용할 수 있으니, 개인정보나 민감한 정보는 적지 않는 것이 좋아요.";

/** 분석에 실패했을 때 공감 메시지 대신 보여 주는 기본 위로 문구 (PRD F3 확정). 서버는 이 문구를 채워 주지 않는다. */
export const DEFAULT_COMFORT_MESSAGE =
  "오늘의 마음을 한 줄로 남겨 주셔서 고마워요. 지금은 분석이 어려웠지만, 일기는 안전하게 저장했어요. 오늘도 수고 많으셨어요.";

/** 지난 기록에서 분석에 실패한 일기의 감정 자리 표시 (PRD F4) */
export const NO_ANALYSIS_LABEL = "분석 안 됨";

/** 일기 지우기 확인 문구 (PRD F7: "이 일기를 지울까요? 지우면 되돌릴 수 없어요.") */
export const DELETE_CONFIRM_TITLE = "이 일기를 지울까요?";
export const DELETE_CONFIRM_DESCRIPTION = "지우면 되돌릴 수 없어요.";

/** 저장·분석을 기다리는 동안 보여 주는 문구 */
export const ANALYZING_MESSAGE = "분석 중이에요. 마음을 천천히 읽고 있어요.";

/** 분석이 오래 걸릴 때(SLOW_ANALYSIS_AFTER_MS 가 지나면) 위 문구 대신 보여 주는 안심 문구 */
export const ANALYZING_SLOW_MESSAGE = "조금 더 걸리고 있어요. 잠시만 기다려 주세요.";

/**
 * 이 시간(밀리초)이 지나도록 응답이 없으면 안심 문구로 바꾼다.
 * 서버는 보통 10초 안팎, 두 모델이 모두 느리면 최대 약 40초 걸린다. (fetch 에는 시간 제한을 걸지 않는다.)
 */
export const SLOW_ANALYSIS_AFTER_MS = 15_000;
