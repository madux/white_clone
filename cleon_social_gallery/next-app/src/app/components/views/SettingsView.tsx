"use client";

import { useEffect, useState } from "react";
import {
  Bell, Cloud, Download, LoaderCircle, Palette, Settings2, SlidersHorizontal,
} from "lucide-react";
import type { GallerySettings } from "@/lib/types";
import { useGalleryMutations, useGalleryTrustedUsers, applyGalleryTheme } from "@/hooks/useSocialGallery";
import { api } from "@/lib/api";
import { LoadingState } from "../shared/LoadingState";

const BRAND_PINK = "#e83e8c";
const LEGACY_PURPLE = new Set(["#9333ea", "#6e5be7", "#7c3aed", "#71639e", "#714b67"]);

function resolveThemeColor(color?: string) {
  if (!color || LEGACY_PURPLE.has(color.toLowerCase())) return BRAND_PINK;
  return color;
}

export default function SettingsView({
  settings, loading, albums = [], onRefresh, onError,
}: {
  settings?: GallerySettings;
  loading: boolean;
  albums?: Array<{ id: number; name: string }>;
  onRefresh: () => void;
  onError?: (message: string) => void;
}) {
  const { saveSettings, exportBrand, trustedUsers } = useGalleryMutations();
  const trustedQuery = useGalleryTrustedUsers(!!settings);
  const [form, setForm] = useState<Partial<GallerySettings>>({});
  const [storage, setStorage] = useState<Record<string, unknown>>({});
  const [selectedAlbums, setSelectedAlbums] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trustedUserId, setTrustedUserId] = useState("");

  useEffect(() => {
    if (settings) setForm({ ...settings, theme_color: resolveThemeColor(settings.theme_color) });
  }, [settings]);

  useEffect(() => {
    api.storageConfig().then(setStorage).catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.querySelector(".gallery-app") as HTMLElement | null;
    if (!root) return undefined;
    const color = resolveThemeColor(form.theme_color);
    if (color.toLowerCase() === BRAND_PINK) {
      root.style.removeProperty("--pink");
    } else {
      root.style.setProperty("--pink", color);
    }
    return () => {
      root.style.removeProperty("--pink");
    };
  }, [form.theme_color]);

  if (loading || !settings) return <LoadingState message="Loading settings…" />;

  const update = (key: keyof GallerySettings, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings.mutateAsync(form);
      applyGalleryTheme(form.theme_color);
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
            <span className="label">Theme Color</span>
            <div className="contributor-row">
              <Palette size={16} />
              <input type="color" value={resolveThemeColor(form.theme_color)} onChange={(e) => update("theme_color", e.target.value)} />
            </div>
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
              ["ai_moderation_enabled", "AI moderation enabled", "Flag risky uploads before they go live."],
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
        <div className="contributor-row">
          <input
            type="number"
            min={1}
            placeholder="User ID"
            value={trustedUserId}
            onChange={(e) => setTrustedUserId(e.target.value)}
          />
          <button
            type="button"
            className="secondary-button small"
            disabled={!trustedUserId}
            onClick={() => trustedUsers.mutateAsync({ action: "add", user_id: Number(trustedUserId) }).then(() => setTrustedUserId("")).catch((err) => onError?.(err instanceof Error ? err.message : "Failed"))}
          >
            Add trusted user
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <Cloud size={18} />
          <div>
            <div className="eyebrow">Storage</div>
            <h2>Cloud connection</h2>
          </div>
        </div>
        <p className="meta-muted">Provider: {String(storage.provider || "cloudflare_r2")}</p>
        <p className="meta-muted">Bucket: {String(storage.bucket || "—")}</p>
        <span className={`status-badge ${storage.configured ? "success" : "pending"}`}>
          {storage.configured ? "Configured" : "Not configured"}
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
  );
}
