import type { Emotion, EmotionScore } from "@/lib/client/types";

import { NO_ANALYSIS_LABEL } from "./messages";
import styles from "./EmotionBadge.module.css";

type EmotionBadgeProps = {
  /** null 이면 분석 실패 — "분석 안 됨"으로 표시한다. */
  emotion: Emotion | null;
  emotionScore: EmotionScore | null;
};

const EMOTION_CLASS: Record<Emotion, string> = {
  기쁨: styles.joy,
  슬픔: styles.sad,
  분노: styles.anger,
  불안: styles.anxious,
  평온: styles.calm,
};

/**
 * 감정 표시. 색은 보조일 뿐이고 감정 이름과 강도를 글자로 쓴다. (색만으로 구분하지 않는다.)
 * 강도 점 5개는 장식이며, 같은 정보를 "강도 4/5" 글자로 함께 보여 준다.
 */
export function EmotionBadge({ emotion, emotionScore }: EmotionBadgeProps) {
  if (!emotion) {
    return <span className={`${styles.badge} ${styles.none}`}>{NO_ANALYSIS_LABEL}</span>;
  }

  return (
    <span className={`${styles.badge} ${EMOTION_CLASS[emotion]}`}>
      <span className={styles.name}>{emotion}</span>
      {emotionScore ? (
        <>
          <span className={styles.dots} aria-hidden="true">
            {[1, 2, 3, 4, 5].map((level) => (
              <span key={level} className={level <= emotionScore ? styles.dotOn : styles.dotOff} />
            ))}
          </span>
          <span className={styles.score}>강도 {emotionScore}/5</span>
        </>
      ) : null}
    </span>
  );
}
