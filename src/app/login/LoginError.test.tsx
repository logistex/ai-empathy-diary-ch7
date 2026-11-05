// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let query = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

import { LoginError, loginErrorMessage } from "./LoginError";

describe("loginErrorMessage", () => {
  it("오류가 없으면 null", () => {
    expect(loginErrorMessage(null)).toBeNull();
  });

  it("로그인 취소는 따로 안내한다", () => {
    expect(loginErrorMessage("AccessDenied")).toContain("취소");
  });

  it("그 밖의 코드는 기본 문구를 쓰고 코드 원문을 드러내지 않는다", () => {
    const message = loginErrorMessage("Configuration");
    expect(message).toContain("잠시 후 다시 시도");
    expect(message).not.toContain("Configuration");
  });
});

describe("LoginError", () => {
  afterEach(() => {
    cleanup();
  });

  it("?error= 가 있으면 role=alert 안내를 보여 준다", () => {
    query = "error=Configuration";
    render(<LoginError />);
    expect(screen.getByRole("alert").textContent).toContain("잠시 후 다시 시도");
  });

  it("?error= 가 없으면 아무것도 그리지 않는다", () => {
    query = "";
    const { container } = render(<LoginError />);
    expect(container.innerHTML).toBe("");
  });
});
