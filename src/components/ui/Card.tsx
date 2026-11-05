import type { ElementType, HTMLAttributes } from "react";

import styles from "./Card.module.css";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** 실제로 쓸 HTML 태그. 의미에 맞게 고른다. (예: section, article, div) */
  as?: ElementType;
};

/** 종이 카드. 일기 입력, 결과, 기록 항목 등을 담는 바탕 상자. */
export function Card({ as: Tag = "div", className, ...rest }: CardProps) {
  return <Tag className={[styles.card, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}
