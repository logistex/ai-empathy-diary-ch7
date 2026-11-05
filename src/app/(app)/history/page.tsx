import type { Metadata } from "next";

import { HistoryList } from "@/components/diary/HistoryList";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "지난 기록" };

// 지난 기록. 목록 불러오기·더 보기·삭제는 클라이언트 컴포넌트(HistoryList)가 맡는다.
export default function HistoryPage() {
  return (
    <>
      <PageHeading
        title="지난 기록"
        description="지금까지 남긴 일기와 그날의 감정을 돌아볼 수 있어요."
      />
      <HistoryList />
    </>
  );
}
