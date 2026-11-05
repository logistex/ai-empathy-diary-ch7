import { CrisisBox } from "@/components/crisis/CrisisBox";
import { Card } from "@/components/ui/Card";
import type { Entry } from "@/lib/client/types";

import { EmotionBadge } from "./EmotionBadge";
import { EmpathyText } from "./EmpathyText";
import styles from "./EntryResult.module.css";

/**
 * 일기를 저장한 직후 보여 주는 결과.
 *
 *  분석 성공          → 감정·강도·공감 메시지 카드
 *  분석 성공 + 위기   → 상담 연락처 상자 → 카드
 *  분석 실패          → "분석 안 됨" + 기본 위로 문구
 *  분석 실패 + 위기   → 상담 연락처 상자 → 기본 위로 문구
 * 위기 상자는 항상 공감 메시지(또는 기본 위로 문구) 위에 있다. (PRD F5 완료 조건 1)
 */
export function EntryResult({ entry }: { entry: Entry }) {
  return (
    <div className={styles.result}>
      {entry.isCrisis ? <CrisisBox /> : null}
      <Card as="article" aria-label="오늘의 일기 결과" className={styles.card}>
        <div className={styles.head}>
          <EmotionBadge emotion={entry.emotion} emotionScore={entry.emotionScore} />
        </div>
        <EmpathyText entry={entry} />
      </Card>
    </div>
  );
}
