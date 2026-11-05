import { describe, expect, it } from "vitest";

import { detectCrisis, normalizeForCrisisCheck } from "./crisis";

describe("위기 키워드 검사: 위기 표현을 잡는다", () => {
  // 띄어쓰기 변형은 같은 표현을 여러 모양으로 적어 둔다.
  const crisisSentences = [
    // 죽고 싶다
    "죽고 싶다",
    "죽고싶다",
    "죽고 싶어요",
    "죽 고 싶 다",
    "죽고, 싶다...",
    "너무 힘들어서 죽고싶은 하루였다",
    "죽고 싶다는 생각이 계속 든다",
    "죽구싶다",
    "죽고시퍼",
    "그냥 죽어버리고 싶다",
    "차라리 죽었으면 좋겠다",
    // 자해·자살
    "자해를 했다",
    "자해 하고 싶은 충동이 든다",
    "자살 생각이 난다",
    "자살하고 싶다",
    "손목을 긋고 싶다",
    "SUICIDE 생각이 들어",
    "I want to die",
    // 극단적 선택·목숨
    "극단적 선택을 하고 싶다",
    "극단적선택을 생각했다",
    "스스로 목숨을 끊고 싶다",
    "생을 마감하고 싶다",
    "삶을 끝내고 싶다",
    "인생을 끝내고 싶어",
    "이제 다 끝내고 싶다",
    // 사라지고 싶다
    "사라지고 싶다",
    "사라지고싶어",
    "이 세상에서 사라지고 싶다",
    "내가 없어졌으면 좋겠다",
    "없어지고 싶다",
    // 살기 싫다
    "살기 싫다",
    "살기싫어",
    "더 이상 살고 싶지 않다",
    "살아갈 이유가 없다",
    "사는 게 싫다",
    "더 이상 못 살겠다",
    "태어나지 말 걸 그랬다",
    // 방법·준비
    "수면제를 다 먹어 버릴까",
    "옥상에서 뛰어내리고 싶다",
    "유서를 썼다",
    // 보이지 않는 글자·전각·대소문자로 피하려는 경우
    "죽​고​싶다",
    "ＳＵＩＣＩＤＥ",
  ];

  it.each(crisisSentences)("위기로 본다: %s", (sentence) => {
    expect(detectCrisis(sentence).isCrisis).toBe(true);
  });

  it("위기 시험 문장이 20개 이상이다 (PRD S2의 최소 개수)", () => {
    expect(crisisSentences.length).toBeGreaterThanOrEqual(20);
  });

  it("걸린 규칙 이름은 돌려주지만 일기 원문은 돌려주지 않는다", () => {
    const text = "오늘 너무 힘들어서 죽고 싶다";
    const result = detectCrisis(text);
    expect(result.matched).toContain("죽고싶");
    for (const name of result.matched) {
      expect(text).not.toBe(name);
    }
  });

  it("띄어쓰기와 문장부호를 지운 글이 같다", () => {
    expect(normalizeForCrisisCheck("죽 고, 싶 다!")).toBe(normalizeForCrisisCheck("죽고싶다"));
  });
});

describe("위기 키워드 검사: 평범한 문장은 잡지 않는다", () => {
  const normalSentences = [
    "오늘은 친구와 맛있는 점심을 먹었다.",
    "비가 와서 하루 종일 집에 있었다.",
    "퇴근길에 노을이 예뻐서 사진을 찍었다.",
    "회사에서 발표를 무사히 마쳤다.",
    "시험 때문에 조금 불안하다.",
    "오늘은 운동을 하고 푹 잤다.",
    "동생과 다퉈서 속상했다.",
    "새로 산 책이 너무 재미있다.",
    "월요일이라 피곤하다.",
    "고양이가 무릎 위에서 잠들었다.",
    "엄마가 해 준 김치찌개가 맛있었다.",
    "친구에게 서운한 일이 있었다.",
    "산책하다가 길에서 오래된 친구를 만났다.",
    "하루 종일 아무것도 하기 싫었다.",
    "자기 전에 따뜻한 차를 마셨다.",
    "이제 자 해야 할 일이 많다.",
    "유서 깊은 절에 다녀왔다.",
    "배가 고파서 라면을 끓였다.",
    "날씨가 좋아서 기분이 좋았다.",
    "오늘 하루도 무사히 지나갔다.",
    "팀장님께 칭찬을 들었다.",
    "새 일을 시작해서 설렌다.",
    "주말에 가족과 여행을 계획했다.",
  ];

  it.each(normalSentences)("위기로 보지 않는다: %s", (sentence) => {
    expect(detectCrisis(sentence).isCrisis).toBe(false);
  });

  it("평범한 시험 문장이 20개 이상이다 (PRD S4의 최소 개수)", () => {
    expect(normalSentences.length).toBeGreaterThanOrEqual(20);
  });

  it("빈 글도 위기가 아니다", () => {
    expect(detectCrisis("")).toEqual({ isCrisis: false, matched: [] });
  });
});

/**
 * 관용 표현 "현재 동작" 기록.
 *
 * PRD F5 완료 조건 10: 관용 표현의 최종 기준은 4단계에서 사용자와 정한다.
 * 이 블록은 기준을 정하는 것이 아니라 "지금 이 규칙이 어떻게 반응하는지"를 적어 둔 것이다.
 * 4단계에서 기준이 바뀌어 이 값이 달라지면, 이 기록도 같이 고친다.
 * 방침: 놓치는 것보다 잘못 띄우는 쪽을 택한다. (그래서 true인 항목은 "의도된 오탐 가능성")
 */
describe("관용 표현의 현재 동작 (기록용, 4단계에서 기준 확정)", () => {
  const idioms: { text: string; current: boolean; note: string }[] = [
    { text: "죽을 만큼 맛있었다", current: false, note: "'죽을 만큼'은 규칙에 없다. AI 판단에 맡긴다." },
    { text: "배고파 죽겠다", current: false, note: "'죽겠다'는 일상 과장이 너무 흔해서 넣지 않았다." },
    { text: "웃겨서 죽는 줄 알았다", current: false, note: "규칙에 없다." },
    {
      text: "힘들어 죽을 것 같다",
      current: false,
      note: "'죽을 것 같'은 넣지 않았다. 진짜 위기 표현일 수도 있어서 4단계에서 재검토.",
    },
    { text: "죽고 싶을 만큼 창피했다", current: true, note: "'죽고 싶'이 들어 있어 위기로 본다. 방침(오탐 허용)에 따른 동작." },
    { text: "너무 웃겨서 죽고 싶을 정도였다", current: true, note: "위와 같음." },
    { text: "숙제를 빨리 끝내고 싶다", current: true, note: "'끝내고 싶'(사용자 요청 항목)이 일상 표현과 겹친다. 오탐 가능성이 가장 높다." },
    { text: "죽을까 봐 무서웠다", current: true, note: "'죽을까'가 걸린다. 죽음에 대한 두려움 표현도 같이 걸린다." },
    { text: "죽고 싶지는 않다", current: true, note: "부정형도 걸린다. 부정 처리는 하지 않는다(놓치는 것보다 낫다는 방침)." },
    { text: "할머니가 세상을 떠나셨다", current: true, note: "'세상을 떠나'가 걸린다. 사별 표현도 걸린다." },
  ];

  it.each(idioms)("$text -> $current ($note)", ({ text, current }) => {
    expect(detectCrisis(text).isCrisis).toBe(current);
  });
});
