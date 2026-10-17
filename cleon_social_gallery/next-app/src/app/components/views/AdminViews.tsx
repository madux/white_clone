"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, CheckCircle2, Copy, Flag, History, Recycle, Search, ShieldAlert, SlidersHorizontal, Trash2, User,
} from "lucide-react";
import type { AuditLogEntry, DuplicateGroup, FlaggedReport, GalleryAlbum, GalleryMedia, UploadHistoryEntry } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import AuditLogDetailPanel from "../audit/AuditLogDetailPanel";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { useGalleryMutations } from "@/hooks/useSocialGallery";
import AppSelect from "../shared/AppSelect";
import { BatchToolbar } from "../shared/BatchToolbar";
import { EmptyState } from "../shared/EmptyState";
import { LoadingState } from "../shared/LoadingState";
import { LoadMoreFooter } from "../shared/LoadMoreFooter";
import { PageToolbar } from "../shared/PageToolbar";
import { initials } from "../galleryUtils";
import { formatStatusLabel } from "@/lib/statusUtils";
import { QueryError } from "../shared/QueryError";
import { useGalleryAudit, useGalleryContributions } from "@/hooks/useSocialGallery";

export function PendingReviewView({
  media, pendingAlbums = [], loading, albums, onRefresh, error, onError, isAdmin = false,
}: {
  media: GalleryMedia[];
  pendingAlbums?: GalleryAlbum[];
  loading: boolean;
  albums: Array<{ id: number; name: string; status?: string }>;
  onRefresh: () => void;
  error?: string;
  onError?: (message: string) => void;
  isAdmin?: boolean;
}) {
  const { mediaApproval, mediaBatchAction, albumAction } = useGalleryMutations();
  const [tab, setTab] = useState<"media" | "albums">("media");
  const [selected, setSelected] = useState<number[]>([]);
  const [albumId, setAlbumId] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [albumRejectReason, setAlbumRejectReason] = useState("");
  const approvedAlbums = albums.filter((a) => a.status === "approved" || !a.status);

  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const allSelected = selected.length === media.length && media.length > 0;

  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");

  if (loading) return <LoadingState message="Loading pending media…" />;
  if (error) return <QueryError message={error} />;
  if (!loading && media.length === 0 && pendingAlbums.length === 0) {
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
      {isAdmin && (
        <div className="settings-modal-tabs" style={{ marginBottom: 16 }}>
          <button type="button" className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>Media</button>
          <button type="button" className={tab === "albums" ? "active" : ""} onClick={() => setTab("albums")}>Albums</button>
        </div>
      )}
      {tab === "albums" && isAdmin ? (
        <div className="stack-list">
          {pendingAlbums.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No pending albums" description="Supervisor albums awaiting approval will appear here." />
          ) : pendingAlbums.map((album) => (
            <div key={album.id} className="approval-row">
              <div className="profile-copy">
                <strong>{album.name}</strong>
                <span>{album.created_by_name} · {album.visibility}</span>
                {album.description && <span className="meta-muted">{album.description}</span>}
              </div>
              <div className="field">
                <input value={albumRejectReason} onChange={(e) => setAlbumRejectReason(e.target.value)} placeholder="Rejection reason (required to reject)" />
              </div>
              <div className="media-list-actions">
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={() => albumAction.mutateAsync({ id: album.id, action: "approve" }).then(onRefresh).catch(handleError)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="danger-button small"
                  disabled={!albumRejectReason.trim()}
                  onClick={() => albumAction.mutateAsync({ id: album.id, action: "reject", comment: albumRejectReason }).then(onRefresh).catch(handleError)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
      <PageToolbar
        left={(
          <>
            <div className="field">
              <AppSelect
                value={albumId === "" ? "" : String(albumId)}
                placeholder="Select destination album"
                options={[
                  { value: "", label: "Select destination album" },
                  ...approvedAlbums.map((a) => ({ value: String(a.id), label: a.name })),
                ]}
                onChange={(value) => setAlbumId(value ? Number(value) : "")}
                ariaLabel="Destination album for approval"
              />
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
              disabled={!selected.length || !comment.trim()}
              onClick={() => mediaBatchAction.mutateAsync({ ids: selected, action: "reject", comment }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
            >
              Reject Selected
            </button>
          </>
        )}
      />

      <BatchToolbar
        count={selected.length}
        total={media.length}
        onClear={() => setSelected([])}
        onToggleAll={() => setSelected(allSelected ? [] : media.map((m) => m.id))}
      />

      <div className="stack-list">
        {media.map((item) => (
          <div key={item.id} className="approval-row">
            <input className="sg-check" type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
            <MediaThumb media={item} className="approval-thumb" showOverlay={false} />
            <div className="profile-copy">
              <strong>{item.display_name}</strong>
              <span>{item.uploaded_by_name} · {formatBytes(item.file_size)} · {formatDate(item.create_date)}</span>
              {item.is_unassigned && <span className="status-badge pending">No album selected</span>}
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
                disabled={!comment.trim()}
                onClick={() => mediaApproval.mutateAsync({ id: item.id, action: "reject", comment }).then(onRefresh).catch(handleError)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
        </>
      )}
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
  const { mediaBatchAction } = useGalleryMutations();
  const [selected, setSelected] = useState<number[]>([]);
  const allSelected = selected.length === media.length && media.length > 0;
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

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
    <div>
      <BatchToolbar
        count={selected.length}
        total={media.length}
        onClear={() => setSelected([])}
        onToggleAll={() => setSelected(allSelected ? [] : media.map((m) => m.id))}
      >
        <button
          type="button"
          className="secondary-button small"
          disabled={!selected.length}
          onClick={() => mediaBatchAction.mutateAsync({ ids: selected, action: "approve" }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
        >
          Approve Selected
        </button>
        <button
          type="button"
          className="danger-button small"
          disabled={!selected.length}
          onClick={() => mediaBatchAction.mutateAsync({
            ids: selected,
            action: "reject",
            comment: "AI screening rejection",
          }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
        >
          Reject Selected
        </button>
      </BatchToolbar>
      <div className="stack-list">
        {media.map((item) => (
          <div key={item.id} className="review-row">
            <input className="sg-check" type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
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
              <button type="button" className="secondary-button small" onClick={() => mediaBatchAction.mutateAsync({ ids: [item.id], action: "approve" }).then(onRefresh).catch(handleError)}>Approve</button>
              <button type="button" className="danger-button small" onClick={() => mediaBatchAction.mutateAsync({ ids: [item.id], action: "reject", comment: "AI screening rejection" }).then(onRefresh).catch(handleError)}>Reject</button>
            </div>
          </div>
        ))}
      </div>
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
  const { resolveFlag, flaggedBatchAction } = useGalleryMutations();
  const [selected, setSelected] = useState<number[]>([]);
  const allSelected = selected.length === reports.length && reports.length > 0;
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  if (loading) return <LoadingState message="Loading flagged content…" />;
  if (reports.length === 0) {
    return <EmptyState icon={Flag} title="No flagged content" description="User reports will appear here for review." />;
  }

  return (
    <div>
      <BatchToolbar
        count={selected.length}
        total={reports.length}
        onClear={() => setSelected([])}
        onToggleAll={() => setSelected(allSelected ? [] : reports.map((r) => r.id))}
      >
        <button
          type="button"
          className="secondary-button small"
          disabled={!selected.length}
          onClick={() => flaggedBatchAction.mutateAsync({ action: "batch_dismiss", report_ids: selected }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
        >
          Dismiss Selected
        </button>
        <button
          type="button"
          className="danger-button small"
          disabled={!selected.length}
          onClick={() => flaggedBatchAction.mutateAsync({ action: "batch_remove", report_ids: selected }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
        >
          Remove Selected
        </button>
      </BatchToolbar>
      <div className="stack-list">
        {reports.map((report) => (
          <div key={report.id} className="review-row">
            <input className="sg-check" type="checkbox" checked={selected.includes(report.id)} onChange={() => toggle(report.id)} />
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
    </div>
  );
}

export function RecycleBinView({
  payload, loading, onRefresh, isAdmin, onError,
}: {
  payload?: { albums: Array<{ id: number; name: string; media_count: number; deleted_at: string; deleted_by_name: string; media: GalleryMedia[] }>; media: GalleryMedia[] };
  loading: boolean;
  onRefresh: () => void;
  isAdmin: boolean;
  onError?: (message: string) => void;
}) {
  const { mediaBatchAction, recycleClear, albumAction } = useGalleryMutations();
  const media = payload?.media || [];
  const albumGroups = payload?.albums || [];
  const [selected, setSelected] = useState<number[]>([]);
  const allSelected = selected.length === media.length && media.length > 0;
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");

  if (loading) return <LoadingState message="Loading recycle bin…" />;
  if (media.length === 0 && albumGroups.length === 0) {
    return <EmptyState icon={Recycle} title="Recycle bin is empty" description="Deleted media will appear here before permanent purge." />;
  }

  return (
    <div>
      <BatchToolbar
        count={selected.length}
        total={media.length}
        onClear={() => setSelected([])}
        onToggleAll={() => setSelected(allSelected ? [] : media.map((m) => m.id))}
      >
        <button
          type="button"
          className="secondary-button small"
          disabled={!selected.length}
          onClick={() => mediaBatchAction.mutateAsync({ ids: selected, action: "restore" }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
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

      {albumGroups.map((group) => (
        <div key={group.id} className="duplicate-group" style={{ marginBottom: 16 }}>
          <div className="profile-copy">
            <strong>{group.name}</strong>
            <span>{group.media_count} items · Deleted {formatDate(group.deleted_at)} by {group.deleted_by_name}</span>
          </div>
          <button
            type="button"
            className="secondary-button small"
            onClick={() => albumAction.mutateAsync({ id: group.id, action: "restore" }).then(onRefresh).catch(handleError)}
          >
            Restore album and items
          </button>
        </div>
      ))}

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
              <button type="button" className="secondary-button small" onClick={() => mediaBatchAction.mutateAsync({ ids: [item.id], action: "restore" }).then(onRefresh).catch(handleError)}>Restore</button>
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
  onRefresh,
  onError,
}: {
  media?: GalleryMedia[];
  loading?: boolean;
  onOpenMedia?: (media: GalleryMedia) => void;
  onRefresh?: () => void;
  onError?: (message: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const contributionsQuery = useGalleryContributions(statusFilter, true);
  const { mediaAction } = useGalleryMutations();
  const media = contributionsQuery.data || [];
  const loading = contributionsQuery.isLoading;
  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  const refresh = () => {
    contributionsQuery.refetch();
    onRefresh?.();
  };

  if (loading) return <LoadingState message="Loading your contributions…" />;
  if (media.length === 0) {
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
        <EmptyState icon={User} title="No contributions yet" description="Upload media to track its approval status here." />
      </div>
    );
  }

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
          <thead>
            <tr>
              <th>Preview</th>
              <th>File</th>
              <th>Status</th>
              <th>Album</th>
              <th>Review note</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {media.map((item) => (
              <tr
                key={item.id}
                className="clickable-row"
                onClick={() => onOpenMedia?.(item)}
                role="button"
                tabIndex={0}
              >
                <td><MediaThumb media={item} className="list-thumb" showOverlay={false} /></td>
                <td>{item.display_name}</td>
                <td><StatusBadge status={item.approval_status} /></td>
                <td>{item.album_name || "No album selected"}</td>
                <td>{item.approver_comment || "—"}</td>
                <td>{formatDate(item.create_date)}</td>
                <td onClick={(event) => event.stopPropagation()}>
                  {item.can_withdraw && (
                    <button
                      type="button"
                      className="secondary-button small"
                      onClick={() => mediaAction.mutateAsync({ id: item.id, action: "withdraw" }).then(refresh).catch(handleError)}
                    >
                      Withdraw
                    </button>
                  )}
                </td>
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

const AUDIT_EVENT_OPTIONS = [
  "created", "uploaded", "modified", "deleted", "restored",
  "approved", "rejected", "reported", "shared", "exported", "withdrawn",
];

const AUDIT_ENTITY_OPTIONS = ["album", "media", "comment"];

export function AuditLogView({
  enabled = true,
  onOpenAlbum,
  onOpenMedia,
  onCopied,
}: {
  enabled?: boolean;
  onOpenAlbum?: (albumId: number) => void;
  onOpenMedia?: (mediaId: number) => void;
  onCopied?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = (eventFilter ? 1 : 0) + (entityFilter ? 1 : 0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filtersOpen]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, eventFilter, entityFilter]);

  const auditQuery = useGalleryAudit({
    search: debouncedSearch,
    event_type: eventFilter,
    entity_type: entityFilter,
    page,
  }, enabled);

  const { items: logs, total, pageCount, pageSize, isLoading, isFetching } = auditQuery;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  if (isLoading && logs.length === 0) return <LoadingState message="Loading audit logs…" />;

  return (
    <div>
      <PageToolbar
        right={(
          <div className="audit-toolbar-actions">
            <div className="audit-filter-menu" ref={filterMenuRef}>
              <button
                type="button"
                className={`secondary-button small audit-filter-trigger${activeFilterCount ? " is-active" : ""}`}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal size={16} aria-hidden />
                Filters
                {activeFilterCount > 0 && (
                  <span className="audit-filter-badge" aria-hidden>{activeFilterCount}</span>
                )}
              </button>
              {filtersOpen && (
                <div className="audit-filter-dropdown" role="dialog" aria-label="Audit log filters">
                  <div className="field">
                    <span className="audit-filter-label">Event</span>
                    <AppSelect
                      value={eventFilter}
                      placeholder="All events"
                      options={[
                        { value: "", label: "All events" },
                        ...AUDIT_EVENT_OPTIONS.map((event) => ({ value: event, label: event })),
                      ]}
                      onChange={setEventFilter}
                      ariaLabel="Filter audit events"
                    />
                  </div>
                  <div className="field">
                    <span className="audit-filter-label">Entity</span>
                    <AppSelect
                      value={entityFilter}
                      placeholder="All entities"
                      options={[
                        { value: "", label: "All entities" },
                        ...AUDIT_ENTITY_OPTIONS.map((entity) => ({ value: entity, label: entity })),
                      ]}
                      onChange={setEntityFilter}
                      ariaLabel="Filter audit entities"
                    />
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="secondary-button small audit-filter-clear"
                      onClick={() => {
                        setEventFilter("");
                        setEntityFilter("");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
            <label className="audit-search-field">
              <Search size={18} className="audit-search-icon" aria-hidden />
              <input
                type="search"
                className="audit-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search audit log…"
                aria-label="Search audit log"
              />
            </label>
          </div>
        )}
      />
      {logs.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No logs found"
          description={debouncedSearch || eventFilter || entityFilter
            ? "Try a different search or clear your filters."
            : "Gallery actions will be recorded here."}
        />
      ) : (
      <div className="analytics-table-wrap">
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="audit-log-row"
                tabIndex={0}
                onClick={() => setSelectedLog(log)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedLog(log);
                  }
                }}
              >
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
      )}
      <div className="audit-pagination">
        <span className="meta-muted">
          {total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          {isFetching && !isLoading ? " · Updating…" : ""}
        </span>
        <div className="audit-pagination-controls">
          <button
            type="button"
            className="secondary-button small"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span className="audit-pagination-label">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className="secondary-button small"
            disabled={page >= pageCount || isFetching}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Next
          </button>
        </div>
      </div>
      {selectedLog && (
        <AuditLogDetailPanel
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onOpenAlbum={(albumId) => {
            setSelectedLog(null);
            onOpenAlbum?.(albumId);
          }}
          onOpenMedia={(mediaId) => {
            setSelectedLog(null);
            onOpenMedia?.(mediaId);
          }}
          onCopied={onCopied}
        />
      )}
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
