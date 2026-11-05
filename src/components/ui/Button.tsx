import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: 주요 행동 / secondary: 보조 행동 / quiet: 배경 없는 글자 버튼 */
  variant?: "primary" | "secondary" | "quiet";
  size?: "md" | "sm";
  /** 가로 전체 너비로 늘린다. (모바일 화면의 큰 버튼) */
  fullWidth?: boolean;
};

/** 기본 버튼. 서버/클라이언트 컴포넌트 어디서나 쓸 수 있다. */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button", // 폼 안에서 실수로 제출되지 않도록 기본은 button
  className,
  ...rest
}: ButtonProps) {
  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classNames} {...rest} />;
}
