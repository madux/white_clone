"use client";

import { Check, Copy, Link2, LoaderCircle, Mail, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { DocumentaryFolder, DocumentaryMedia, DocumentarySettings } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import {
  useDocumentaryFolderAction,
  useDocumentaryMediaAction,
  useDocumentarySettings,
  useMediaApproval,
  useSaveDocumentarySettings,
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
  const folderAction = useDocumentaryFolderAction();

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
}: {
  onClose: () => void;
  onNotice: (type: "error" | "success", text: string) => void;
}) {
  const query = useDocumentarySettings(true);
  const save = useSaveDocumentarySettings();
  const [form, setForm] = useState<DocumentarySettings | null>(null);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

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

  if (!form) {
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
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={save.isPending}>
            Save settings
          </button>
        </div>
      </form>
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
  const pending = media.filter((item) => item.approval_status === "pending");
  const scheduled = media.filter((item) => item.approval_status === "scheduled");

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
