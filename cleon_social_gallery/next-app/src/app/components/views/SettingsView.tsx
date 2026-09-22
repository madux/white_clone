"use client";

import { useEffect, useState } from "react";
import {
  Bell, Cloud, Download, LoaderCircle, Settings2, SlidersHorizontal,
} from "lucide-react";
import type { GallerySettings } from "@/lib/types";
import { useGalleryMutations, useGalleryTrustedUsers } from "@/hooks/useSocialGallery";
import { api } from "@/lib/api";
import { LoadingState } from "../shared/LoadingState";
import { UserSearchPicker } from "../shared/UserSearchPicker";
import RolesView from "./RolesView";

export default function SettingsView({
  settings, loading, albums = [], onRefresh, onError, isSystemAdmin = false,
}: {
  settings?: GallerySettings;
  loading: boolean;
  albums?: Array<{ id: number; name: string }>;
  onRefresh: () => void;
  onError?: (message: string) => void;
  isSystemAdmin?: boolean;
}) {
  const { saveSettings, exportBrand, trustedUsers } = useGalleryMutations();
  const trustedQuery = useGalleryTrustedUsers(!!settings);
  const [form, setForm] = useState<Partial<GallerySettings>>({});
  const [storage, setStorage] = useState<{
    configured?: boolean;
    reachable?: boolean;
    bucket?: string;
    provider?: string;
  }>({});
  const [selectedAlbums, setSelectedAlbums] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingTrusted, setAddingTrusted] = useState(false);
  const [activeTab, setActiveTab] = useState<"configuration" | "roles">("configuration");

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    api.storageConfig(true).then(setStorage).catch(() => {});
  }, []);

  if ((loading || !settings) && activeTab === "configuration") {
    return <LoadingState message="Loading settings…" />;
  }

  const update = (key: keyof GallerySettings, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings.mutateAsync(form);
      onRefresh();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const exportTimeline = async () => {
    setExporting(true);
    try {
      const data = await exportBrand.mutateAsync(selectedAlbums);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "culture-timeline-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="settings-page-shell">
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
        <RolesView embedded />
      ) : (
    <div className="analytics-two-column">
      <div className="settings-section">
        <div className="settings-section-header">
          <SlidersHorizontal size={18} />
          <div>
            <div className="eyebrow">General</div>
            <h2>Gallery defaults</h2>
          </div>
        </div>
        <div className="modal-form">
          <label className="field">
            <span className="label">Default Visibility</span>
            <select value={form.default_visibility || "public"} onChange={(e) => update("default_visibility", e.target.value)}>
              <option value="public">Public — all employees can view</option>
              <option value="private">Private — admin approval required</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Maximum Upload Size (MB)</span>
            <select value={form.max_upload_mb || 25} onChange={(e) => update("max_upload_mb", Number(e.target.value))}>
              {[5, 10, 25, 50, 100].map((v) => <option key={v} value={v}>{v} MB per file</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Default Layout</span>
            <select value={form.default_layout || "grid"} onChange={(e) => update("default_layout", e.target.value)}>
              <option value="grid">Grid View</option>
              <option value="list">List View</option>
              <option value="masonry">Masonry Layout</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Default Destination Album</span>
            <select
              value={form.default_destination_album_id || ""}
              onChange={(e) => update("default_destination_album_id", e.target.value ? Number(e.target.value) : false)}
            >
              <option value="">Auto — monthly album</option>
              {albums.map((album) => <option key={album.id} value={album.id}>{album.name}</option>)}
            </select>
          </label>
          <div className="switch-list">
            <label className="toggle-row">
              <span>
                <strong>Allow external sharing</strong>
                <small>Let users create public share links.</small>
              </span>
              <span className="toggle">
                <input type="checkbox" checked={!!form.allow_external_share} onChange={(e) => update("allow_external_share", e.target.checked)} />
              </span>
            </label>
          </div>
          <div className="switch-list">
            {([
              ["auto_create_monthly_album", "Auto-create monthly album", "A new album is created at the start of each month."],
              ["auto_approve_trusted", "Auto-approve trusted users", "Trusted uploaders skip the review queue."],
              ["ai_moderation_enabled", "AI review on uploads", "When on, uploads are screened automatically. When off, every upload goes to Pending Requests for manual review."],
            ] as const).map(([key, label, helper]) => (
              <label key={key} className="toggle-row">
                <span>
                  <strong>{label}</strong>
                  <small>{helper}</small>
                </span>
                <span className="toggle">
                  <input type="checkbox" checked={!!form[key]} onChange={(e) => update(key, e.target.checked)} />
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-button" disabled={saving} onClick={save}>
            {saving ? <LoaderCircle size={16} className="spin" /> : null}
            Save Changes
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <Bell size={18} />
          <div>
            <div className="eyebrow">Notifications</div>
            <h2>Alerts & digests</h2>
          </div>
        </div>
        <div className="switch-list">
          {([
            ["notify_new_upload", "Email notifications for new uploads", "Send mail when someone uploads media."],
            ["notify_approval_request", "Approval request notifications", "Alert managers when review is needed."],
            ["notify_comments", "Comment notifications", "Notify owners when comments are posted."],
            ["notify_likes", "Like notifications", "Batch like alerts using the size below."],
            ["notify_content_reports", "Content report notifications", "Alert managers when media is reported."],
            ["weekly_digest", "Weekly digest", "A weekly summary of gallery activity."],
          ] as const).map(([key, label, helper]) => (
            <label key={key} className="toggle-row">
              <span>
                <strong>{label}</strong>
                <small>{helper}</small>
              </span>
              <span className="toggle">
                <input type="checkbox" checked={!!form[key]} onChange={(e) => update(key, e.target.checked)} />
              </span>
            </label>
          ))}
        </div>
        <label className="field">
          <span className="label">Like notification batch size</span>
          <input type="number" min={1} max={50} value={form.like_batch_size || 5} onChange={(e) => update("like_batch_size", Number(e.target.value))} />
        </label>
        <label className="field">
          <span className="label">Recycle bin retention (days)</span>
          <input type="number" min={1} value={form.deleted_retention_days || 365} onChange={(e) => update("deleted_retention_days", Number(e.target.value))} />
        </label>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <Settings2 size={18} />
          <div>
            <div className="eyebrow">Access</div>
            <h2>Trusted uploaders</h2>
          </div>
        </div>
        <p className="meta-muted">Trusted users can skip the review queue when auto-approve is enabled.</p>
        <div className="export-list switch-list">
          {(trustedQuery.data || []).map((trusted) => (
            <div key={trusted.id} className="toggle-row">
              <span><strong>{trusted.user_name}</strong></span>
              <button
                type="button"
                className="text-button danger"
                onClick={() => trustedUsers.mutateAsync({ action: "remove", user_id: trusted.user_id }).catch((err) => onError?.(err instanceof Error ? err.message : "Failed"))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <UserSearchPicker
          disabled={addingTrusted}
          excludeUserIds={(trustedQuery.data || []).map((trusted) => trusted.user_id)}
          onSelect={async (user) => {
            setAddingTrusted(true);
            try {
              await trustedUsers.mutateAsync({ action: "add", user_id: user.id });
            } catch (err) {
              onError?.(err instanceof Error ? err.message : "Failed to add trusted user");
            } finally {
              setAddingTrusted(false);
            }
          }}
        />
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <Cloud size={18} />
          <div>
            <div className="eyebrow">Storage</div>
            <h2>Cloud connection</h2>
          </div>
        </div>
        <p className="meta-muted">
          Object storage is provided by CleonHR and managed on the platform.
          Credentials are never exposed in the app.
        </p>
        <p className="meta-muted">Provider: {storage.provider || "cloudflare_r2"}</p>
        <p className="meta-muted">Bucket: {storage.bucket || "—"}</p>
        <span className={`status-badge ${storage.reachable ? "success" : storage.configured ? "pending" : "pending"}`}>
          {storage.reachable
            ? "Connected"
            : storage.configured
              ? "Configured (connection check failed)"
              : "Not configured"}
        </span>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <Download size={18} />
          <div>
            <div className="eyebrow">Export</div>
            <h2>Culture timeline</h2>
          </div>
        </div>
        <p className="meta-muted">Select approved albums to export as a curated culture timeline.</p>
        <div className="export-list switch-list">
          {albums.map((album) => (
            <label key={album.id} className="toggle-row">
              <span><strong>{album.name}</strong></span>
              <input
                className="sg-check"
                type="checkbox"
                checked={selectedAlbums.includes(album.id)}
                onChange={(e) => setSelectedAlbums((prev) => e.target.checked ? [...prev, album.id] : prev.filter((id) => id !== album.id))}
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-button" disabled={!selectedAlbums.length || exporting} onClick={exportTimeline}>
            {exporting ? <LoaderCircle size={16} className="spin" /> : <Settings2 size={16} />}
            Export Culture Timeline (JSON)
          </button>
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
