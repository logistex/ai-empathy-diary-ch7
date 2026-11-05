import type { HTMLAttributes, Ref } from "react";

import styles from "./Alert.module.css";

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, "role"> & {
  /** error: 오류(벽돌색) / success: 완료(초록) / info: 안내(베이지) */
  tone?: "error" | "success" | "info";
  /**
   * alert: 바로 읽어 주는 중요한 오류 / status: 차분히 알리는 상태.
   * 화면에 처음부터 있던 문구에는 role 이 소용없으므로, 나중에 나타나는 메시지에 쓴다.
   */
  role?: "alert" | "status";
  ref?: Ref<HTMLDivElement>;
};

/** 짧은 알림 상자. 색만으로 뜻을 전하지 않도록 문장으로 쓴다. */
export function Alert({ tone = "info", role, className, ...rest }: AlertProps) {
  return (
    <div
      role={role}
      className={[styles.alert, styles[tone], className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
