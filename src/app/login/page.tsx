import type { Metadata } from "next";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "로그인" };

// 로그인 화면. 경로 /login 과 서버 액션 방식(signIn("google", { redirectTo: "/" }))은 1단계에서 정해진 대로 유지한다.
// 로그인 처리는 서버 액션에서 Auth.js의 signIn을 부른다. 비밀 값은 이 파일에 없다.
// 세션을 렌더링 중에 읽지 않으므로 정적으로 만들어진다.
export default function LoginPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <Card as="section" aria-labelledby="login-title" className={styles.card}>
        <p className={styles.eyebrow}>한 줄 일기장</p>
        <h1 id="login-title" className={styles.title}>
          AI 공감 다이어리
        </h1>
        <p className={styles.intro}>
          오늘 있었던 일을 한 줄로 쓰면, AI가 마음을 읽고 따뜻하게 공감해 드려요.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" fullWidth>
            구글로 시작하기
          </Button>
        </form>
      </Card>
    </main>
  );
}
