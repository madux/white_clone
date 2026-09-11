"use client";

import { useMemo, useState } from "react";
import {
  Bot, CheckCircle2, Copy, Flag, History, Recycle, ShieldAlert, User,
} from "lucide-react";
import type { AuditLogEntry, DuplicateGroup, FlaggedReport, GalleryMedia, UploadHistoryEntry } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { useGalleryMutations } from "@/hooks/useSocialGallery";
import { BatchToolbar } from "../shared/BatchToolbar";
import { EmptyState } from "../shared/EmptyState";
import { LoadingState } from "../shared/LoadingState";
import { PageToolbar } from "../shared/PageToolbar";
import { initials } from "../galleryUtils";
import { formatStatusLabel } from "@/lib/statusUtils";
import { QueryError } from "../shared/QueryError";
import { useGalleryContributions } from "@/hooks/useSocialGallery";

export function PendingReviewView({
  media, loading, albums, onRefresh, error, onError,
}: {
  media: GalleryMedia[];
  loading: boolean;
  albums: Array<{ id: number; name: string }>;
  onRefresh: () => void;
  error?: string;
  onError?: (message: string) => void;
}) {
  const { mediaApproval, mediaBatchAction } = useGalleryMutations();
  const [selected, setSelected] = useState<number[]>([]);
  const [albumId, setAlbumId] = useState<number | "">("");
  const [comment, setComment] = useState("");

  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const allSelected = selected.length === media.length && media.length > 0;

  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");

  if (loading) return <LoadingState message="Loading pending media…" />;
  if (error) return <QueryError message={error} />;
  if (media.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="All caught up"
        description="No media is waiting for review."
      />
    );
  }

  return (
    <div>
      <PageToolbar
        left={(
          <>
            <div className="field">
              <select value={albumId} onChange={(e) => setAlbumId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select destination album</option>
                {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Rejection reason / note" />
            </div>
          </>
        )}
        right={(
          <>
            <button
              type="button"
              className="secondary-button small"
              disabled={!selected.length || !selected.every((id) => {
                const item = media.find((m) => m.id === id);
                return albumId || item?.album_id;
              })}
              onClick={() => mediaBatchAction.mutateAsync({
                ids: selected,
                action: "approve",
                album_id: albumId || undefined,
                comment,
              }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
            >
              Approve Selected
            </button>
            <button
              type="button"
              className="danger-button small"
              disabled={!selected.length}
              onClick={() => mediaBatchAction.mutateAsync({ ids: selected, action: "reject", comment }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
            >
              Reject Selected
            </button>
          </>
        )}
      />

      <BatchToolbar count={selected.length} onClear={() => setSelected([])}>
        <button type="button" className="secondary-button small" onClick={() => setSelected(allSelected ? [] : media.map((m) => m.id))}>
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </BatchToolbar>

      <div className="stack-list">
        {media.map((item) => (
          <div key={item.id} className="approval-row">
            <input className="sg-check" type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
            <MediaThumb media={item} className="approval-thumb" showOverlay={false} />
            <div className="profile-copy">
              <strong>{item.display_name}</strong>
              <span>{item.uploaded_by_name} · {formatBytes(item.file_size)} · {formatDate(item.create_date)}</span>
            </div>
            <div className="media-list-actions">
              <button
                type="button"
                className="secondary-button small"
                disabled={!albumId && !item.album_id}
                onClick={() => mediaApproval.mutateAsync({
                  id: item.id,
                  action: "approve",
                  album_id: albumId || item.album_id,
                  comment,
                }).then(onRefresh).catch(handleError)}
              >
                Approve
              </button>
              <button
                type="button"
                className="danger-button small"
                onClick={() => mediaApproval.mutateAsync({ id: item.id, action: "reject", comment }).then(onRefresh).catch(handleError)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PendingAIReviewView({
  media, loading, onRefresh, onOpenMedia, onError,
}: {
  media: GalleryMedia[];
  loading: boolean;
  onRefresh: () => void;
  onOpenMedia?: (media: GalleryMedia) => void;
  onError?: (message: string) => void;
}) {
  const { mediaApproval } = useGalleryMutations();
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  if (loading) return <LoadingState message="Loading AI review queue…" />;
  if (media.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Queue clear"
        description="All uploads have passed automated screening."
      />
    );
  }

  return (
    <div className="stack-list">
      {media.map((item) => (
        <div key={item.id} className="review-row">
          <button type="button" className="text-button" onClick={() => onOpenMedia?.(item)}>
            <MediaThumb media={item} className="approval-thumb" showOverlay={false} />
          </button>
          <div className="profile-copy">
            <strong>{item.display_name}</strong>
            <span className="meta-muted">{item.ai_moderation_note}</span>
            <div className="review-flags">
              {(item.ai_moderation_flags || []).map((flag) => (
                <span key={flag} className="status-badge flagged">{formatStatusLabel(flag)}</span>
              ))}
            </div>
          </div>
          <div className="media-list-actions">
            <button type="button" className="secondary-button small" onClick={() => mediaApproval.mutateAsync({ id: item.id, action: "approve" }).then(onRefresh).catch(handleError)}>Approve</button>
            <button type="button" className="danger-button small" onClick={() => mediaApproval.mutateAsync({ id: item.id, action: "reject", comment: "AI screening rejection" }).then(onRefresh).catch(handleError)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlaggedContentView({
  reports, loading, onRefresh, onOpenMedia, onError,
}: {
  reports: FlaggedReport[];
  loading: boolean;
  onRefresh: () => void;
  onOpenMedia?: (media: GalleryMedia) => void;
  onError?: (message: string) => void;
}) {
  const { resolveFlag } = useGalleryMutations();
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  if (loading) return <LoadingState message="Loading flagged content…" />;
  if (reports.length === 0) {
    return <EmptyState icon={Flag} title="No flagged content" description="User reports will appear here for review." />;
  }

  return (
    <div className="stack-list">
      {reports.map((report) => (
        <div key={report.id} className="review-row">
          <button type="button" className="text-button" onClick={() => onOpenMedia?.(report.media)}>
            <MediaThumb media={report.media} className="approval-thumb" showOverlay={false} />
          </button>
          <div className="profile-copy">
            <strong>{report.media.display_name}</strong>
            <span>Reason: {report.reason}</span>
            {report.details && <span className="meta-muted">{report.details}</span>}
            <span className="meta-muted">Reported by {report.reporter_name}</span>
          </div>
          <div className="avatar">{initials(report.reporter_name)}</div>
          <div className="media-list-actions">
            <button type="button" className="secondary-button small" onClick={() => resolveFlag.mutateAsync({ report_id: report.id, action: "dismiss" }).then(onRefresh).catch(handleError)}>Dismiss</button>
            <button type="button" className="danger-button small" onClick={() => resolveFlag.mutateAsync({ report_id: report.id, action: "remove" }).then(onRefresh).catch(handleError)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecycleBinView({
  media, loading, onRefresh, isAdmin, onError,
}: {
  media: GalleryMedia[];
  loading: boolean;
  onRefresh: () => void;
  isAdmin: boolean;
  onError?: (message: string) => void;
}) {
  const { mediaAction, recycleClear } = useGalleryMutations();
  const [selected, setSelected] = useState<number[]>([]);
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");

  if (loading) return <LoadingState message="Loading recycle bin…" />;
  if (media.length === 0) {
    return <EmptyState icon={Recycle} title="Recycle bin is empty" description="Deleted media will appear here before permanent purge." />;
  }

  return (
    <div>
      <BatchToolbar count={selected.length} onClear={() => setSelected([])}>
        <button type="button" className="secondary-button small" onClick={() => setSelected(media.map((m) => m.id))}>Select all</button>
        <button
          type="button"
          className="secondary-button small"
          disabled={!selected.length}
          onClick={() => Promise.all(selected.map((id) => mediaAction.mutateAsync({ id, action: "restore" }))).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
        >
          Restore Selected
        </button>
        {isAdmin && (
          <button
            type="button"
            className="danger-button small"
            disabled={!selected.length}
            onClick={() => recycleClear.mutateAsync(selected).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
          >
            Permanently Delete
          </button>
        )}
      </BatchToolbar>

      <div className="stack-list">
        {media.map((item) => (
          <div key={item.id} className="recycle-row">
            <input
              className="sg-check"
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => setSelected((prev) => prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id])}
            />
            <MediaThumb media={item} className="approval-thumb" showOverlay={false} />
            <div className="profile-copy">
              <strong>{item.display_name}</strong>
              <span>Deleted {formatDate(String(item.deleted_at || ""))}</span>
            </div>
            <span className="status-badge pending">Purge {formatDate(String(item.purge_date || ""))}</span>
            <div className="media-list-actions">
              <button type="button" className="secondary-button small" onClick={() => mediaAction.mutateAsync({ id: item.id, action: "restore" }).then(onRefresh).catch(handleError)}>Restore</button>
              {isAdmin && (
                <button type="button" className="danger-button small" onClick={() => recycleClear.mutateAsync([item.id]).then(onRefresh).catch(handleError)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContributionsView({
  onOpenMedia,
}: {
  media?: GalleryMedia[];
  loading?: boolean;
  onOpenMedia?: (media: GalleryMedia) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const contributionsQuery = useGalleryContributions(statusFilter, true);
  const media = contributionsQuery.data || [];
  const loading = contributionsQuery.isLoading;

  if (loading) return <LoadingState message="Loading your contributions…" />;
  if (media.length === 0) {
    return <EmptyState icon={User} title="No contributions yet" description="Upload media to track its approval status here." />;
  }

  const filtered = media;

  return (
    <div>
      <PageToolbar
        left={(
          <div className="view-toggle">
            {["all", "pending", "approved", "rejected"].map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        )}
      />
      <div className="analytics-table-wrap">
        <table>
          <thead><tr><th>Preview</th><th>File</th><th>Status</th><th>Album</th><th>Uploaded</th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="clickable-row" onClick={() => onOpenMedia?.(item)} role="button" tabIndex={0}>
                <td><MediaThumb media={item} className="list-thumb" showOverlay={false} /></td>
                <td>{item.display_name}</td>
                <td><StatusBadge status={item.approval_status} /></td>
                <td>{item.album_name || "—"}</td>
                <td>{formatDate(item.create_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UploadHistoryView({
  history, loading, onOpenMedia,
}: {
  history: UploadHistoryEntry[];
  loading: boolean;
  onOpenMedia?: (media: GalleryMedia) => void;
}) {
  if (loading) return <LoadingState message="Loading upload history…" />;
  if (history.length === 0) {
    return <EmptyState icon={History} title="No upload history" description="Successful and failed uploads will be logged here." />;
  }

  return (
    <div className="analytics-table-wrap">
      <table>
        <thead><tr><th>File</th><th>Status</th><th>Size</th><th>Date</th><th>Error</th></tr></thead>
        <tbody>
          {history.map((row) => (
            <tr
              key={row.id}
              className={row.media_id ? "clickable-row" : ""}
              onClick={() => {
                if (row.media_id && onOpenMedia) {
                  onOpenMedia({
                    id: row.media_id,
                    display_name: row.file_name,
                    file_name: row.file_name,
                    file_size: row.file_size,
                    mime_type: row.mime_type,
                    media_type: row.mime_type?.startsWith("video/") ? "video" : "image",
                  } as GalleryMedia);
                }
              }}
              role={row.media_id ? "button" : undefined}
              tabIndex={row.media_id ? 0 : undefined}
            >
              <td>{row.file_name}</td>
              <td><StatusBadge status={row.status === "success" ? "success" : "failed"} /></td>
              <td>{formatBytes(row.file_size || 0)}</td>
              <td>{formatDate(row.create_date)}</td>
              <td>{row.error_message || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogView({ logs, loading }: { logs: AuditLogEntry[]; loading: boolean }) {
  const [eventFilter, setEventFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const events = useMemo(() => [...new Set(logs.map((log) => log.event_type))], [logs]);
  const entities = useMemo(() => [...new Set(logs.map((log) => log.entity_type))], [logs]);
  const filtered = logs.filter((log) => {
    if (eventFilter && log.event_type !== eventFilter) return false;
    if (entityFilter && log.entity_type !== entityFilter) return false;
    return true;
  });

  if (loading) return <LoadingState message="Loading audit logs…" />;
  if (logs.length === 0) {
    return <EmptyState icon={ShieldAlert} title="No logs found" description="Gallery actions will be recorded here." />;
  }

  return (
    <div>
      <PageToolbar
        left={(
          <>
            <div className="field">
              <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                <option value="">All events</option>
                {events.map((event) => <option key={event} value={event}>{event}</option>)}
              </select>
            </div>
            <div className="field">
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
                <option value="">All entities</option>
                {entities.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
              </select>
            </div>
          </>
        )}
      />
      <div className="analytics-table-wrap">
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.create_date)}</td>
                <td>{log.user_name}</td>
                <td>{log.event_type}</td>
                <td>{log.entity_type}</td>
                <td title={log.details || ""}>{log.details ? `${log.details.slice(0, 80)}${log.details.length > 80 ? "…" : ""}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DuplicateScanView({
  groups, loading, onRefresh, onError,
}: {
  groups: DuplicateGroup[];
  loading: boolean;
  onRefresh: () => void;
  onError?: (message: string) => void;
}) {
  const { duplicateAction } = useGalleryMutations();
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  if (loading) return <LoadingState message="Scanning gallery for duplicates…" />;
  if (groups.length === 0) {
    return <EmptyState icon={Copy} title="No duplicates found" description="Your gallery is clean." />;
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.checksum} className="duplicate-group">
          <div className="section-heading">
            <div>
              <h2>{group.count} duplicates</h2>
              <p>Same checksum detected across files</p>
            </div>
            <button
              type="button"
              className="danger-button"
              onClick={() => duplicateAction.mutateAsync({ ids: group.items.slice(1).map((m) => m.id) }).then(onRefresh).catch(handleError)}
            >
              Move duplicates to recycle bin
            </button>
          </div>
          <div className="duplicate-compare">
            {group.items.map((item, index) => (
              <div key={item.id} className={`duplicate-item ${index === 0 ? "keep" : ""}`}>
                {index === 0 && <span className="status-badge approved">Keep</span>}
                <MediaThumb media={item} showOverlay={false} />
                <strong>{item.display_name}</strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
