import { SiteHeader } from "@/components/layout/SiteHeader";

import styles from "./layout.module.css";

/**
 * 로그인한 사용자가 보는 쪽들의 공통 틀: 머리글 + 본문.
 * 이 틀에는 세션을 읽는 코드가 없으므로 정적으로 만들어진다. (로그인 확인은 src/proxy.ts가 한다.)
 * /login은 이 그룹 밖에 있어 머리글이 보이지 않는다.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
