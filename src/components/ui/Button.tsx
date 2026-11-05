import type { ComponentPropsWithRef } from "react";

import styles from "./Button.module.css";

type ButtonStyleOptions = {
  /** primary: 주요 행동 / secondary: 보조 행동 / quiet: 배경 없는 글자 버튼 */
  variant?: "primary" | "secondary" | "quiet";
  size?: "md" | "sm";
  /** 가로 전체 너비로 늘린다. (모바일 화면의 큰 버튼) */
  fullWidth?: boolean;
  className?: string;
};

// ComponentPropsWithRef: React 19 에서는 ref 를 일반 속성처럼 넘길 수 있다. (포커스를 옮길 때 사용)
type ButtonProps = ComponentPropsWithRef<"button"> & Omit<ButtonStyleOptions, "className">;

/**
 * 버튼 모양의 클래스 이름. 링크(<a>)를 버튼처럼 보이게 할 때도 쓴다.
 * (예: 기록이 없을 때 "오늘 쓰기" 링크)
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) {
  return [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 기본 버튼. 서버/클라이언트 컴포넌트 어디서나 쓸 수 있다. */
export function Button({
  variant,
  size,
  fullWidth,
  type = "button", // 폼 안에서 실수로 제출되지 않도록 기본은 button
  className,
  ...rest
}: ButtonProps & { className?: string }) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    />
  );
}
