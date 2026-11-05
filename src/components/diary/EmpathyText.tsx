import type { Entry } from "@/lib/client/types";

import { DEFAULT_COMFORT_MESSAGE } from "./messages";
import styles from "./EmpathyText.module.css";

/**
 * 공감 메시지. 분석에 실패했거나 메시지가 없으면 기본 위로 문구를 보여 준다.
 * (오류 화면을 띄우지 않는다 — PRD F3 완료 조건 5)
 * 글자는 React 기본 출력만 쓰므로 일기 속 HTML 은 실행되지 않는다.
 */
export function EmpathyText({ entry }: { entry: Entry }) {
  const message =
    entry.analysisStatus === "success" && entry.empathyMessage
      ? entry.empathyMessage
      : DEFAULT_COMFORT_MESSAGE;

  return <p className={styles.message}>{message}</p>;
}
