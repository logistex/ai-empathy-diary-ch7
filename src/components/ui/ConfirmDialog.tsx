"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Alert } from "./Alert";
import { Button } from "./Button";
import styles from "./ConfirmDialog.module.css";

type ConfirmDialogProps = {
  open: boolean;
  /** 창 제목. 스크린 리더가 창 이름으로 읽는다. */
  title: string;
  /** 제목 아래 설명. 스크린 리더가 제목 다음에 읽는다. */
  description: string;
  /** 일기 내용 같은 보충 내용 (선택) */
  children?: ReactNode;
  confirmLabel: string;
  /** 처리 중에 확인 버튼에 보일 글자 */
  pendingLabel: string;
  cancelLabel?: string;
  /** 처리 중: 중복 클릭과 닫기를 막는다. */
  pending?: boolean;
  /** 처리에 실패했을 때 창 안에 보일 안내 */
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 확인 대화상자 (지우기 확인 등).
 *
 * - 열리면 포커스가 창 안(취소 버튼)으로 옮겨지고, Tab 이 창 밖으로 나가지 않는다.
 * - Esc 와 바깥 눌러서 닫을 수 있다. (처리 중에는 닫히지 않는다.)
 * - 닫히면 포커스가 창을 열기 전 자리로 돌아간다. (그 자리가 사라졌다면 부르는 쪽이 정한다.)
 * - 처리 중에는 disabled 대신 aria-disabled 를 써서 포커스를 잃지 않게 한다.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<DialogContent {...props} />, document.body);
}

function DialogContent({
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "취소",
  pending = false,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 열릴 때: 열기 전 포커스 자리를 기억하고, 취소 버튼으로 포커스를 옮기고, 뒤쪽 스크롤을 잠근다.
  // 닫힐 때: 되돌린다.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener && document.contains(opener)) {
        opener.focus();
      }
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!pending) onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    // 창 안에서만 Tab 이 돌게 한다.
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        // 어두운 바깥 부분을 눌렀을 때만 닫는다. (창 안에서 시작한 클릭은 무시)
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={styles.dialog}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
        {children}
        {errorMessage ? <Alert tone="error" role="alert">{errorMessage}</Alert> : null}
        <p className="visually-hidden" role="status">
          {pending ? pendingLabel : ""}
        </p>
        <div className={styles.actions}>
          <Button
            ref={cancelRef}
            variant="secondary"
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onCancel();
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onConfirm();
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
