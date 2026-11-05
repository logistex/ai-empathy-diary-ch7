/**
 * 위기 안내 상자의 문구와 상담 연락처 — 이 앱에서 이 내용을 정하는 유일한 곳.
 *
 * 출처: docs/PRD.md F5 (사용자 확인 완료, 2026-11-05). 번호가 바뀌면 이 파일만 고친다.
 * 사용자가 확인한 것은 기관 이름과 번호뿐이므로, 운영 시간·무료 여부는 화면에 쓰지 않는다.
 */

/** 위기 안내 문구 (PRD F5 확정) */
export const CRISIS_MESSAGE =
  "지금 많이 힘드셨군요. 이런 마음을 털어놓아 주셔서 고마워요. 혼자 견디지 않으셔도 괜찮아요. 아래 전문 상담에서 지금 바로 이야기를 나눌 수 있어요. 당장 위험하다고 느껴지면 119에 연락해 주세요.";

/** 상자 맨 아래의 "의료 서비스 아님" 한 줄 (PRD F5 확정) */
export const MEDICAL_DISCLAIMER =
  "이 앱은 진단이나 치료를 하지 않는 일기 앱이에요. 힘든 마음이 계속되면 전문 상담을 받아 보세요.";

/** 스크린 리더가 읽는 상자 이름 */
export const CRISIS_BOX_LABEL = "전문 상담 연락처 안내";

export type CrisisContact = {
  /** 기관 이름 */
  name: string;
  /** 화면에 보이는 번호 */
  number: string;
  /** tel: 링크에 쓰는 값 (숫자만) */
  tel: string;
};

/** 상담 연락처 4개 (PRD F5 확정, 순서도 PRD 표와 같다) */
export const CRISIS_CONTACTS: readonly CrisisContact[] = [
  { name: "자살예방상담전화", number: "109", tel: "109" },
  { name: "정신건강위기상담", number: "1577-0199", tel: "15770199" },
  { name: "청소년상담", number: "1388", tel: "1388" },
  { name: "응급", number: "119", tel: "119" },
];
