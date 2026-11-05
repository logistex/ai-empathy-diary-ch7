// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockEntriesApi, resetMockApi } from "@/lib/client/mock-api";
import type { Entry } from "@/lib/client/types";

import { DiaryForm } from "./DiaryForm";
import { DEFAULT_COMFORT_MESSAGE, FREE_MODEL_NOTICE } from "./messages";

// 401 일 때의 이동은 이 테스트에서 확인하지 않는다. (entries-client.test.ts 에서 확인)
vi.mock("@/lib/client/login-redirect", () => ({ redirectToLogin: vi.fn(), LOGIN_PATH: "/login" }));

function textarea() {
  return screen.getByLabelText("오늘의 한 줄") as HTMLTextAreaElement;
}
function saveButton() {
  return screen.getByRole("button", { name: /저장하기|분석 중/ });
}

beforeEach(() => {
  resetMockApi(undefined, { delayMs: 0 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("일기 입력: 글자 수와 저장 막기", () => {
  it("글자 수를 Array.from 기준으로 보여 준다 (이모지 하나는 1자)", () => {
    render(<DiaryForm />);
    expect(screen.getByText("0/200")).toBeTruthy();

    fireEvent.change(textarea(), { target: { value: "오늘😀😀" } });
    expect(screen.getByText("4/200")).toBeTruthy();
  });

  it("빈 입력은 저장하지 않고 안내 문구를 보여 준다", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "createEntry");
    render(<DiaryForm />);

    await user.click(saveButton());

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("일기를 한 줄 이상 적어 주세요.");
    expect(document.activeElement).toBe(textarea());
  });

  it("공백과 줄바꿈만 입력해도 저장하지 않는다", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "createEntry");
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "   \n  \n " } });
    await user.click(saveButton());

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("일기를 한 줄 이상 적어 주세요.");
  });

  it("201자부터는 이유를 알려 주고 저장하지 않는다", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "createEntry");
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "가".repeat(201) } });

    expect(screen.getByText("201/200")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("일기는 200자까지 쓸 수 있어요.");
    expect(textarea().getAttribute("aria-invalid")).toBe("true");

    await user.click(saveButton());
    expect(spy).not.toHaveBeenCalled();
  });

  it("200자까지는 저장된다", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "createEntry");
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "가".repeat(200) } });
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(saveButton());

    await screen.findByLabelText("오늘의 일기 결과");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("가".repeat(200));
  });

  it("저장하면 앞뒤 공백을 지운 글이 전달되고 입력창이 비워진다", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "createEntry");
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "  오늘은 맑았다.  " } });
    await user.click(saveButton());

    await screen.findByLabelText("오늘의 일기 결과");
    expect(spy).toHaveBeenCalledWith("오늘은 맑았다.");
    expect(textarea().value).toBe("");
  });
});

describe("무료 모델 안내 문구", () => {
  it("입력창 바로 아래, 저장 버튼보다 위에 있고 입력창 설명으로 연결된다", () => {
    render(<DiaryForm />);
    const notice = screen.getByText(FREE_MODEL_NOTICE);

    expect(FREE_MODEL_NOTICE).toBe(
      "이 앱은 무료 AI 모델을 사용해요. 모델 제공자가 입력한 내용을 기록하거나 학습에 사용할 수 있으니, 개인정보나 민감한 정보는 적지 않는 것이 좋아요.",
    );
    // 문서 순서: 입력창 → 안내 문구 → 저장 버튼
    expect(textarea().compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(saveButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 스크린 리더가 입력창 설명으로 함께 읽는다.
    expect(textarea().getAttribute("aria-describedby")?.split(" ")).toContain(notice.id);
  });

  it("접거나 닫는 버튼이 없고, 결과 카드가 나온 뒤에도 그대로 있다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    expect(screen.queryByRole("button", { name: /닫기|접기|숨기기/ })).toBeNull();

    fireEvent.change(textarea(), { target: { value: "[위기] 시험" } });
    await user.click(saveButton());
    await screen.findByLabelText("오늘의 일기 결과");

    expect(screen.getByText(FREE_MODEL_NOTICE)).toBeTruthy();
  });
});

describe("저장 중", () => {
  it("저장 중에는 버튼이 '분석 중'으로 바뀌고 중복 제출이 막힌다", async () => {
    const user = userEvent.setup();
    let finish!: (entry: Entry) => void;
    const spy = vi
      .spyOn(mockEntriesApi, "createEntry")
      .mockImplementation(() => new Promise<Entry>((resolve) => (finish = resolve)));
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "오늘은 비가 왔다." } });
    await user.click(saveButton());

    const busy = screen.getByRole("button", { name: "분석 중…" });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("분석 중이에요. 마음을 천천히 읽고 있어요.")).toBeTruthy();

    // 저장 중에 다시 눌러도, Enter 로 제출해도 한 번만 호출된다.
    await user.click(busy);
    await user.click(busy);
    expect(spy).toHaveBeenCalledTimes(1);

    finish({
      id: "x",
      content: "오늘은 비가 왔다.",
      createdAt: "2026-11-05T05:00:00.000Z",
      analysisStatus: "failed",
      emotion: null,
      emotionScore: null,
      empathyMessage: null,
      isCrisis: false,
      modelUsed: null,
    });

    await screen.findByLabelText("오늘의 일기 결과");
    expect(screen.queryByText("분석 중이에요. 마음을 천천히 읽고 있어요.")).toBeNull();
    expect(screen.getByRole("button", { name: "저장하기" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });
});

describe("결과 표시", () => {
  it("분석 성공: 감정, 강도, 공감 메시지 카드가 나오고 위기 상자는 없다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "오늘은 산책을 했다." } });
    await user.click(saveButton());

    const card = await screen.findByLabelText("오늘의 일기 결과");
    expect(within(card).getByText("평온")).toBeTruthy();
    expect(within(card).getByText("강도 3/5")).toBeTruthy();
    expect(within(card).getByText(/오늘의 마음을 한 줄로 차분히 남겨 주셨군요/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "전문 상담 연락처 안내" })).toBeNull();
  });

  it("분석 실패: '분석 안 됨'과 기본 위로 문구를 보여 주고 오류 화면은 없다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "[실패] 조용한 하루" } });
    await user.click(saveButton());

    const card = await screen.findByLabelText("오늘의 일기 결과");
    expect(within(card).getByText("분석 안 됨")).toBeTruthy();
    expect(within(card).getByText(DEFAULT_COMFORT_MESSAGE)).toBeTruthy();
    expect(DEFAULT_COMFORT_MESSAGE).toBe(
      "오늘의 마음을 한 줄로 남겨 주셔서 고마워요. 지금은 분석이 어려웠지만, 일기는 안전하게 저장했어요. 오늘도 수고 많으셨어요.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("region", { name: "전문 상담 연락처 안내" })).toBeNull();
  });

  it("위기(분석 성공): 위기 상자가 공감 메시지 위에 나오고 연락처 4개가 tel 링크다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "[위기] 시험 문장" } });
    await user.click(saveButton());

    const card = await screen.findByLabelText("오늘의 일기 결과");
    const box = screen.getByRole("region", { name: "전문 상담 연락처 안내" });

    // 상자가 공감 메시지 카드보다 앞(위)에 있다.
    expect(box.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getByText("슬픔")).toBeTruthy();

    const hrefs = within(box)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["tel:109", "tel:15770199", "tel:1388", "tel:119"]);
  });

  it("위기(분석 실패): 위기 상자 아래에 기본 위로 문구가 나온다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "[위기실패] 시험 문장" } });
    await user.click(saveButton());

    const card = await screen.findByLabelText("오늘의 일기 결과");
    const box = screen.getByRole("region", { name: "전문 상담 연락처 안내" });
    expect(box.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getByText("분석 안 됨")).toBeTruthy();
    expect(within(card).getByText(DEFAULT_COMFORT_MESSAGE)).toBeTruthy();
  });

  it("결과는 스크린 리더가 읽도록 aria-live 영역 안에 나온다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull(); // 결과가 나오기 전부터 있어야 변화가 읽힌다.

    fireEvent.change(textarea(), { target: { value: "[위기] 시험" } });
    await user.click(saveButton());

    const card = await screen.findByLabelText("오늘의 일기 결과");
    expect(live?.contains(card)).toBe(true);
    expect(live?.contains(screen.getByRole("region", { name: "전문 상담 연락처 안내" }))).toBe(true);
  });

  it("<script> 같은 HTML 은 실행되지 않고 글자로만 처리된다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "<script>alert(1)</script>" } });
    await user.click(saveButton());

    await screen.findByLabelText("오늘의 일기 결과");
    expect(document.querySelector("script")).toBeNull();
  });
});

describe("저장 오류", () => {
  it("오류 안내를 보여 주고 쓴 내용은 그대로 남기며, 다시 저장할 수 있다", async () => {
    const user = userEvent.setup();
    render(<DiaryForm />);

    fireEvent.change(textarea(), { target: { value: "[저장오류] 시험" } });
    await user.click(saveButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.");
    expect(alert.textContent).toContain("쓴 내용은 그대로 남아 있어요.");
    expect(textarea().value).toBe("[저장오류] 시험");
    expect(screen.queryByLabelText("오늘의 일기 결과")).toBeNull();

    // 고쳐 쓰고 다시 저장
    fireEvent.change(textarea(), { target: { value: "다시 쓴 일기" } });
    await user.click(saveButton());
    await waitFor(() => expect(screen.getByLabelText("오늘의 일기 결과")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
