"use client";

import { Check, ChevronLeft, LoaderCircle, Save, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMediaQuery } from "../../../../hooks/useMediaQuery";
import type { DocumentarySettings } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import {
  useDocumentarySettings,
  useSaveDocumentarySettings,
} from "../../../../hooks/useDocumentary";
import RolesPage from "../RolesPage";
import {
  DocumentarySettingsSidebar,
  type DocumentarySettingsSidebarGroup,
} from "./DocumentarySettingsSidebar";
import { DocumentarySettingsMobileMenu } from "./DocumentarySettingsMobileMenu";

type SettingsSection = "general" | "uploads" | "retention" | "roles";

const SECTION_DEFS: { id: SettingsSection; label: string; group: string }[] = [
  { id: "general", label: "General", group: "Workspace" },
  { id: "uploads", label: "Upload & storage", group: "Content" },
  { id: "retention", label: "Retention & lifecycle", group: "Content" },
  { id: "roles", label: "Roles & access", group: "Access & governance" },
];

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="doc-settings-card rounded-2xl border border-[var(--rule)] bg-white p-5">
      <div className="mb-5 border-b border-[var(--rule)] pb-4">
        <h2>{title}</h2>
        {description ? <p className="mt-1 text-[0.875rem] leading-relaxed">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-[var(--rule)] py-4 last:border-0">
      <span className="min-w-0">
        <strong className="block text-[0.875rem] font-semibold">{title}</strong>
        {description ? (
          <small className="mt-1 block text-[0.8125rem] leading-relaxed">{description}</small>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="doc-settings-toggle"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </span>
      <div className="mt-2 flex max-w-[200px] overflow-hidden rounded-lg border border-[var(--rule)] bg-white">
        <input
          type="number"
          min={min}
          max={max}
          className="min-w-0 flex-1 border-0 px-3 py-2 text-[0.875rem] outline-none"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? (
          <span className="bg-[#f4f2f6] px-3 py-2 text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function DocumentarySettingsPage({
  onClose,
  onNotice,
  isDocumentaryAdmin = false,
  isSystemAdmin = false,
}: {
  onClose: () => void;
  onNotice: (type: "error" | "success", text: string) => void;
  isDocumentaryAdmin?: boolean;
  isSystemAdmin?: boolean;
}) {
  const canConfigure = isDocumentaryAdmin || isSystemAdmin;
  const isCompactSettings = useMediaQuery("(max-width: 1023px)");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(true);
  const query = useDocumentarySettings(true);
  const save = useSaveDocumentarySettings();
  const [section, setSection] = useState<SettingsSection>("general");
  const [settingsFind, setSettingsFind] = useState("");
  const [form, setForm] = useState<DocumentarySettings | null>(null);
  const [storageStatus, setStorageStatus] = useState<{
    configured?: boolean;
    reachable?: boolean;
    bucket?: string;
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const visibleSections = useMemo(() => {
    const term = settingsFind.trim().toLowerCase();
    return SECTION_DEFS.filter((item) => {
      if (item.id === "roles" && !canConfigure) return false;
      if (!term) return true;
      return item.label.toLowerCase().includes(term);
    });
  }, [settingsFind, canConfigure]);

  const sidebarGroups = useMemo((): DocumentarySettingsSidebarGroup[] => {
    const visibleIds = new Set(visibleSections.map((item) => item.id));
    const titles = Array.from(new Set(SECTION_DEFS.map((item) => item.group)));
    return titles.map((title) => ({
      title,
      items: SECTION_DEFS.filter((item) => item.group === title && visibleIds.has(item.id)).map(
        (item) => ({ id: item.id, label: item.label }),
      ),
    }));
  }, [visibleSections]);

  useEffect(() => {
    if (!visibleSections.some((item) => item.id === section)) {
      const fallback = visibleSections[0]?.id;
      if (fallback) setSection(fallback);
    }
  }, [visibleSections, section]);

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    if (!form || !canConfigure) return;
    try {
      await save.mutateAsync(form);
      onNotice("success", "Settings saved successfully.");
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Settings could not be saved.");
    }
  }

  const loading = query.isLoading && !form;
  const activeSectionLabel =
    SECTION_DEFS.find((item) => item.id === section)?.label || "Settings";

  function selectSection(id: SettingsSection) {
    setSection(id);
    if (isCompactSettings) setMobileMenuOpen(false);
  }

  return (
    <div className="analytics-backdrop is-fullscreen documentary-settings-backdrop" role="dialog" aria-modal="true">
      <div
        className={`analytics-shell documentary-settings-shell font-sans${isCompactSettings ? " is-compact" : ""}`}
      >
        <header className="documentary-settings-header">
          <div>
            <p className="documentary-settings-eyebrow">Company Documentary</p>
            <h1>Settings</h1>
            <p className="documentary-settings-subtitle">
              Configure library policies, uploads, retention, and access.
            </p>
          </div>
          <div className="modal-header-actions">
            {canConfigure && section !== "roles" && form ? (
              <button
                type="button"
                className="primary-button"
                disabled={!form || save.isPending}
                onClick={() => void handleSave()}
              >
                {save.isPending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                Save changes
              </button>
            ) : null}
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close settings">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="documentary-settings-body">
          {isCompactSettings && mobileMenuOpen ? (
            <DocumentarySettingsMobileMenu
              groups={sidebarGroups}
              search={settingsFind}
              onSearchChange={setSettingsFind}
              onSelect={(id) => selectSection(id as SettingsSection)}
            />
          ) : (
            <>
              {!isCompactSettings ? (
                <DocumentarySettingsSidebar
                  groups={sidebarGroups}
                  activeId={section}
                  onSelect={(id) => selectSection(id as SettingsSection)}
                  search={settingsFind}
                  onSearchChange={setSettingsFind}
                />
              ) : null}

              <main className="documentary-settings-main">
                {isCompactSettings ? (
                  <button
                    type="button"
                    className="documentary-settings-mobile-back"
                    onClick={() => setMobileMenuOpen(true)}
                  >
                    <ChevronLeft size={18} aria-hidden />
                    <span>All settings</span>
                    <strong>{activeSectionLabel}</strong>
                  </button>
                ) : null}
            {loading ? (
              <div className="loading-state">
                <LoaderCircle className="spin" size={24} />
                <span>Loading settings…</span>
              </div>
            ) : section === "roles" ? (
              <RolesPage embedded />
            ) : form ? (
              <form className="documentary-settings-form" onSubmit={(e) => void handleSave(e)}>
                {section === "general" && (
                  <div className="max-w-2xl space-y-4">
                    <SettingsCard
                      title="Library policies"
                      description="Controls who can download, share externally, and how uploads enter the review workflow."
                    >
                      <ToggleRow
                        title="Require upload approval"
                        description="Supervisors submit new uploads for administrator review before publish."
                        checked={form.require_upload_approval}
                        disabled={!canConfigure}
                        onChange={(value) => setForm({ ...form, require_upload_approval: value })}
                      />
                      <ToggleRow
                        title="Department restrictions"
                        description="Employees only see documentaries scoped to their EMS department audience."
                        checked={form.department_restrictions}
                        disabled={!canConfigure}
                        onChange={(value) => setForm({ ...form, department_restrictions: value })}
                      />
                      <ToggleRow
                        title="Employee download"
                        description="Allow employees to download videos when folder and video policy allow it."
                        checked={form.employee_download}
                        disabled={!canConfigure}
                        onChange={(value) => setForm({ ...form, employee_download: value })}
                      />
                      <ToggleRow
                        title="External sharing"
                        description="Enables expiring external view links when permitted on a video."
                        checked={form.external_sharing}
                        disabled={!canConfigure}
                        onChange={(value) => setForm({ ...form, external_sharing: value })}
                      />
                      <ToggleRow
                        title="Compliance analytics tab"
                        description="Show per-employee training compliance in Documentary analytics."
                        checked={form.compliance_analytics}
                        disabled={!canConfigure}
                        onChange={(value) => setForm({ ...form, compliance_analytics: value })}
                      />
                    </SettingsCard>
                  </div>
                )}

                {section === "uploads" && (
                  <div className="max-w-2xl space-y-4">
                    <SettingsCard
                      title="Upload limits"
                      description="Applies to every multipart upload in Company Documentary."
                    >
                      <div className="grid gap-6 sm:grid-cols-2">
                        <NumberField
                          label="Max upload size"
                          value={form.max_upload_mb}
                          min={50}
                          max={10240}
                          suffix="MB"
                          disabled={!canConfigure}
                          onChange={(value) => setForm({ ...form, max_upload_mb: value })}
                        />
                        <NumberField
                          label="Storage quota"
                          value={form.storage_quota_gb}
                          min={1}
                          suffix="GB"
                          disabled={!canConfigure}
                          onChange={(value) => setForm({ ...form, storage_quota_gb: value })}
                        />
                      </div>
                    </SettingsCard>
                    <SettingsCard
                      title="Object storage"
                      description="Cloudflare R2 is managed on the platform. Credentials are never exposed in the app."
                    >
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
                              ? "R2 is configured but could not be reached. Check server logs."
                              : "Cloudflare R2 is not configured on this server."}
                        </div>
                      ) : (
                        <div className="connection-status">
                          <Settings2 size={15} /> Storage status could not be loaded.
                        </div>
                      )}
                    </SettingsCard>
                  </div>
                )}

                {section === "retention" && (
                  <div className="max-w-2xl space-y-4">
                    <SettingsCard
                      title="Retention & lifecycle"
                      description="Recycle bin, archival, and disposition rules for published documentaries."
                    >
                      <div className="grid gap-6 sm:grid-cols-2">
                        <NumberField
                          label="Retention after deletion"
                          value={form.retention_years}
                          min={1}
                          max={25}
                          suffix="years"
                          disabled={!canConfigure}
                          onChange={(value) => setForm({ ...form, retention_years: value })}
                        />
                        <NumberField
                          label="Restore window"
                          value={form.restore_window_days}
                          min={7}
                          max={365}
                          suffix="days"
                          disabled={!canConfigure}
                          onChange={(value) => setForm({ ...form, restore_window_days: value })}
                        />
                        <NumberField
                          label="Auto-archive published"
                          value={form.auto_archive_months}
                          min={0}
                          max={120}
                          suffix="months"
                          disabled={!canConfigure}
                          onChange={(value) => setForm({ ...form, auto_archive_months: value })}
                        />
                      </div>
                      <p className="mt-2 text-[0.8125rem] text-[var(--muted-foreground)]">
                        Set auto-archive to 0 to disable.
                      </p>
                      <div className="mt-4 border-t border-slate-100 pt-2">
                        <ToggleRow
                          title="Disposition review"
                          description="Require administrator approval before purge at retention end."
                          checked={form.disposition_review}
                          disabled={!canConfigure}
                          onChange={(value) => setForm({ ...form, disposition_review: value })}
                        />
                      </div>
                    </SettingsCard>
                  </div>
                )}

                {canConfigure ? (
                  <div className="documentary-settings-form-actions">
                    <button type="button" className="secondary-button" onClick={onClose}>
                      Close
                    </button>
                    <button type="submit" className="primary-button" disabled={save.isPending}>
                      {save.isPending ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                      Save changes
                    </button>
                  </div>
                ) : null}
              </form>
            ) : null}
              </main>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
