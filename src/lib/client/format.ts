/**
 * 날짜 표시 — 한국 시간(Asia/Seoul), 한국어 형식.
 * API 는 UTC 문자열(ISO 8601)로 시간을 주므로 화면에서 한국 시간으로 바꿔 보여 준다.
 */

const TIME_ZONE = "Asia/Seoul";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 예: "2026년 11월 5일 목요일" */
export function formatKoreanDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

/** 예: "오후 2:12" */
export function formatKoreanTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
}

/** 한국 시간 기준 날짜 묶음 키. 예: "2026-11-05" (같은 날이면 같은 키) */
export function koreanDateKey(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : keyFormatter.format(date);
}
