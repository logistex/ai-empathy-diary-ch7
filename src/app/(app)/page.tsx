import type { Metadata } from "next";

import { DiaryForm } from "@/components/diary/DiaryForm";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "오늘의 일기" };

// 오늘의 일기 쓰기. 입력·저장·결과는 클라이언트 컴포넌트(DiaryForm)가 맡는다.
// 이 경로는 src/proxy.ts가 로그인을 확인한다. (로그인하지 않으면 /login 으로 이동)
export default function HomePage() {
  return (
    <>
      <PageHeading title="오늘의 일기" description="오늘 있었던 일을 한 줄로 남겨 보세요." />
      <DiaryForm />
    </>
  );
}
