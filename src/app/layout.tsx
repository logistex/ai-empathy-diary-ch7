import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";

import "./globals.css";

/*
 * 글꼴을 next/font로 불러오는 이유
 * - 빌드할 때 글꼴 파일을 내려받아 같은 서버에서 내려 주므로, 방문자의 브라우저가 구글 글꼴 서버에
 *   접속하지 않는다. (일기 앱이라 개인정보 면에서 유리하다.)
 * - 한글 글꼴은 용량이 커서, 쓰이는 글자 조각만 나눠 받는다. (preload: false로 첫 화면 전송량을 줄임)
 * - display: "swap"으로 글꼴이 오기 전에도 시스템 글꼴로 글이 먼저 보이고, size-adjust로 자리 밀림을 줄인다.
 * 본문은 Noto Sans KR(또렷한 고딕), 제목은 Gowun Batang(손글씨 느낌의 부드러운 바탕체)을 쓴다.
 */
const bodyFont = Noto_Sans_KR({
  weight: "variable",
  display: "swap",
  preload: false,
  variable: "--font-body",
});

const displayFont = Gowun_Batang({
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "AI 공감 다이어리",
    template: "%s | AI 공감 다이어리",
  },
  description: "오늘 있었던 일을 한 줄로 쓰면 AI가 감정을 읽고 공감해 주는 일기장",
};

export const viewport: Viewport = {
  themeColor: "#fbf5e9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        {/* 키보드 사용자가 머리글을 건너뛰고 본문으로 바로 가는 링크. 포커스를 받으면 나타난다. */}
        <a href="#main-content" className="skip-link">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
