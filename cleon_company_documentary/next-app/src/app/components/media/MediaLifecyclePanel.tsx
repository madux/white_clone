"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { DocumentaryMedia, DocumentarySettings } from "../../../../lib/types";
import {
  lifecycleActionLabel,
  lifecycleActionsForMedia,
  publishReadiness,
  statusDisplay,
  type LifecycleAction,
} from "../../../../lib/lifecycleUtils";
import { useMediaApproval } from "../../../../hooks/useDocumentary";
import { useDocumentarySettings } from "../../../../hooks/useDocumentary";

export function MediaLifecyclePanel({
  media,
  isAdministrator,
  isSupervisor,
  userId,
  onUpdated,
  onError,
  compact = false,
}: {
  media: DocumentaryMedia;
  isAdministrator: boolean;
  isSupervisor: boolean;
  userId?: number;
  onUpdated: (media: DocumentaryMedia) => void;
  onError: (message: string) => void;
  compact?: boolean;
}) {
  const approval = useMediaApproval();
  const canUsePanel = isAdministrator || isSupervisor || Boolean(media.can_edit);
  const settingsQuery = useDocumentarySettings(canUsePanel);
  const [returnReason, setReturnReason] = useState("");
  const [showReturn, setShowReturn] = useState(false);
  const [busy, setBusy] = useState<LifecycleAction | null>(null);

  const settings = settingsQuery.data;
  const actions = lifecycleActionsForMedia(media, {
    isAdministrator,
    isSupervisor,
    canEdit: Boolean(media.can_edit),
    userId,
    settings,
  });
  const readiness = publishReadiness(media, settings, { isAdministrator });

  async function run(action: LifecycleAction) {
    if (action === "reject") {
      setShowReturn(true);
      return;
    }
    setBusy(action);
    try {
      const updated = await approval.mutateAsync({
        id: media.id,
        action,
        notify_audience: action === "publish" || action === "approve_publish",
      });
      onUpdated(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Lifecycle action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmReturn() {
    if (returnReason.trim().length < 10) {
      onError("Return reason must be at least 10 characters.");
      return;
    }
    setBusy("reject");
    try {
      const updated = await approval.mutateAsync({
        id: media.id,
        action: "reject",
        comment: returnReason.trim(),
      });
      setShowReturn(false);
      setReturnReason("");
      onUpdated(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Return failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!canUsePanel) return null;

  return (
    <div className={`media-lifecycle-panel${compact ? " is-compact" : ""}`}>
      <div className="media-lifecycle-head">
        <span className={`status-badge ${media.status || "draft"}`}>{statusDisplay(media)}</span>
        {settings?.require_upload_approval ? (
          <span className="media-lifecycle-hint">Upload approval required</span>
        ) : null}
      </div>
      {isAdministrator && (media.status === "draft" || media.status === "approved") && (
        <ul className="publish-readiness-list">
          {readiness.items.map((item) => (
            <li key={item.key} className={item.ok ? "ok" : "missing"}>
              {item.ok ? "✓" : "○"} {item.label}
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <div className="media-lifecycle-actions">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className={
                action === "publish" || action === "approve_publish"
                  ? "primary-button small"
                  : action === "reject"
                    ? "danger-button small"
                    : "secondary-button small"
              }
              disabled={Boolean(busy)}
              onClick={() => void run(action)}
            >
              {busy === action ? <LoaderCircle className="spin" size={14} /> : null}
              {lifecycleActionLabel(action)}
            </button>
          ))}
        </div>
      )}
      {showReturn && (
        <div className="media-lifecycle-return">
          <label>
            Return reason (min. 10 characters)
            <textarea
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              rows={3}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button small" onClick={() => setShowReturn(false)}>
              Cancel
            </button>
            <button type="button" className="danger-button small" disabled={busy === "reject"} onClick={() => void confirmReturn()}>
              Return video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
