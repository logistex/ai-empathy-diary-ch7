"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./SiteHeader.module.css";

/** 지금 보고 있는 쪽이면 aria-current="page"를 붙이는 메뉴 링크. (경로를 읽으려고 클라이언트 컴포넌트로 둠) */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const isCurrent = pathname === href;

  return (
    <Link
      href={href}
      className={styles.navItem}
      aria-current={isCurrent ? "page" : undefined}
      data-current={isCurrent ? "true" : undefined}
    >
      {children}
    </Link>
  );
}
