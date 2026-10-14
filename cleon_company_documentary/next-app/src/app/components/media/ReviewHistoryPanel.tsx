"use client";

import { LoaderCircle } from "lucide-react";
import { useDocumentaryAuditLog } from "../../../../hooks/useDocumentary";

const REVIEW_EVENTS = new Set([
  "lifecycle_transition",
  "submitted",
  "withdrawn",
  "approved",
  "returned",
  "published",
  "archived",
  "republish_requested",
  "processing_failed",
]);

function formatEvent(eventType: string, metadata: Record<string, unknown>): string {
  const fromStatus = metadata.from_status as string | undefined;
  const toStatus = metadata.to_status as string | undefined;
  if (eventType === "lifecycle_transition" && fromStatus && toStatus) {
    return `${fromStatus.replace(/_/g, " ")} → ${toStatus.replace(/_/g, " ")}`;
  }
  if (eventType === "returned" && metadata.reason) {
    return `Returned: ${metadata.reason}`;
  }
  return eventType.replace(/_/g, " ");
}

export function ReviewHistoryPanel({ mediaId }: { mediaId: number }) {
  const query = useDocumentaryAuditLog(mediaId, true);

  if (query.isLoading) {
    return (
      <div className="panel-loading">
        <LoaderCircle className="spin" size={18} />
        <span>Loading review history…</span>
      </div>
    );
  }
  if (query.isError) {
    return <p className="panel-error">Review history is available to managers only.</p>;
  }
  const events = (query.data ?? []).filter((event) => REVIEW_EVENTS.has(event.event_type));
  if (!events.length) {
    return <p className="panel-muted">No review events recorded yet.</p>;
  }

  return (
    <ul className="review-history-list">
      {events.map((event) => (
        <li key={event.id}>
          <div className="review-history-row">
            <strong>{formatEvent(event.event_type, event.metadata || {})}</strong>
            <time dateTime={event.created_at}>
              {new Date(event.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </div>
          <span className="review-history-user">{event.user_name}</span>
        </li>
      ))}
    </ul>
  );
}
