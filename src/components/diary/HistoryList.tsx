"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CrisisBox } from "@/components/crisis/CrisisBox";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { deleteEntry, listEntries } from "@/lib/client/entries-client";
import { errorMessageOf, isApiClientError } from "@/lib/client/errors";
import { formatKoreanDate, formatKoreanTime, koreanDateKey } from "@/lib/client/format";
import type { Entry } from "@/lib/client/types";

import { EmotionBadge } from "./EmotionBadge";
import { EmpathyText } from "./EmpathyText";
import styles from "./HistoryList.module.css";
import { DELETE_CONFIRM_DESCRIPTION, DELETE_CONFIRM_TITLE } from "./messages";

/*
 * 지난 기록 목록.
 *
 * 일기 하나를 여는 방식: 상세 쪽(/history/[id])으로 가지 않고 그 자리에서 펼친다(공개/접기 버튼).
 *  - 목록 응답이 일기 객체 전체(공감 메시지, isCrisis 포함)를 주므로 따로 요청할 필요가 없다.
 *  - 보던 위치와 더 보기로 불러온 목록이 그대로 유지되고, 삭제 뒤 포커스도 목록 안에서 이어 갈 수 있다.
 *  - 위기 일기를 펼치면 상담 연락처 상자를 다시 볼 수 있다. (PRD F5 완료 조건 6)
 */

type LoadState = "loading" | "ready" | "error";
type MoreState = "idle" | "loading" | "error";

type DayGroup = { key: string; label: string; entries: Entry[] };

/** 한국 시간 기준 날짜로 묶는다. 목록은 이미 최신순이므로 이웃한 같은 날짜끼리 묶으면 된다. */
function groupByDay(entries: Entry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const key = koreanDateKey(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: formatKoreanDate(entry.createdAt), entries: [entry] });
    }
  }
  return groups;
}

function toggleLabel(entry: Entry): string {
  if (entry.isCrisis) return "공감 메시지와 상담 연락처 보기";
  return entry.analysisStatus === "success" ? "공감 메시지 보기" : "위로 문구 보기";
}

/** 지우기 확인 창에 보여 줄 일기 앞부분 (글자 단위로 자른다) */
function preview(content: string): string {
  const chars = Array.from(content);
  return chars.length > 40 ? `${chars.slice(0, 40).join("")}…` : content;
}

type FocusTarget = { kind: "entry"; id: string } | { kind: "notice" };

export function HistoryList() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [moreState, setMoreState] = useState<MoreState>("idle");
  const [moreError, setMoreError] = useState("");

  const [openIds, setOpenIds] = useState<string[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const noticeRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  // 상태는 다음 화면 그리기 때 바뀌므로, 아주 빠른 두 번 클릭을 막으려고 ref 도 함께 쓴다.
  const deletingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const groups = useMemo(() => groupByDay(entries), [entries]);

  // 첫 페이지 불러오기 (처음 열 때, 그리고 "다시 시도"를 눌렀을 때)
  useEffect(() => {
    let ignore = false;
    listEntries()
      .then((page) => {
        if (ignore) return;
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setLoadError(errorMessageOf(error));
        setLoadState("error");
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // 목록이 바뀐 뒤(삭제, 더 보기) 정해 둔 자리로 포커스를 옮긴다. 지운 일기의 버튼은 사라졌기 때문이다.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.kind === "entry") {
      toggleRefs.current.get(target.id)?.focus();
    } else {
      noticeRef.current?.focus();
    }
  }, [entries]);

  function retryLoad() {
    setLoadState("loading");
    setReloadKey((key) => key + 1);
  }

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setMoreState("loading");
    setMoreError("");
    try {
      const page = await listEntries({ cursor: nextCursor });
      const known = new Set(entries.map((entry) => entry.id));
      const fresh = page.entries.filter((entry) => !known.has(entry.id));
      if (fresh.length > 0) pendingFocus.current = { kind: "entry", id: fresh[0].id };
      setEntries((prev) => [...prev, ...fresh]);
      setNextCursor(page.nextCursor);
      setMoreState("idle");
    } catch (error) {
      setMoreError(errorMessageOf(error));
      setMoreState("error");
    } finally {
      loadingMoreRef.current = false;
    }
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function openDeleteDialog(entry: Entry) {
    setNotice(null);
    setDeleteError(null);
    setDeleteTarget(entry);
  }

  function closeDeleteDialog() {
    if (deletingRef.current) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  /** 목록에서 일기를 뺀다. 포커스는 이웃한 일기로, 없으면 안내 문구로 보낸다. */
  function removeFromList(id: string, message: string) {
    const index = entries.findIndex((entry) => entry.id === id);
    const neighbor = entries[index + 1] ?? entries[index - 1];
    pendingFocus.current = neighbor ? { kind: "entry", id: neighbor.id } : { kind: "notice" };
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    setOpenIds((prev) => prev.filter((item) => item !== id));
    setDeleteTarget(null);
    setDeleteError(null);
    setNotice(message);
  }

  async function confirmDelete() {
    if (!deleteTarget || deletingRef.current) return; // 처리 중 중복 클릭 방지
    const target = deleteTarget;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEntry(target.id);
      removeFromList(target.id, "일기를 지웠어요.");
    } catch (error) {
      if (isApiClientError(error) && error.code === "NOT_FOUND") {
        // 이미 지워졌거나 없는 일기: 목록에서만 빼 준다.
        removeFromList(target.id, "이미 지워진 일기라서 목록에서 뺐어요.");
      } else if (isApiClientError(error) && error.status === 401) {
        setDeleteError("로그인이 필요해요. 로그인 화면으로 이동할게요.");
      } else {
        // 실패하면 일기는 목록에 그대로 남는다.
        setDeleteError(`일기를 지우지 못했어요. 일기는 그대로 남아 있어요. ${errorMessageOf(error)}`);
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  // ---------- 화면 ----------

  if (loadState === "loading") {
    return (
      <div className={styles.loading} role="status">
        <Spinner />
        <span>기록을 불러오는 중이에요…</span>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <Card as="section" aria-label="기록 불러오기 오류" className={styles.errorCard}>
        <Alert tone="error" role="alert">
          기록을 불러오지 못했어요. {loadError}
        </Alert>
        <div>
          <Button onClick={retryLoad}>다시 시도</Button>
        </div>
      </Card>
    );
  }

  const notices = notice ? (
    <Alert ref={noticeRef} tone="success" role="status" tabIndex={-1}>
      {notice}
    </Alert>
  ) : null;

  if (entries.length === 0 && !nextCursor) {
    return (
      <div className={styles.list}>
        {notices}
        <Card as="section" aria-labelledby="history-empty-title" className={styles.empty}>
          <h2 id="history-empty-title">아직 쓴 일기가 없어요</h2>
          <p>오늘 있었던 일을 한 줄로 남겨 보세요. 쓴 일기는 이곳에 차곡차곡 쌓여요.</p>
          <div>
            <Link href="/" className={buttonClassName({})}>
              오늘의 일기 쓰기
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {notices}

      {groups.map((group) => {
        const headingId = `history-day-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId} className={styles.day}>
            <h2 id={headingId} className={styles.dayTitle}>
              {group.label}
            </h2>
            <ul className={styles.items}>
              {group.entries.map((entry) => {
                const isOpen = openIds.includes(entry.id);
                const panelId = `history-panel-${entry.id}`;
                const time = formatKoreanTime(entry.createdAt);
                const when = `${group.label} ${time}`;
                return (
                  <li key={entry.id}>
                    <article className={styles.entry} aria-label={`${when} 일기`}>
                      <div className={styles.meta}>
                        <time dateTime={entry.createdAt} className={styles.time}>
                          {time}
                        </time>
                        <EmotionBadge emotion={entry.emotion} emotionScore={entry.emotionScore} />
                      </div>
                      <p className={styles.content}>{entry.content}</p>
                      <button
                        type="button"
                        ref={(element) => {
                          if (element) toggleRefs.current.set(entry.id, element);
                          else toggleRefs.current.delete(entry.id);
                        }}
                        className={styles.toggle}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleOpen(entry.id)}
                      >
                        <span aria-hidden="true" className={isOpen ? styles.chevronUp : styles.chevron} />
                        {isOpen ? "접기" : toggleLabel(entry)}
                        <span className="visually-hidden"> ({when} 일기)</span>
                      </button>
                      <div id={panelId} hidden={!isOpen} className={styles.panel}>
                        {entry.isCrisis ? <CrisisBox /> : null}
                        <EmpathyText entry={entry} />
                        <div className={styles.panelActions}>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`일기 삭제 (${when})`}
                            onClick={() => openDeleteDialog(entry)}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {nextCursor ? (
        <div className={styles.more}>
          {moreState === "error" ? (
            <Alert tone="error" role="alert">
              다음 기록을 불러오지 못했어요. {moreError}
            </Alert>
          ) : null}
          <Button
            variant="secondary"
            fullWidth
            aria-disabled={moreState === "loading"}
            onClick={loadMore}
          >
            {moreState === "loading" ? (
              <>
                <Spinner />
                불러오는 중…
              </>
            ) : moreState === "error" ? (
              "다시 시도"
            ) : (
              "더 보기"
            )}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={DELETE_CONFIRM_TITLE}
        description={DELETE_CONFIRM_DESCRIPTION}
        confirmLabel="지우기"
        pendingLabel="지우는 중…"
        pending={deleting}
        errorMessage={deleteError}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      >
        {deleteTarget ? <p className={styles.preview}>{preview(deleteTarget.content)}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
