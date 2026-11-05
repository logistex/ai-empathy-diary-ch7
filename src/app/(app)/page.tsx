import type { Metadata } from "next";

import { Card } from "@/components/ui/Card";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "오늘의 일기" };

// 자리 표시용 화면(1단계). 일기 입력창, 글자 수, 무료 모델 안내, 결과 카드는 2단계에서 만든다.
// 이 경로는 src/proxy.ts가 로그인을 확인한다. (로그인하지 않으면 /login 으로 이동)
export default function HomePage() {
  return (
    <>
      <PageHeading title="오늘의 일기" description="오늘 있었던 일을 한 줄로 남겨 보세요." />
      <Card as="section" aria-labelledby="today-placeholder">
        <h2 id="today-placeholder">일기 쓰기</h2>
        <p>곧 이곳에서 오늘의 일기를 쓰고 AI의 공감 메시지를 받을 수 있어요.</p>
      </Card>
    </>
  );
}
