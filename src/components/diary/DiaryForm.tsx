"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { createEntry } from "@/lib/client/entries-client";
import { isApiClientError, errorMessageOf } from "@/lib/client/errors";
import type { Entry } from "@/lib/client/types";
import {
  DIARY_MAX_LENGTH,
  EMPTY_MESSAGE,
  TOO_LONG_MESSAGE,
  validateDiaryContent,
} from "@/lib/client/validation";

import styles from "./DiaryForm.module.css";
import { EntryResult } from "./EntryResult";
import {
  ANALYZING_MESSAGE,
  ANALYZING_SLOW_MESSAGE,
  FREE_MODEL_NOTICE,
  SLOW_ANALYSIS_AFTER_MS,
} from "./messages";

/**
 * 오늘의 일기 쓰기: 한 줄 입력 → 저장 → 분석 중 → 결과(감정·공감 메시지, 위기면 상담 연락처).
 *
 * 입력창 아래 순서(PRD F3 완료 조건 8~12): 입력창(글자 수) → 오류 → 무료 모델 안내 → 저장 버튼 → 결과.
 * 안내 문구는 접거나 닫을 수 없고, 결과가 나온 뒤에도 그대로 있다.
 */
export function DiaryForm() {
  const textareaId = useId();
  const counterId = useId();
  const noticeId = useId();
  const errorId = useId();

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Entry | null>(null);
  // 저장 버튼을 눌렀는데 비어 있던 경우에만 "빈 입력" 안내를 보인다. (처음부터 오류로 보이지 않게)
  const [showEmpty, setShowEmpty] = useState(false);
  // 서버/네트워크 오류. 쓴 내용은 지우지 않는다.
  const [saveError, setSaveError] = useState<string | null>(null);
  // 분석이 오래 걸릴 때 안심 문구로 바꾸는 표시
  const [slow, setSlow] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // 상태(saving)는 다음 화면 그리기 때 바뀌므로, 아주 빠른 두 번 클릭을 막으려고 ref 도 함께 쓴다.
  const submittingRef = useRef(false);
  // 기다리는 동안 다른 쪽으로 이동하면 이 화면은 사라진다. 사라진 화면의 상태는 바꾸지 않는다.
  // (요청은 계속 진행되어 일기는 서버에 저장된다. 지난 기록에서 볼 수 있다.)
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 저장 중 15초가 지나도록 끝나지 않으면 안심 문구로 바꾼다. 끝나거나 화면을 떠나면 타이머를 정리한다.
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => setSlow(true), SLOW_ANALYSIS_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [saving]);

  // 서버와 같은 기준: 앞뒤 공백을 지운 뒤 글자 수(Array.from)로 센다.
  const checked = validateDiaryContent(text);
  const length = checked.length;
  const tooLong = length > DIARY_MAX_LENGTH;
  const fieldError = tooLong ? TOO_LONG_MESSAGE : showEmpty && length === 0 ? EMPTY_MESSAGE : null;

  // 결과 카드가 화면 밖에 있으면(모바일) 보이는 곳으로 가져온다.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return; // 저장 중 중복 제출 방지

    if (!checked.ok) {
      setShowEmpty(true);
      textareaRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setResult(null);
    setSaveError(null);

    try {
      const entry = await createEntry(checked.content);
      if (!mountedRef.current) return;
      setResult(entry);
      setText("");
      setShowEmpty(false);
    } catch (error) {
      if (!mountedRef.current) return;
      // 401 이면 entries-client 가 로그인 화면으로 보낸다. 그 사이 보일 안내만 둔다.
      setSaveError(
        isApiClientError(error) && error.status === 401
          ? "로그인이 필요해요. 로그인 화면으로 이동할게요."
          : `${errorMessageOf(error)} 쓴 내용은 그대로 남아 있어요.`,
      );
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  const describedBy = [fieldError ? errorId : null, noticeId, counterId].filter(Boolean).join(" ");

  return (
    <div className={styles.wrapper}>
      <Card>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label htmlFor={textareaId} className={styles.label}>
            오늘의 한 줄
          </label>

          <div
            className={[
              styles.field,
              tooLong ? styles.fieldInvalid : "",
              saving ? styles.fieldBusy : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <textarea
              ref={textareaRef}
              id={textareaId}
              className={styles.textarea}
              value={text}
              rows={4}
              placeholder="예) 오늘 친구와 오랜만에 만나서 많이 웃었다."
              readOnly={saving}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={describedBy}
              onChange={(event) => {
                setText(event.target.value);
                setShowEmpty(false);
              }}
            />
            {/* 글자 수: 화면에는 "37/200", 스크린 리더에는 풀어서 읽어 준다. (입력할 때마다 읽지는 않는다.) */}
            <p id={counterId} className={`${styles.counter} ${tooLong ? styles.counterOver : ""}`}>
              <span aria-hidden="true">
                {length}/{DIARY_MAX_LENGTH}
              </span>
              <span className="visually-hidden">
                {DIARY_MAX_LENGTH}자 중 {length}자
              </span>
            </p>
          </div>

          {fieldError ? (
            <p id={errorId} role="alert" className={styles.fieldError}>
              {fieldError}
            </p>
          ) : null}

          {/* 무료 모델 안내: 입력창 바로 아래, 저장 버튼보다 위. 닫기·접기 없음. 입력창 설명으로도 읽힌다. */}
          <p id={noticeId} className={styles.notice}>
            {FREE_MODEL_NOTICE}
          </p>

          <div className={styles.actions}>
            <Button type="submit" aria-disabled={saving} className={styles.submit}>
              {saving ? "분석 중…" : "저장하기"}
            </Button>
          </div>
        </form>
      </Card>

      {/* 결과가 나오면 스크린 리더가 읽는 영역. 처음부터 화면에 있어야 변화가 읽힌다. */}
      <div ref={resultRef} className={styles.live} aria-live="polite">
        {saving ? (
          <p className={styles.analyzing}>
            <Spinner />
            <span>{slow ? ANALYZING_SLOW_MESSAGE : ANALYZING_MESSAGE}</span>
          </p>
        ) : null}
        {saveError ? (
          <Alert tone="error" role="alert">
            {saveError}
          </Alert>
        ) : null}
        {result ? <EntryResult entry={result} /> : null}
      </div>
    </div>
  );
}
