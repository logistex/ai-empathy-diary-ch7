import { signOut } from "@/auth";

import styles from "./SiteHeader.module.css";

/**
 * 로그아웃 버튼. 서버 액션에서 Auth.js의 signOut을 부른다.
 * 세션을 렌더링 중에 읽지 않으므로 <Suspense> 없이도 빌드에 문제가 없다.
 * (@/auth는 서버에서만 쓴다. 이 파일에 "use client"를 붙이지 않는다.)
 */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className={`${styles.navItem} ${styles.signOut}`}>
        로그아웃
      </button>
    </form>
  );
}
