import styles from "./Spinner.module.css";

/** 돌아가는 작은 표시. 장식이므로 스크린 리더는 읽지 않는다. (함께 쓰는 글자가 상태를 알린다.) */
export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}
