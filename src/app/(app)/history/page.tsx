import type { Metadata } from "next";

import { Card } from "@/components/ui/Card";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "지난 기록" };

// 자리 표시용 화면(1단계). 날짜별 목록, 감정 표시, 더 보기, 삭제는 2단계에서 만든다.
export default function HistoryPage() {
  return (
    <>
      <PageHeading
        title="지난 기록"
        description="지금까지 남긴 일기와 그날의 감정을 돌아볼 수 있어요."
      />
      <Card as="section" aria-labelledby="history-placeholder">
        <h2 id="history-placeholder">기록 목록</h2>
        <p>곧 이곳에서 날짜별로 지난 일기를 볼 수 있어요.</p>
      </Card>
    </>
  );
}
