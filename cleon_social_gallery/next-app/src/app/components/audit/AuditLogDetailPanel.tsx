"use client";

import { useCallback, useEffect } from "react";
import { Copy, ExternalLink, X } from "lucide-react";
import type { AuditLogEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/api";

const EVENT_LABELS: Record<string, string> = {
  created: "Created",
  uploaded: "Uploaded",
  modified: "Modified",
  deleted: "Deleted",
  restored: "Restored",
  approved: "Approved",
  rejected: "Rejected",
  reported: "Reported",
  shared: "Shared",
  exported: "Exported",
  withdrawn: "Withdrawn",
};

const METADATA_LABELS: Record<string, string> = {
  sg_audit_retention_days: "Audit retention (days)",
  sg_media_retention_days: "Media retention (days)",
  sg_allow_external_share: "Allow external sharing",
  sg_default_layout: "Default layout",
  album_count: "Albums exported",
};

function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] || eventType.replace(/_/g, " ");
}

function entityLabel(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

function metadataLabel(key: string): string {
  if (METADATA_LABELS[key]) return METADATA_LABELS[key];
  if (key.startsWith("sg_")) {
    return key
      .slice(3)
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return key.replace(/_/g, " ");
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export default function AuditLogDetailPanel({
  log,
  onClose,
  onOpenAlbum,
  onOpenMedia,
  onCopied,
}: {
  log: AuditLogEntry;
  onClose: () => void;
  onOpenAlbum?: (albumId: number) => void;
  onOpenMedia?: (mediaId: number) => void;
  onCopied?: () => void;
}) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleClose]);

  const metadataEntries = Object.entries(log.metadata || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  return (
    <div className="audit-detail-backdrop" role="presentation" onClick={handleClose}>
      <aside
        className="audit-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="audit-detail-header">
          <div>
            <p className="audit-detail-eyebrow">Audit event #{log.id}</p>
            <h2 id="audit-detail-title">{eventLabel(log.event_type)}</h2>
            <p className="audit-detail-subtitle">{formatDateTime(log.create_date)}</p>
          </div>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="audit-detail-body">
          <section className="audit-detail-section">
            <h3>Summary</h3>
            <dl className="audit-detail-dl">
              <div>
                <dt>Action</dt>
                <dd>{eventLabel(log.event_type)}</dd>
              </div>
              <div>
                <dt>Entity</dt>
                <dd>{entityLabel(log.entity_type)}</dd>
              </div>
              <div>
                <dt>Actor</dt>
                <dd>{log.user_name}</dd>
              </div>
            </dl>
          </section>

          {(log.album_id || log.media_id) && (
            <section className="audit-detail-section">
              <h3>Related records</h3>
              <ul className="audit-detail-links">
                {log.media_id ? (
                  <li>
                    <span className="audit-detail-link-label">Media</span>
                    <span className="audit-detail-link-name">
                      {log.media_name || `Media #${log.media_id}`}
                      {!log.media_available && <em className="audit-detail-muted"> (unavailable)</em>}
                    </span>
                    {log.media_available && onOpenMedia ? (
                      <button
                        type="button"
                        className="secondary-button small"
                        onClick={() => onOpenMedia(log.media_id as number)}
                      >
                        <ExternalLink size={14} />
                        Open media
                      </button>
                    ) : null}
                  </li>
                ) : null}
                {log.album_id ? (
                  <li>
                    <span className="audit-detail-link-label">Album</span>
                    <span className="audit-detail-link-name">
                      {log.album_name || `Album #${log.album_id}`}
                      {!log.album_available && <em className="audit-detail-muted"> (unavailable)</em>}
                    </span>
                    {log.album_available && onOpenAlbum ? (
                      <button
                        type="button"
                        className="secondary-button small"
                        onClick={() => onOpenAlbum(log.album_id as number)}
                      >
                        <ExternalLink size={14} />
                        Open album
                      </button>
                    ) : null}
                  </li>
                ) : null}
              </ul>
            </section>
          )}

          {log.details ? (
            <section className="audit-detail-section">
              <div className="audit-detail-section-head">
                <h3>Details</h3>
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={() => {
                    copyText(log.details);
                    onCopied?.();
                  }}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <p className="audit-detail-text">{log.details}</p>
            </section>
          ) : null}

          {metadataEntries.length > 0 ? (
            <section className="audit-detail-section">
              <div className="audit-detail-section-head">
                <h3>Metadata</h3>
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={() => {
                    copyText(JSON.stringify(log.metadata, null, 2));
                    onCopied?.();
                  }}
                >
                  <Copy size={14} />
                  Copy JSON
                </button>
              </div>
              <dl className="audit-detail-dl">
                {metadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{metadataLabel(key)}</dt>
                    <dd>{formatMetadataValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <footer className="audit-detail-footer">
          <button
            type="button"
            className="secondary-button small"
            onClick={() => {
              copyText(String(log.id));
              onCopied?.();
            }}
          >
            <Copy size={14} />
            Copy event ID
          </button>
          <button type="button" className="primary-button small" onClick={handleClose}>
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
