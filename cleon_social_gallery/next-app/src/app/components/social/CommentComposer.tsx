"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useEffect, useRef, type FormEvent, type KeyboardEvent, type RefObject } from "react";

export function CommentComposer({
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
  placeholder = "Add a comment…",
  replyTo,
  onCancelReply,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: string;
  onCancelReply?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const fieldRef = inputRef || localRef;

  useEffect(() => {
    if (replyTo) fieldRef.current?.focus();
  }, [replyTo, fieldRef]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!value.trim() || loading || disabled) return;
    onSubmit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="social-comment-composer" onSubmit={submit}>
      {replyTo && (
        <div className="social-comment-replying">
          Replying to <strong>{replyTo}</strong>
          {onCancelReply && (
            <button type="button" className="social-comment-action" onClick={onCancelReply}>
              Cancel
            </button>
          )}
        </div>
      )}
      <div className="social-comment-input-row">
        <input
          ref={fieldRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          aria-label="Write a comment"
        />
        <button type="submit" className="social-comment-send" disabled={!value.trim() || loading || disabled}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
        </button>
      </div>
    </form>
  );
}
