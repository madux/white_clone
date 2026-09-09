"use client";

import { AlertCircle } from "lucide-react";

export function QueryError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state query-error">
      <div className="empty-icon"><AlertCircle size={24} /></div>
      <strong>Something went wrong</strong>
      <p>{message || "We couldn't load this section. Please try again."}</p>
      {onRetry && (
        <button type="button" className="secondary-button small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
