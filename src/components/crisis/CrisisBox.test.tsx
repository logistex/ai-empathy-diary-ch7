// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CrisisBox } from "./CrisisBox";
import { CRISIS_CONTACTS, CRISIS_MESSAGE, MEDICAL_DISCLAIMER } from "./crisis-config";

afterEach(cleanup);

describe("위기 안내 상자", () => {
  it("PRD 의 위기 안내 문구와 의료 서비스 아님 문구를 그대로 보여 준다", () => {
    render(<CrisisBox />);
    expect(screen.getByText(CRISIS_MESSAGE)).toBeTruthy();
    expect(screen.getByText(MEDICAL_DISCLAIMER)).toBeTruthy();
    expect(CRISIS_MESSAGE).toBe(
      "지금 많이 힘드셨군요. 이런 마음을 털어놓아 주셔서 고마워요. 혼자 견디지 않으셔도 괜찮아요. 아래 전문 상담에서 지금 바로 이야기를 나눌 수 있어요. 당장 위험하다고 느껴지면 119에 연락해 주세요.",
    );
    expect(MEDICAL_DISCLAIMER).toBe(
      "이 앱은 진단이나 치료를 하지 않는 일기 앱이에요. 힘든 마음이 계속되면 전문 상담을 받아 보세요.",
    );
  });

  it("연락처 4개의 기관 이름과 번호가 보이고, 번호는 tel: 링크다", () => {
    render(<CrisisBox />);
    const box = screen.getByRole("region", { name: "전문 상담 연락처 안내" });

    const expected = [
      ["자살예방상담전화", "109", "tel:109"],
      ["정신건강위기상담", "1577-0199", "tel:15770199"],
      ["청소년상담", "1388", "tel:1388"],
      ["응급", "119", "tel:119"],
    ];
    expect(CRISIS_CONTACTS).toHaveLength(4);

    for (const [name, number, href] of expected) {
      expect(within(box).getByText(name)).toBeTruthy();
      const link = within(box).getByRole("link", { name: `${name} ${number} 전화 걸기` });
      expect(link.getAttribute("href")).toBe(href);
      expect(link.textContent).toBe(number);
    }
    expect(within(box).getAllByRole("link")).toHaveLength(4);
  });

  it("의료 서비스 아님 문구가 상자의 맨 아래에 있다", () => {
    render(<CrisisBox />);
    const box = screen.getByRole("region", { name: "전문 상담 연락처 안내" });
    expect(box.lastElementChild?.textContent).toBe(MEDICAL_DISCLAIMER);
  });
});
