"use client";

import { Check, Copy, Link2, LoaderCircle, Mail, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentaryFolder, DocumentaryMedia } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import {
  useDocumentaryFolderAction,
  useDocumentaryMediaAction,
  useDocumentaryMediaBatchAction,
  useMediaApproval,
} from "../../../../hooks/useDocumentary";
import { formatDuration } from "../documentaryUtils";
import { ModalShell } from "./ModalShell";

export function RecycleBinView({
  media,
  folders,
  loading,
  onNotice,
  onRefresh,
}: {
  media: DocumentaryMedia[];
  folders: DocumentaryFolder[];
  loading: boolean;
  onNotice: (type: "error" | "success", text: string) => void;
  onRefresh: () => void;
}) {
  const mediaAction = useDocumentaryMediaAction();
  const mediaBatchAction = useDocumentaryMediaBatchAction();
  const folderAction = useDocumentaryFolderAction();
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const allMediaSelected = selectedMediaIds.length === media.length && media.length > 0;
  const allFoldersSelected = selectedFolderIds.length === folders.length && folders.length > 0;

  async function restoreMedia(item: DocumentaryMedia) {
    try {
      await mediaAction.mutateAsync({ id: item.id, action: "restore" });
      onNotice("success", `"${item.title}" restored.`);
      onRefresh();
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Restore failed.");
    }
  }

  async function purgeMedia(item: DocumentaryMedia) {
    if (!window.confirm(`Permanently delete "${item.title}"?`)) return;
    try {
      await api.mediaAction({ id: item.id, action: "purge" });
      onNotice("success", `"${item.title}" permanently deleted.`);
      onRefresh();
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function restoreFolder(folder: DocumentaryFolder) {
    try {
      await folderAction.mutateAsync({ id: folder.id, action: "restore" });
      onNotice("success", `"${folder.name}" restored.`);
      onRefresh();
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Restore failed.");
    }
  }

  async function clearBin() {
    if (!window.confirm("Permanently delete all videos in the recycle bin?")) return;
    try {
      const result = await api.clearRecycleBin();
      onNotice("success", `${result.purged_count} video(s) permanently deleted.`);
      onRefresh();
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Clear failed.");
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" size={24} />
        <span>Loading recycle bin…</span>
      </div>
    );
  }

  return (
    <section className="section-block">
      {(media.length > 0 || folders.length > 0) && (
        <div className="batch-toolbar">
          <label className="bulk-select-all">
            <input
              type="checkbox"
              checked={allMediaSelected && allFoldersSelected && (media.length + folders.length) > 0}
              onChange={() => {
                const selectAll = !(allMediaSelected && allFoldersSelected);
                setSelectedMediaIds(selectAll ? media.map((item) => item.id) : []);
                setSelectedFolderIds(selectAll ? folders.map((item) => item.id) : []);
              }}
            />
            <span>
              {selectedMediaIds.length + selectedFolderIds.length
                ? `${selectedMediaIds.length + selectedFolderIds.length} selected`
                : `Select all (${media.length + folders.length})`}
            </span>
          </label>
          <div className="batch-toolbar-actions">
            <button
              type="button"
              disabled={!selectedMediaIds.length}
              onClick={() => mediaBatchAction.mutateAsync({ ids: selectedMediaIds, action: "restore" })
                .then(() => { setSelectedMediaIds([]); onNotice("success", "Selected videos restored."); onRefresh(); })
                .catch((error) => onNotice("error", error instanceof Error ? error.message : "Restore failed."))}
            >
              <RotateCcw size={14} /> Restore videos
            </button>
            <button
              type="button"
              disabled={!selectedMediaIds.length}
              className="danger"
              onClick={() => {
                if (!window.confirm(`Permanently delete ${selectedMediaIds.length} video(s)?`)) return;
                mediaBatchAction.mutateAsync({ ids: selectedMediaIds, action: "purge" })
                  .then(() => { setSelectedMediaIds([]); onNotice("success", "Selected videos permanently deleted."); onRefresh(); })
                  .catch((error) => onNotice("error", error instanceof Error ? error.message : "Delete failed."));
              }}
            >
              <Trash2 size={14} /> Delete videos forever
            </button>
            <button
              type="button"
              disabled={!selectedFolderIds.length}
              onClick={() => Promise.all(selectedFolderIds.map((id) => folderAction.mutateAsync({ id, action: "restore" })))
                .then(() => { setSelectedFolderIds([]); onNotice("success", "Selected folders restored."); onRefresh(); })
                .catch((error) => onNotice("error", error instanceof Error ? error.message : "Restore failed."))}
            >
              <RotateCcw size={14} /> Restore folders
            </button>
          </div>
          {(selectedMediaIds.length + selectedFolderIds.length) > 0 && (
            <button type="button" className="batch-clear" onClick={() => { setSelectedMediaIds([]); setSelectedFolderIds([]); }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
      )}
      {media.length > 0 && (
        <div className="section-heading">
          <div />
          <button className="danger-button small" onClick={() => void clearBin()}>
            <Trash2 size={14} /> Clear recycle bin
          </button>
        </div>
      )}
      {!media.length && !folders.length && (
        <div className="empty-state">
          <strong>Recycle bin is empty</strong>
          <p>Deleted videos and folders will appear here.</p>
        </div>
      )}
      {!!folders.length && (
        <div className="recycle-section">
          <h3>Folders</h3>
          <div className="recycle-list">
            {folders.map((folder) => (
              <div className="recycle-row" key={folder.id}>
                <input
                  type="checkbox"
                  checked={selectedFolderIds.includes(folder.id)}
                  onChange={() => setSelectedFolderIds((current) => current.includes(folder.id)
                    ? current.filter((id) => id !== folder.id)
                    : [...current, folder.id])}
                  aria-label={`Select ${folder.name}`}
                />
                <div>
                  <strong>{folder.name}</strong>
                  <span>{folder.media_count} videos</span>
                </div>
                <button onClick={() => void restoreFolder(folder)}>
                  <RotateCcw size={14} /> Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!media.length && (
        <div className="recycle-section">
          <h3>Videos</h3>
          <div className="recycle-list">
            {media.map((item) => (
              <div className="recycle-row" key={item.id}>
                <input
                  type="checkbox"
                  checked={selectedMediaIds.includes(item.id)}
                  onChange={() => setSelectedMediaIds((current) => current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id])}
                  aria-label={`Select ${item.title}`}
                />
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.folder_name} · {formatDuration(item.duration_seconds)}
                    {item.purge_date &&
                      ` · Purges ${new Date(item.purge_date).toLocaleDateString()}`}
                  </span>
                </div>
                <div className="recycle-actions">
                  <button onClick={() => void restoreMedia(item)}>
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button className="danger" onClick={() => void purgeMedia(item)}>
                    <Trash2 size={14} /> Delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ShareModal({
  media,
  onClose,
  onError,
}: {
  media: DocumentaryMedia;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .mediaShare(media.id)
      .then((result) => setUrl(result.url))
      .catch((error) =>
        onError(error instanceof Error ? error.message : "Share link could not be created."),
      )
      .finally(() => setLoading(false));
  }, [media.id, onError]);

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ModalShell eyebrow="Share" title="Share documentary" onClose={onClose}>
      {loading ? (
        <div className="loading-state compact">
          <LoaderCircle className="spin" size={22} />
        </div>
      ) : (
        <div className="share-panel">
          <p>I wanted to share this documentary with you:</p>
          <strong>{media.title}</strong>
          <div className="share-link-row">
            <Link2 size={16} />
            <input readOnly value={url} />
            <button className="secondary-button" onClick={() => void copyLink()}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="share-actions">
            <a className="secondary-button" href={`mailto:?subject=${encodeURIComponent(media.title)}&body=${encodeURIComponent(url)}`}>
              <Mail size={15} /> Share via email
            </a>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export function ApprovalQueue({
  media,
  loading,
  onOpenMedia,
  onNotice,
  onRefresh,
}: {
  media: DocumentaryMedia[];
  loading: boolean;
  onOpenMedia: (media: DocumentaryMedia) => void;
  onNotice: (type: "error" | "success", text: string) => void;
  onRefresh: () => void;
}) {
  const approval = useMediaApproval();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const pending = media.filter(
    (item) => item.status === "pending_review" || item.approval_status === "pending",
  );
  const allPendingSelected = selectedIds.length === pending.length && pending.length > 0;
  const [returnReason, setReturnReason] = useState("");
  const [returnTargetId, setReturnTargetId] = useState<number | null>(null);

  async function act(
    id: number,
    action: "approve" | "approve_publish" | "reject",
    comment?: string,
  ) {
    try {
      await approval.mutateAsync({ id, action, comment });
      onNotice(
        "success",
        action === "approve_publish"
          ? "Approved and published."
          : action === "approve"
            ? "Approved."
            : "Returned for correction.",
      );
      onRefresh();
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Approval action failed.");
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" size={24} />
        <span>Loading approval queue…</span>
      </div>
    );
  }

  return (
    <section className="section-block">
      {pending.length > 0 && (
        <div className="batch-toolbar">
          <label className="bulk-select-all">
            <input
              type="checkbox"
              checked={allPendingSelected}
              onChange={() => setSelectedIds(allPendingSelected ? [] : pending.map((item) => item.id))}
            />
            <span>{selectedIds.length ? `${selectedIds.length} selected` : `Select all (${pending.length})`}</span>
          </label>
          <div className="batch-toolbar-actions">
            <button
              type="button"
              className="primary-button small"
              disabled={!selectedIds.length}
              onClick={() => Promise.all(selectedIds.map((id) => approval.mutateAsync({ id, action: "approve" })))
                .then(() => { setSelectedIds([]); onNotice("success", "Selected videos approved."); onRefresh(); })
                .catch((error) => onNotice("error", error instanceof Error ? error.message : "Approval failed."))}
            >
              Approve selected
            </button>
            <button
              type="button"
              className="danger-button small"
              disabled={!selectedIds.length}
              onClick={() => onNotice("error", "Return each item individually with a reason of at least 10 characters.")}
            >
              Return selected
            </button>
          </div>
          {selectedIds.length > 0 && (
            <button type="button" className="batch-clear" onClick={() => setSelectedIds([])}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
      )}
      {pending.length > 0 && (
        <div className="section-heading">
          <div>
            <p>{pending.length} awaiting review (oldest first)</p>
          </div>
        </div>
      )}
      {!pending.length && (
        <div className="empty-state">
          <strong>All caught up</strong>
          <p>No pending approvals across the library.</p>
        </div>
      )}
      <div className="approval-list">
        {pending.map((item) => (
          <div className="approval-row" key={item.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => setSelectedIds((current) => current.includes(item.id)
                ? current.filter((id) => id !== item.id)
                : [...current, item.id])}
              aria-label={`Select ${item.title}`}
            />
            <div>
              <strong>{item.title}</strong>
              <span>{item.folder_name}</span>
            </div>
            <div className="approval-actions">
              <button onClick={() => onOpenMedia(item)}>Review</button>
              <button className="primary-button small" onClick={() => void act(item.id, "approve")}>
                Approve
              </button>
              <button className="primary-button small" onClick={() => void act(item.id, "approve_publish")}>
                Approve &amp; publish
              </button>
              <button
                className="danger-button small"
                onClick={() => {
                  setReturnTargetId(item.id);
                  setReturnReason("");
                }}
              >
                Return
              </button>
            </div>
          </div>
        ))}
      </div>
      {returnTargetId && (
        <div className="modal-form" style={{ marginTop: 16 }}>
          <label>
            Return reason (min. 10 characters)
            <textarea
              rows={3}
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
            />
          </label>
          <div className="share-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setReturnTargetId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={returnReason.trim().length < 10}
              onClick={() => {
                void act(returnTargetId, "reject", returnReason).then(() => setReturnTargetId(null));
              }}
            >
              Confirm return
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
