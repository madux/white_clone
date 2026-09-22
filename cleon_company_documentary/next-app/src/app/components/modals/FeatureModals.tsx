"use client";

import { Check, Copy, Link2, LoaderCircle, Mail, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { DocumentaryFolder, DocumentaryMedia, DocumentarySettings } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import {
  useDocumentaryFolderAction,
  useDocumentaryMediaAction,
  useDocumentaryMediaBatchAction,
  useDocumentarySettings,
  useMediaApproval,
  useSaveDocumentarySettings,
} from "../../../../hooks/useDocumentary";
import { formatDuration } from "../documentaryUtils";
import { ModalShell } from "./ModalShell";
import RolesPage from "../RolesPage";

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

export function SettingsPanelModal({
  onClose,
  onNotice,
  isSystemAdmin = false,
}: {
  onClose: () => void;
  onNotice: (type: "error" | "success", text: string) => void;
  isSystemAdmin?: boolean;
}) {
  const query = useDocumentarySettings(true);
  const save = useSaveDocumentarySettings();
  const [activeTab, setActiveTab] = useState<"configuration" | "roles">("configuration");
  const [form, setForm] = useState<DocumentarySettings | null>(null);
  const [storageStatus, setStorageStatus] = useState<{
    configured?: boolean;
    reachable?: boolean;
    bucket?: string;
    endpoint_url?: string;
  } | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  useEffect(() => {
    api
      .storageConfig(true)
      .then(setStorageStatus)
      .catch(() => setStorageStatus(null))
      .finally(() => setStorageLoading(false));
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      await save.mutateAsync(form);
      onNotice("success", "Settings saved successfully.");
      onClose();
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Settings could not be saved.");
    }
  }

  if (!form && activeTab === "configuration") {
    return (
      <ModalShell eyebrow="Configuration" title="Settings" onClose={onClose}>
        <div className="loading-state compact">
          <LoaderCircle className="spin" size={22} />
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell eyebrow="Configuration" title="Settings & configuration" onClose={onClose}>
      {isSystemAdmin && (
        <div className="settings-modal-tabs">
          <button
            type="button"
            className={activeTab === "configuration" ? "active" : ""}
            onClick={() => setActiveTab("configuration")}
          >
            Configuration
          </button>
          <button
            type="button"
            className={activeTab === "roles" ? "active" : ""}
            onClick={() => setActiveTab("roles")}
          >
            Module roles
          </button>
        </div>
      )}
      {activeTab === "roles" && isSystemAdmin ? (
        <RolesPage embedded />
      ) : form ? (
      <form className="modal-form" onSubmit={(e) => void handleSave(e)}>
        <div className="switch-list">
          <label className="switch-row">
            <span>
              <strong>Require upload approval</strong>
              <small>Admin must approve all new documentary uploads.</small>
            </span>
            <input
              type="checkbox"
              checked={form.require_upload_approval}
              onChange={(e) =>
                setForm({ ...form, require_upload_approval: e.target.checked })
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Default mandatory training</strong>
            </span>
            <input
              type="checkbox"
              checked={form.default_mandatory}
              onChange={(e) => setForm({ ...form, default_mandatory: e.target.checked })}
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Default comments enabled</strong>
            </span>
            <input
              type="checkbox"
              checked={form.default_comments_enabled}
              onChange={(e) =>
                setForm({ ...form, default_comments_enabled: e.target.checked })
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Default allow downloads</strong>
            </span>
            <input
              type="checkbox"
              checked={form.default_allow_download}
              onChange={(e) =>
                setForm({ ...form, default_allow_download: e.target.checked })
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Auto transcription</strong>
              <small>Reserved for future pipeline integration.</small>
            </span>
            <input
              type="checkbox"
              checked={form.auto_transcription}
              onChange={(e) =>
                setForm({ ...form, auto_transcription: e.target.checked })
              }
            />
          </label>
        </div>
        <label>
          Default completion threshold (%)
          <input
            type="number"
            min={1}
            max={100}
            value={form.default_completion_threshold}
            onChange={(e) =>
              setForm({
                ...form,
                default_completion_threshold: Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Recycle bin retention (days)
          <input
            type="number"
            min={7}
            max={3650}
            value={form.deleted_retention_days}
            onChange={(e) =>
              setForm({ ...form, deleted_retention_days: Number(e.target.value) })
            }
          />
        </label>
        <div className="storage-status-panel">
          <p className="form-hint">
            <Settings2 size={14} /> Object storage is provided by CleonHR and
            managed on the platform. Credentials are never exposed in the app.
          </p>
          {storageLoading ? (
            <div className="loading-state compact">
              <LoaderCircle className="spin" size={18} />
            </div>
          ) : storageStatus ? (
            <div
              className={
                storageStatus.reachable
                  ? "connection-status connected"
                  : "connection-status"
              }
            >
              {storageStatus.reachable ? <Check size={15} /> : <Settings2 size={15} />}
              {storageStatus.reachable
                ? `Cloudflare R2 connected (${storageStatus.bucket || "bucket configured"}).`
                : storageStatus.configured
                  ? "R2 is configured but could not be reached. Check server logs and boto3."
                  : "Cloudflare R2 is not configured on this server."}
            </div>
          ) : (
            <div className="connection-status">
              <Settings2 size={15} /> Storage status could not be loaded.
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={save.isPending}>
            Save settings
          </button>
        </div>
      </form>
      ) : null}
    </ModalShell>
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
  const pending = media.filter((item) => item.approval_status === "pending");
  const scheduled = media.filter((item) => item.approval_status === "scheduled");
  const allPendingSelected = selectedIds.length === pending.length && pending.length > 0;

  async function act(id: number, action: "approve" | "reject", comment?: string) {
    try {
      await approval.mutateAsync({ id, action, comment });
      onNotice("success", action === "approve" ? "Video approved." : "Video rejected.");
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
              onClick={() => Promise.all(selectedIds.map((id) => approval.mutateAsync({ id, action: "reject" })))
                .then(() => { setSelectedIds([]); onNotice("success", "Selected videos rejected."); onRefresh(); })
                .catch((error) => onNotice("error", error instanceof Error ? error.message : "Rejection failed."))}
            >
              Reject selected
            </button>
          </div>
          {selectedIds.length > 0 && (
            <button type="button" className="batch-clear" onClick={() => setSelectedIds([])}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
      )}
      {(pending.length > 0 || scheduled.length > 0) && (
        <div className="section-heading">
          <div>
            <p>{pending.length} awaiting approval · {scheduled.length} scheduled</p>
          </div>
        </div>
      )}
      {!pending.length && !scheduled.length && (
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
              <button onClick={() => onOpenMedia(item)}>Preview</button>
              <button className="primary-button small" onClick={() => void act(item.id, "approve")}>
                Approve
              </button>
              <button className="danger-button small" onClick={() => void act(item.id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))}
        {scheduled.map((item) => (
          <div className="approval-row scheduled" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>
                Publishes{" "}
                {item.publish_at
                  ? new Date(item.publish_at).toLocaleString()
                  : "on schedule"}
              </span>
            </div>
            <button
              onClick={() =>
                void approval.mutateAsync({ id: item.id, action: "cancel_schedule" }).then(onRefresh)
              }
            >
              <X size={14} /> Cancel schedule
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
