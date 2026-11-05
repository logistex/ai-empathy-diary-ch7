// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSeedEntries,
  mockEntriesApi,
  resetMockApi,
  setMockOptions,
} from "@/lib/client/mock-api";

import { DEFAULT_COMFORT_MESSAGE } from "./messages";
import { HistoryList } from "./HistoryList";

vi.mock("@/lib/client/login-redirect", () => ({ redirectToLogin: vi.fn(), LOGIN_PATH: "/login" }));

type User = ReturnType<typeof userEvent.setup>;

const SEED = createSeedEntries();
const entryOf = (id: string) => SEED.find((entry) => entry.id === id)!;

/** 내용 글자로 일기 하나(article)를 찾는다. */
function articleOf(content: string): HTMLElement {
  return screen.getByText(content).closest("article") as HTMLElement;
}

async function openEntry(user: User, content: string): Promise<HTMLElement> {
  const article = articleOf(content);
  await user.click(within(article).getByRole("button", { name: /보기|접기/ }));
  return article;
}

beforeEach(() => {
  resetMockApi(undefined, { delayMs: 0 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("지난 기록 목록", () => {
  it("불러오는 동안 '불러오는 중'을 보여 준다", async () => {
    render(<HistoryList />);
    expect(screen.getByRole("status").textContent).toContain("기록을 불러오는 중이에요");
    await screen.findAllByRole("article");
  });

  it("최신순으로 날짜(한국 시간)별로 묶어 보여 주고, 감정은 글자로 표시한다", async () => {
    render(<HistoryList />);
    const articles = await screen.findAllByRole("article");

    // 최신순: 2026-11-05 14:20(한국 시간)이 맨 위, 그다음 14:12
    expect(articles[0].getAttribute("aria-label")).toBe("2026년 11월 5일 목요일 오후 2:20 일기");
    expect(articles[1].getAttribute("aria-label")).toBe("2026년 11월 5일 목요일 오후 2:12 일기");

    const days = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(days.slice(0, 3)).toEqual([
      "2026년 11월 5일 목요일",
      "2026년 11월 4일 수요일",
      "2026년 11월 3일 화요일",
    ]);

    // 감정: 이름과 강도를 글자로 보여 준다. 분석 실패는 '분석 안 됨'.
    expect(within(articles[0]).getByText("분석 안 됨")).toBeTruthy();
    expect(within(articles[1]).getByText("기쁨")).toBeTruthy();
    expect(within(articles[1]).getByText("강도 4/5")).toBeTruthy();
    expect(within(articles[1]).getByText(entryOf("mock-002").content)).toBeTruthy();
    expect(within(articles[1]).getByText("오후 2:12")).toBeTruthy();
  });

  it("일기를 열면 공감 메시지가 보이고, 위기가 아니면 상담 연락처 상자는 없다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    const message = entryOf("mock-002").empathyMessage!;
    const toggleHidden = screen.queryByText(message);
    // 닫혀 있을 때는 hidden 이라 접근성 트리에 없다. (DOM 에는 있다)
    expect(toggleHidden?.closest("[hidden]")).not.toBeNull();

    const article = await openEntry(user, entryOf("mock-002").content);
    expect(within(article).getByText(message)).toBeTruthy();
    expect(within(article).queryByRole("region", { name: "전문 상담 연락처 안내" })).toBeNull();
    expect(within(article).getByRole("button", { name: /접기/ }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("분석 실패한 일기를 열면 기본 위로 문구가 보인다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    const article = await openEntry(user, entryOf("mock-001").content);
    expect(within(article).getByText(DEFAULT_COMFORT_MESSAGE)).toBeTruthy();
  });

  it("위기 일기를 열면 상담 연락처 안내를 다시 볼 수 있다 (tel 링크)", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    // 열기 전에는 보이지 않는다.
    expect(screen.queryByRole("region", { name: "전문 상담 연락처 안내" })).toBeNull();

    const article = await openEntry(user, entryOf("mock-004").content);
    const box = within(article).getByRole("region", { name: "전문 상담 연락처 안내" });
    const hrefs = within(box)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["tel:109", "tel:15770199", "tel:1388", "tel:119"]);
    // 상자는 공감 메시지보다 위에 있다.
    const message = within(article).getByText(entryOf("mock-004").empathyMessage!);
    expect(box.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("위기 + 분석 실패 일기도 연락처와 기본 위로 문구를 보여 준다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    const article = await openEntry(user, entryOf("mock-006").content);
    expect(within(article).getByRole("region", { name: "전문 상담 연락처 안내" })).toBeTruthy();
    expect(within(article).getByText(DEFAULT_COMFORT_MESSAGE)).toBeTruthy();
    expect(within(article).getByText("분석 안 됨")).toBeTruthy();
  });

  it("HTML 문자열은 실행되지 않고 글자 그대로 보인다", async () => {
    render(<HistoryList />);
    await screen.findAllByRole("article");
    expect(screen.getByText(/<script>alert\('hello'\)<\/script>/)).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });
});

describe("더 보기 (cursor 페이지 나눔)", () => {
  it("10개씩 불러오고, 더 보기를 누르면 다음 기록이 이어지며 끝에서는 버튼이 사라진다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    expect((await screen.findAllByRole("article")).length).toBe(10);

    await user.click(screen.getByRole("button", { name: "더 보기" }));
    await waitFor(() => expect(screen.getAllByRole("article").length).toBe(20));
    // 포커스가 새로 불러온 첫 일기로 옮겨진다. (키보드 사용자가 위치를 잃지 않게)
    const firstNew = within(articleOf(entryOf("mock-011").content)).getByRole("button", {
      name: /보기|접기/,
    });
    expect(document.activeElement).toBe(firstNew);

    await user.click(screen.getByRole("button", { name: "더 보기" }));
    await waitFor(() => expect(screen.getAllByRole("article").length).toBe(23));
    expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
  });

  it("더 보기가 실패하면 이미 본 목록은 그대로 두고 오류와 다시 시도를 보여 준다", async () => {
    const user = userEvent.setup();
    resetMockApi(undefined, { delayMs: 0, list: "error-on-more" });
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await user.click(screen.getByRole("button", { name: "더 보기" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("다음 기록을 불러오지 못했어요.");
    expect(screen.getAllByRole("article").length).toBe(10);

    setMockOptions({ list: "normal" });
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getAllByRole("article").length).toBe(20));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("빈 상태와 불러오기 오류", () => {
  it("기록이 하나도 없으면 안내 문구와 오늘 쓰기 링크를 보여 준다", async () => {
    resetMockApi([], { delayMs: 0 });
    render(<HistoryList />);

    await screen.findByText("아직 쓴 일기가 없어요");
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("link", { name: "오늘의 일기 쓰기" }).getAttribute("href")).toBe("/");
  });

  it("불러오기에 실패하면 오류와 다시 시도를 보여 주고, 다시 시도하면 목록이 나온다", async () => {
    const user = userEvent.setup();
    resetMockApi(undefined, { delayMs: 0, list: "error" });
    render(<HistoryList />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("기록을 불러오지 못했어요.");
    expect(alert.textContent).toContain("잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.");
    expect(screen.queryByRole("article")).toBeNull();

    setMockOptions({ list: "normal" });
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect((await screen.findAllByRole("article")).length).toBe(10);
  });
});

describe("일기 삭제", () => {
  async function openDeleteDialog(user: User, content: string) {
    const article = await openEntry(user, content);
    const deleteButton = within(article).getByRole("button", { name: /일기 삭제/ });
    await user.click(deleteButton);
    return { article, deleteButton };
  }

  it("삭제 버튼을 누르면 바로 지우지 않고 PRD 문구의 확인 창을 연다 (포커스는 창 안 취소 버튼)", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "deleteEntry");
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);

    const dialog = screen.getByRole("alertdialog", { name: "이 일기를 지울까요?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByText("지우면 되돌릴 수 없어요.")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "지우기" })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "취소" }));
    expect(spy).not.toHaveBeenCalled();
  });

  it("취소하면 일기는 그대로 남고, 포커스는 삭제 버튼으로 돌아온다", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockEntriesApi, "deleteEntry");
    render(<HistoryList />);
    await screen.findAllByRole("article");

    const { deleteButton } = await openDeleteDialog(user, entryOf("mock-002").content);
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText(entryOf("mock-002").content)).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(deleteButton);
  });

  it("Esc 로 닫을 수 있고, 포커스가 돌아온다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    const { deleteButton } = await openDeleteDialog(user, entryOf("mock-002").content);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(deleteButton);
    expect(screen.getByText(entryOf("mock-002").content)).toBeTruthy();
  });

  it("Tab 을 눌러도 포커스가 창 밖으로 나가지 않는다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);
    const dialog = screen.getByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "취소" });
    const confirm = within(dialog).getByRole("button", { name: "지우기" });

    expect(document.activeElement).toBe(cancel);
    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel); // 끝에서 처음으로
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm); // 처음에서 끝으로
  });

  it("지우기를 확인하면 새로고침 없이 목록에서 사라지고 안내가 나온다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);
    await user.click(screen.getByRole("button", { name: "지우기" }));

    await waitFor(() => expect(screen.queryByText(entryOf("mock-002").content)).toBeNull());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getAllByRole("article").length).toBe(9);
    expect(screen.getByRole("status").textContent).toBe("일기를 지웠어요.");

    // 지운 일기의 버튼은 사라졌으므로, 포커스는 이웃한 일기의 버튼으로 간다.
    const neighbor = within(articleOf(entryOf("mock-003").content)).getByRole("button", {
      name: /보기|접기/,
    });
    expect(document.activeElement).toBe(neighbor);
  });

  it("삭제가 실패하면 일기는 목록에 남고, 창 안에 실패 안내가 나온다", async () => {
    const user = userEvent.setup();
    resetMockApi(undefined, { delayMs: 0, remove: "error" });
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);
    await user.click(screen.getByRole("button", { name: "지우기" }));

    const alert = await within(screen.getByRole("alertdialog")).findByRole("alert");
    expect(alert.textContent).toContain("일기를 지우지 못했어요. 일기는 그대로 남아 있어요.");
    expect(alert.textContent).toContain("잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.");
    // 일기는 목록에 그대로 있다. (확인 창 안의 미리보기에도 같은 글이 있어 목록 개수로 확인한다.)
    expect(screen.getAllByRole("article").length).toBe(10);

    // 닫으면 일기는 그대로 있다.
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByText(entryOf("mock-002").content)).toBeTruthy();
  });

  it("처리 중에는 지우기 버튼을 여러 번 눌러도 한 번만 요청하고, 창도 닫히지 않는다", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const spy = vi
      .spyOn(mockEntriesApi, "deleteEntry")
      .mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);
    await user.click(screen.getByRole("button", { name: "지우기" }));

    const busy = screen.getByRole("button", { name: "지우는 중…" });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    await user.click(busy);
    await user.click(busy);
    await user.keyboard("{Escape}"); // 처리 중에는 닫히지 않는다.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    finish();
    await waitFor(() => expect(screen.queryByText(entryOf("mock-002").content)).toBeNull());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("위기 일기와 분석 실패 일기도 똑같이 지울 수 있다", async () => {
    const user = userEvent.setup();
    render(<HistoryList />);
    await screen.findAllByRole("article");

    for (const id of ["mock-004", "mock-006"]) {
      await openDeleteDialog(user, entryOf(id).content);
      await user.click(screen.getByRole("button", { name: "지우기" }));
      await waitFor(() => expect(screen.queryByText(entryOf(id).content)).toBeNull());
    }
    expect(screen.getAllByRole("article").length).toBe(8);
  });

  it("마지막 일기를 지우면 빈 상태 안내가 나온다", async () => {
    const user = userEvent.setup();
    resetMockApi([entryOf("mock-002")], { delayMs: 0 });
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);
    await user.click(screen.getByRole("button", { name: "지우기" }));

    await screen.findByText("아직 쓴 일기가 없어요");
    expect(screen.getByRole("status").textContent).toBe("일기를 지웠어요.");
  });

  it("이미 지워진 일기(404)면 목록에서만 빼고 알려 준다", async () => {
    const user = userEvent.setup();
    resetMockApi(undefined, { delayMs: 0, remove: "not-found" });
    render(<HistoryList />);
    await screen.findAllByRole("article");

    await openDeleteDialog(user, entryOf("mock-002").content);
    await user.click(screen.getByRole("button", { name: "지우기" }));

    await waitFor(() => expect(screen.queryByText(entryOf("mock-002").content)).toBeNull());
    expect(screen.getByRole("status").textContent).toContain("이미 지워진 일기");
  });
});
