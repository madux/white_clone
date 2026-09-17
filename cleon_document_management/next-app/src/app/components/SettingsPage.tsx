"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CircleHelp,
  FileText,
  FolderCog,
  History,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import SectionTabs from "./SectionTabs";
import { useSearchParams } from "next/navigation";
import { useToast } from "../../../hooks/useToast";
import {
  useSaveSettings,
  useDeleteSettingsDocumentType,
  useSaveSettingsDocumentType,
  useSettings,
  useToggleSettingsDocumentType,
  useUpdateOnboarding,
  useCurrentUser,
  useOnboarding,
} from "../../../hooks/useDocuments";
import ThemedSelect from "./ThemedSelect";
import ModalDialog from "./ModalDialog";
import RolesPage from "./RolesPage";
import EmployeeFilesSettingsPanel from "./EmployeeFilesSettingsPanel";
import {
  ONBOARDING_MODULE_META,
  ONBOARDING_MODULE_ORDER,
  type OnboardingModuleId,
} from "../../../lib/onboardingModules";
const categories = [
  ["hr", "Human Resources"],
  ["finance", "Finance"],
  ["legal", "Legal"],
  ["identity", "Identity"],
  ["employment", "Employment"],
  ["medical", "Medical"],
  ["training", "Training"],
  ["other", "Other"],
] as const;

const sections = [
  {
    id: "types",
    label: "Document types",
    shortLabel: "Types",
    description: "Keep classification consistent across every upload.",
    icon: FileText,
  },
  {
    id: "access",
    label: "Access defaults",
    shortLabel: "Access",
    description: "Choose the audience for new organizational folders.",
    icon: FolderCog,
  },
  {
    id: "lifecycle",
    label: "Retention & lifecycle",
    shortLabel: "Lifecycle",
    description: "Control retention and recycle-bin behavior.",
    icon: History,
  },
  {
    id: "onboarding",
    label: "Help & onboarding",
    shortLabel: "Help",
    description: "Restart the guided introduction for your workspace.",
    icon: CircleHelp,
  },
  {
    id: "employee_files",
    label: "Employee Files",
    shortLabel: "EF v3",
    description: "EMS grouping, upload rules, and error handling.",
    icon: FolderCog,
  },
] as const;

const fallbackSettings = {
  default_require_upload_approval: false,
  default_approval_flow: "any",
  default_access_scope: "all_staff",
  default_retention_period: "7",
  recycle_bin_retention_days: 30,
  default_approver_ids: [],
};

const accessOptions = [
  {
    value: "all_staff",
    label: "All staff",
    description: "Everyone in the company can access the folder.",
  },
  {
    value: "department",
    label: "Specific departments",
    description: "Limit access to selected departments.",
  },
  {
    value: "grade",
    label: "Specific grades",
    description: "Limit access to selected job grades.",
  },
  {
    value: "individual",
    label: "Specific employees",
    description: "Choose exactly who can access it.",
  },
  {
    value: "admin_only",
    label: "Admin only",
    description: "Keep the folder restricted to document managers.",
  },
];

const rolesSection = {
  id: "roles" as const,
  label: "Module roles",
  shortLabel: "Roles",
  description: "Assign manager and administrator responsibilities.",
  icon: Shield,
};

type SectionId = (typeof sections)[number]["id"] | "roles";

export default function SettingsPage() {
  const query = useSettings();
  const currentUser = useCurrentUser();
  const params = useSearchParams();
  const { showToast } = useToast();
  const save = useSaveSettings();
  const saveType = useSaveSettingsDocumentType();
  const toggleType = useToggleSettingsDocumentType();
  const deleteType = useDeleteSettingsDocumentType();

  const openDocumentTypeForm = (item?: Record<string, any>) => {
    const base = {
      name: "",
      category: "other",
      description: "",
      is_mandatory_default: false,
      expiry_applicable: false,
      require_upload_approval: false,
      require_issue_date: false,
      require_description: false,
      enable_versioning: true,
      duplicate_detection_mode: "inherit" as const,
      approval_flow: "any" as const,
      approver_ids: [] as number[],
      default_retention_years: 7,
    };
    if (!item) {
      setTypeForm(base);
      return;
    }
    setTypeForm({
      ...base,
      ...item,
      approver_ids:
        item.approver_ids ??
        (item.approvers ?? []).map((approver: { id: number }) => approver.id),
    });
  };

  const handleDeleteDocumentType = async (item: { id: number; name: string }) => {
    if (
      !window.confirm(
        `Delete document type "${item.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const result = await deleteType.mutateAsync(item.id);
      if (result.success) {
        setNotice({ message: "Document type deleted." });
      } else {
        setNotice({
          message: result.message || "Unable to delete document type.",
          error: true,
        });
      }
    } catch {
      setNotice({
        message: "The document type could not be deleted.",
        error: true,
      });
    }
  };
  const updateOnboarding = useUpdateOnboarding();
  const [section, setSection] = useState<SectionId>("types");
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [typeForm, setTypeForm] = useState<Record<string, any> | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);

  const visibleSections = useMemo(
    () =>
      currentUser.data?.is_admin ? [...sections, rolesSection] : [...sections],
    [currentUser.data?.is_admin],
  );

  const guideTarget = params.get("guide");
  const requestedSection = params.get("section");
  const guideSection: SectionId | null =
    guideTarget === "document-types" || guideTarget === "approval-workflow"
      ? "types"
      : guideTarget === "sharing"
        ? "access"
        : null;

  useEffect(() => {
    if (query.data?.settings && !settings) setSettings(query.data.settings);
  }, [query.data?.settings, settings]);

  useEffect(() => {
    if (guideSection) setSection(guideSection);
  }, [guideSection]);

  useEffect(() => {
    if (requestedSection === "roles" && currentUser.data?.is_admin) {
      setSection("roles");
    }
    if (requestedSection === "employee_files") {
      setSection("employee_files");
    }
  }, [requestedSection, currentUser.data?.is_admin]);

  const values = settings ?? query.data?.settings ?? fallbackSettings;
  const documentTypes = query.data?.document_types ?? [];
  const allApprovers = query.data?.approvers ?? [];

  const filteredTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documentTypes;
    return documentTypes.filter((item: any) =>
      `${item.name} ${item.category} ${item.description ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [documentTypes, search]);

  const update = (key: string, value: any) => {
    setSettings({ ...values, [key]: value });
    setNotice(null);
  };

  const saveSettings = async () => {
    try {
      const result = await save.mutateAsync(values);
      if (result.success) {
        setSettings(result.data ?? values);
        setNotice(null);
        showToast("Settings saved successfully.");
      } else {
        setNotice(null);
        showToast(result.message || "Failed to save settings.", "error");
      }
    } catch {
      setNotice(null);
      showToast(
        "Failed to save settings. Check your connection and try again.",
        "error",
      );
    }
  };

  const saveDocumentType = async (event: FormEvent) => {
    event.preventDefault();
    if (!typeForm) return;
    try {
      const result = await saveType.mutateAsync(typeForm);
      if (result.success) {
        setTypeForm(null);
        setNotice({ message: "Document type saved." });
      } else {
        setNotice({
          message: result.message || "Unable to save document type.",
          error: true,
        });
      }
    } catch {
      setNotice({
        message: "The document type could not be saved. Try again.",
        error: true,
      });
    }
  };

  const isDocAdmin = currentUser.data?.is_document_admin === true;

  return (
    <div className="min-h-full bg-[#f7f8fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        {query.isError && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">Latest settings are unavailable.</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  You can review the controls below or retry the connection.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-2 self-start !rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {notice && (
          <div
            className={`mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
          >
            {notice.error ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {notice.message}
          </div>
        )}

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 pt-5 sm:px-8 sm:pt-7">
            <div className="overflow-x-auto pb-1">
              <SectionTabs
                items={visibleSections.map((item) => ({
                  id: item.id,
                  label: item.label,
                  icon: item.icon,
                  emphasisClassName:
                    guideSection === item.id ? "guide-emphasis" : undefined,
                }))}
                value={section}
                onChange={setSection}
                ariaLabel="Settings sections"
              />
            </div>
          </div>

          <div className="min-h-[590px] p-5 sm:p-8">
            {query.isLoading ? (
              <LoadingState />
            ) : section === "types" ? (
              <Types
                types={filteredTypes}
                total={documentTypes.length}
                search={search}
                setSearch={setSearch}
                edit={openDocumentTypeForm}
                toggle={(id: number) => toggleType.mutate(id)}
                onDelete={handleDeleteDocumentType}
                loading={toggleType.isPending || deleteType.isPending}
              />
            ) : section === "employee_files" ? (
              <EmployeeFilesSettingsPanel />
            ) : section === "roles" ? (
              <RolesPage embedded />
            ) : section === "onboarding" ? (
              <OnboardingPanel
                resetModule={async (moduleId: OnboardingModuleId) => {
                  try {
                    await updateOnboarding.mutateAsync({
                      action: "reset",
                      module: moduleId,
                    });
                    await updateOnboarding.mutateAsync({
                      action: "arm",
                      module: moduleId,
                    });
                    setNotice({
                      message: `${ONBOARDING_MODULE_META[moduleId].label} guide restarted.`,
                    });
                  } catch {
                    setNotice({
                      message: "The guide could not be restarted.",
                      error: true,
                    });
                  }
                }}
                resetting={updateOnboarding.isPending}
              />
            ) : (
              <SettingsPanel
                section={section}
                values={values}
                update={update}
                save={saveSettings}
                saving={save.isPending}
              />
            )}
          </div>
        </section>
      </div>

      {typeForm && (
        <TypeModal
          form={typeForm}
          setForm={setTypeForm}
          submit={saveDocumentType}
          saving={saveType.isPending}
          allApprovers={allApprovers}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[470px] flex-col items-center justify-center text-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-pink-100 border-t-brand-pink" />
      <p className="mt-4 text-sm font-bold text-slate-700">
        Loading workspace settings
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Preparing your configuration controls.
      </p>
    </div>
  );
}

function Types({
  types,
  total,
  search,
  setSearch,
  edit,
  toggle,
  onDelete,
  loading,
}: any) {
  return (
    <section>
      <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900">Document types</h3>
            <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-brand-text">
              {total}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block sm:w-64">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search document types"
              className="field pl-10"
            />
          </label>
          <button
            type="button"
            onClick={() => edit()}
            className="inline-flex items-center justify-center gap-2 !rounded-xl bg-gradient-to-r from-brand-text to-brand-pink px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(232,62,140,0.18)] transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" /> Add type
          </button>
        </div>
      </div>

      {types.length === 0 ? (
        <div className="mt-7 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-50 text-brand-pink">
            <FileText className="h-6 w-6" />
          </div>
          <h4 className="mt-4 text-base font-bold text-slate-800">
            {total === 0
              ? "Start your classification library"
              : "No matching document types"}
          </h4>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            {total === 0
              ? "Create a document type so every upload has a clear, consistent home."
              : "Try another search term or clear the search field."}
          </p>
          {total === 0 && (
            <button
              type="button"
              onClick={() => edit()}
              className="mt-5 !rounded-xl border border-brand-pink/30 bg-white px-4 py-2.5 text-sm font-bold text-brand-text hover:bg-pink-50"
            >
              Create first type
            </button>
          )}
        </div>
      ) : (
        <div className="mt-7 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              <tr>
                <th className="px-5 py-4">Document type</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Retention</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((item: any) => (
                <tr key={item.id} className="transition hover:bg-pink-50/30">
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-800">
                      {item.name}
                    </p>
                    <p className="mt-1 max-w-sm truncate text-xs text-slate-400">
                      {item.description || "No description"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {categories.find(([id]) => id === item.category)?.[1] ||
                      item.category}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {item.default_retention_years} years
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Edit document type"
                        aria-label="Edit document type"
                        onClick={() => edit(item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-pink-50 hover:text-brand-pink"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={item.active ? "Deactivate" : "Activate"}
                        aria-label={item.active ? "Deactivate" : "Activate"}
                        disabled={loading}
                        onClick={() => toggle(item.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                      >
                        {item.active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Delete document type"
                        aria-label="Delete document type"
                        disabled={loading}
                        onClick={() => void onDelete(item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SettingsPanel({
  section,
  values,
  update,
  save,
  saving,
}: any) {
  return (
    <section>
      {section === "access" && (
        <AccessPanel
          value={values.default_access_scope || "all_staff"}
          update={update}
        />
      )}
      {section === "lifecycle" && (
        <LifecyclePanel values={values} update={update} />
      )}

      <div className="mt-9 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          Changes apply to newly created folders and uploads.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 !rounded-xl bg-gradient-to-r from-brand-text to-brand-pink px-5 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(232,62,140,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}

function AccessPanel({ value, update }: any) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {accessOptions.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => update("default_access_scope", option.value)}
            className={`flex items-start gap-4 !rounded-2xl border p-5 text-left transition ${active ? "border-brand-pink bg-pink-50/60 shadow-sm" : "border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/20"}`}
          >
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? "border-brand-pink" : "border-slate-300"}`}
            >
              {active && (
                <span className="h-2.5 w-2.5 rounded-full bg-brand-pink" />
              )}
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-800">
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LifecyclePanel({ values, update }: any) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
          <History className="h-5 w-5" />
        </div>
        <h4 className="mt-4 text-sm font-bold text-slate-900">
          Default retention
        </h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Applied to new folders unless an administrator chooses a different
          period.
        </p>
        <div className="mt-5">
          <ThemedSelect
            value={values.default_retention_period || "7"}
            onChange={(value) => update("default_retention_period", value)}
            options={[
              { value: "1", label: "1 year" },
              { value: "3", label: "3 years" },
              { value: "5", label: "5 years" },
              { value: "7", label: "7 years" },
              { value: "10", label: "10 years" },
              { value: "permanent", label: "Permanent" },
            ]}
          />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-brand-primary">
          <History className="h-5 w-5" />
        </div>
        <h4 className="mt-4 text-sm font-bold text-slate-900">
          Recycle-bin retention
        </h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Deleted items remain recoverable for this many days before cleanup.
        </p>
        <div className="relative mt-5">
          <input
            type="number"
            min="1"
            className="field bg-slate-50 pr-16"
            value={values.recycle_bin_retention_days || 30}
            onChange={(event) =>
              update("recycle_bin_retention_days", Number(event.target.value))
            }
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
            days
          </span>
        </div>
      </div>
    </div>
  );
}

function OnboardingPanel({
  resetModule,
  resetting,
}: {
  resetModule: (moduleId: OnboardingModuleId) => void;
  resetting: boolean;
}) {
  const onboarding = useOnboarding();
  const isAdmin = onboarding.data?.is_admin;

  const modules = ONBOARDING_MODULE_ORDER.filter((moduleId) => {
    if (moduleId === "workspace") return true;
    if (moduleId === "employee_files") return isAdmin;
    return isAdmin;
  });

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <h4 className="text-sm font-bold text-slate-900">Module guides</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Each area of Document Management has its own guide. They appear when you enter that
          module—or after Employee Files setup completes—and can be restarted here.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((moduleId) => {
          const meta = ONBOARDING_MODULE_META[moduleId];
          const mod = onboarding.data?.modules?.[moduleId];
          const done = mod?.completed;
          const dismissed = mod?.dismissed;
          const status = done
            ? "Completed"
            : dismissed
              ? "Dismissed"
              : mod?.show
                ? "In progress"
                : "Not started";
          return (
            <div
              key={moduleId}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
                <CircleHelp className="h-5 w-5" />
              </div>
              <h4 className="mt-4 text-sm font-bold text-slate-900">{meta.label}</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">{meta.subtitle}</p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {status}
              </p>
              <button
                type="button"
                onClick={() => resetModule(moduleId)}
                disabled={resetting}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-pink-200 hover:bg-pink-50/40 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart guide
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-7 w-12 !rounded-full p-1 transition ${checked ? "bg-brand-pink" : "bg-slate-300"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function TypeApprovalEditor({ form, setForm, allApprovers }: any) {
  const selectedIds: number[] = form.approver_ids ?? [];
  const sequential = form.approval_flow === "sequential";

  const toggleApprover = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id];
    setForm({ ...form, approver_ids: next });
  };

  const moveApprover = (id: number, direction: -1 | 1) => {
    const index = selectedIds.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setForm({ ...form, approver_ids: next });
  };

  const selectedPeople = selectedIds
    .map((id) => allApprovers.find((item: any) => Number(item.id) === id))
    .filter(Boolean);

  return (
    <div className="sm:col-span-2 space-y-4 rounded-2xl border border-pink-100 bg-pink-50/30 p-4">
      <p className="text-sm font-bold text-slate-800">Approval pipeline</p>
      <div className="grid gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3">
        {[
          {
            value: "any",
            label: "Single approver",
            description: "One selected reviewer can approve.",
          },
          {
            value: "sequential",
            label: "Sequential",
            description: "Reviewers approve in the order you set.",
          },
          {
            value: "random",
            label: "All approvers",
            description: "Everyone must approve.",
          },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              setForm({ ...form, approval_flow: option.value })
            }
            aria-pressed={form.approval_flow === option.value}
            className={`!rounded-lg px-3 py-2.5 text-left transition ${form.approval_flow === option.value ? "bg-white text-brand-text shadow-sm" : "text-slate-400 hover:bg-white/70 hover:text-slate-700"}`}
          >
            <span className="block text-xs font-bold">{option.label}</span>
            <span className="mt-1 block text-[10px] font-medium leading-4 text-slate-500">
              {option.description}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          {allApprovers.map((person: any) => {
            const active = selectedIds.includes(Number(person.id));
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => toggleApprover(Number(person.id))}
                className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-pink-50 font-semibold text-brand-text" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span>{person.name}</span>
                {active ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Selected approvers
          </p>
          {selectedPeople.length ? (
            <ul className="mt-2 space-y-2">
              {selectedPeople.map((person: any) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-2 text-sm font-medium text-slate-700"
                >
                  <span>{person.name}</span>
                  {sequential ? (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        onClick={() => moveApprover(Number(person.id), -1)}
                        className="rounded-lg p-1 hover:bg-slate-100"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={() => moveApprover(Number(person.id), 1)}
                        className="rounded-lg p-1 hover:bg-slate-100"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Choose at least one approver for this type.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeModal({ form, setForm, submit, saving, allApprovers }: any) {
  return (
    <ModalDialog
      title={form.id ? "Edit document type" : "Add document type"}
      description="Give uploads a clear, consistent classification."
      onClose={() => setForm(null)}
      size="xl"
      backdropClassName="bg-slate-950/35"
    >
      <form onSubmit={submit}>
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
          <FileText className="h-5 w-5" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label">Name</span>
            <input
              required
              className="field"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="e.g. Employment contract"
            />
          </label>
          <label>
            <span className="label">Category</span>
            <ThemedSelect
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
              options={categories.map(([value, label]) => ({ value, label }))}
            />
          </label>
          <label>
            <span className="label">Default retention</span>
            <div className="relative">
              <input
                type="number"
                min="0"
                className="field pr-16"
                value={form.default_retention_years}
                onChange={(event) =>
                  setForm({
                    ...form,
                    default_retention_years: Number(event.target.value),
                  })
                }
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                years
              </span>
            </div>
          </label>
          <label className="sm:col-span-2">
            <span className="label">
              Description{" "}
              <em className="font-normal normal-case tracking-normal text-slate-400">
                (optional)
              </em>
            </span>
            <textarea
              className="field min-h-24"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="When should this type be used?"
            />
          </label>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.is_mandatory_default}
              onChange={(event) =>
                setForm({ ...form, is_mandatory_default: event.target.checked })
              }
              className="h-4 w-4 accent-pink-600"
            />
            Make this mandatory by default
          </label>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.expiry_applicable)}
              onChange={(event) =>
                setForm({ ...form, expiry_applicable: event.target.checked })
              }
              className="h-4 w-4 accent-pink-600"
            />
            Expiry applicable
          </label>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.enable_versioning ?? true)}
              onChange={(event) =>
                setForm({ ...form, enable_versioning: event.target.checked })
              }
              className="h-4 w-4 accent-pink-600"
            />
            Enable versioning (Update replaces current file)
          </label>
          <label className="sm:col-span-2 block">
            <span className="label">Duplicate handling</span>
            <ThemedSelect
              value={String(form.duplicate_detection_mode || "inherit")}
              onChange={(value) =>
                setForm({ ...form, duplicate_detection_mode: value })
              }
              options={[
                { value: "inherit", label: "Inherit company default" },
                { value: "warn", label: "Warn user" },
                { value: "prevent", label: "Prevent duplicate" },
                {
                  value: "allow_confirm",
                  label: "Allow with confirmation",
                },
              ]}
            />
          </label>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.require_upload_approval)}
              onChange={(event) =>
                setForm({
                  ...form,
                  require_upload_approval: event.target.checked,
                })
              }
              className="h-4 w-4 accent-pink-600"
            />
            Require approval before this type becomes current
          </label>
          {form.require_upload_approval ? (
            <TypeApprovalEditor
              form={form}
              setForm={setForm}
              allApprovers={allApprovers}
            />
          ) : null}
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.require_issue_date)}
              onChange={(event) =>
                setForm({ ...form, require_issue_date: event.target.checked })
              }
              className="h-4 w-4 accent-pink-600"
            />
            Require issue date on upload
          </label>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.require_description)}
              onChange={(event) =>
                setForm({ ...form, require_description: event.target.checked })
              }
              className="h-4 w-4 accent-pink-600"
            />
            Require description on upload
          </label>
        </div>
        <div className="mt-8 flex justify-end gap-2 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => setForm(null)}
            className="!rounded-xl px-4 py-2.5 font-semibold text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="!rounded-xl bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white shadow-[0_8px_18px_rgba(232,62,140,0.18)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save type"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
