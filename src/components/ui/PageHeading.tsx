import styles from "./PageHeading.module.css";

type PageHeadingProps = {
  title: string;
  /** 제목 아래 짧은 안내 문구 */
  description?: string;
};

/** 쪽 제목(h1)과 안내 문구. 쪽마다 h1은 하나만 둔다. */
export function PageHeading({ title, description }: PageHeadingProps) {
  return (
    <div className={styles.heading}>
      <h1>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
