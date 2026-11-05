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
import { FREE_MODEL_NOTICE } from "./messages";

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // 상태(saving)는 다음 화면 그리기 때 바뀌므로, 아주 빠른 두 번 클릭을 막으려고 ref 도 함께 쓴다.
  const submittingRef = useRef(false);

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
      setResult(entry);
      setText("");
      setShowEmpty(false);
    } catch (error) {
      // 401 이면 entries-client 가 로그인 화면으로 보낸다. 그 사이 보일 안내만 둔다.
      setSaveError(
        isApiClientError(error) && error.status === 401
          ? "로그인이 필요해요. 로그인 화면으로 이동할게요."
          : `${errorMessageOf(error)} 쓴 내용은 그대로 남아 있어요.`,
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
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
            <span>분석 중이에요. 마음을 천천히 읽고 있어요.</span>
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
