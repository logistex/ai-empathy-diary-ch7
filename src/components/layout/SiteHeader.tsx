import Link from "next/link";

import { NavLink } from "./NavLink";
import { SignOutButton } from "./SignOutButton";
import styles from "./SiteHeader.module.css";

/** 로그인한 뒤 모든 쪽 위에 보이는 머리글: 앱 이름, 메뉴(오늘 쓰기 / 지난 기록), 로그아웃. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          AI 공감 다이어리
        </Link>
        <nav aria-label="주 메뉴" className={styles.nav}>
          <ul className={styles.navList}>
            <li>
              <NavLink href="/">오늘 쓰기</NavLink>
            </li>
            <li>
              <NavLink href="/history">지난 기록</NavLink>
            </li>
            <li>
              <SignOutButton />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
