"use client";

import {
  AlertCircle,
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
  Shield,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import SectionTabs from "./SectionTabs";
import AppToolbar from "./AppToolbar";
import EmptyState from "./EmptyState";
import StatusPill from "./StatusPill";
import ListPagination from "./ListPagination";
import { useClientPagination } from "../../../lib/useClientPagination";
import { useSearchParams } from "next/navigation";
import { useToast } from "../../../hooks/useToast";
import { useAppDialog } from "../../../hooks/useAppDialog";
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
import DocumentTypeFormDialog, {
  DOCUMENT_TYPE_CATEGORIES,
  emptyDocumentTypeForm,
  type DocumentTypeFormValues,
} from "./DocumentTypeForm";
import RolesPage from "./RolesPage";
import EmployeeFilesSettingsPanel from "./EmployeeFilesSettingsPanel";
import {
  ONBOARDING_MODULE_META,
  ONBOARDING_MODULE_ORDER,
  type OnboardingModuleId,
} from "../../../lib/onboardingModules";
const sections = [
  {
    id: "types",
    label: "Document types",
    shortLabel: "Types",
    description: "Keep classification consistent across every upload.",
    icon: FileText,
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
  default_retention_period: "7",
  recycle_bin_retention_days: 30,
  default_approver_ids: [],
};

const rolesSection = {
  id: "roles" as const,
  label: "Module roles",
  shortLabel: "Roles",
  description: "Custom roles for Employee Files and Organizational Files, plus platform administrator access.",
  icon: Shield,
};

type SectionId = (typeof sections)[number]["id"] | "roles";

export default function SettingsPage() {
  const query = useSettings();
  const currentUser = useCurrentUser();
  const params = useSearchParams();
  const { showToast } = useToast();
  const { showConfirm } = useAppDialog();
  const save = useSaveSettings();
  const saveType = useSaveSettingsDocumentType();
  const toggleType = useToggleSettingsDocumentType();
  const deleteType = useDeleteSettingsDocumentType();

  const [typeForm, setTypeForm] = useState<DocumentTypeFormValues | null>(null);

  const openDocumentTypeForm = (item?: Record<string, any>) => {
    setTypeForm(emptyDocumentTypeForm(item));
  };

  const handleDeleteDocumentType = async (item: { id: number; name: string }) => {
    if (
      !(await showConfirm(
        `Delete document type "${item.name}"? This cannot be undone.`,
        { title: "Delete document type", confirmLabel: "Delete" },
      ))
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
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);

  const canManageRoles =
    currentUser.data?.is_document_admin === true ||
    currentUser.data?.is_admin === true;

  const visibleSections = useMemo(
    () => (canManageRoles ? [...sections, rolesSection] : [...sections]),
    [canManageRoles],
  );

  const guideTarget = params.get("guide");
  const requestedSection = params.get("section");
  const guideSection: SectionId | null =
    guideTarget === "document-types" || guideTarget === "approval-workflow"
      ? "types"
      : null;

  useEffect(() => {
    if (query.data?.settings && !settings) setSettings(query.data.settings);
  }, [query.data?.settings, settings]);

  useEffect(() => {
    if (guideSection) setSection(guideSection);
  }, [guideSection]);

  useEffect(() => {
    if (requestedSection === "roles" && canManageRoles) {
      setSection("roles");
    }
    if (requestedSection === "employee_files") {
      setSection("employee_files");
    }
    if (requestedSection === "access") {
      setSection("types");
    }
  }, [requestedSection, canManageRoles]);

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
    <div className="app-page">
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
          level="page"
          stretch
          ariaLabel="Settings sections"
        />
        <div className="mt-6">
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

      {typeForm && (
        <DocumentTypeFormDialog
          form={typeForm}
          setForm={setTypeForm}
          onClose={() => setTypeForm(null)}
          onSubmit={saveDocumentType}
          saving={saveType.isPending}
          allApprovers={allApprovers}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="app-page-body p-8 text-center text-sm text-slate-500">
      Loading workspace settings…
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
  const paging = useClientPagination(types, `${types.length}:${search}`);
  return (
    <section className="app-table-well app-page-body">
      <AppToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search document types"
        actions={
          <button type="button" onClick={() => edit()} className="app-btn app-btn-primary">
            <Plus className="h-4 w-4" /> Add type
          </button>
        }
      />

      {types.length === 0 ? (
        <EmptyState
          title={
            total === 0
              ? "Start your classification library"
              : "No matching document types"
          }
          description={
            total === 0
              ? "Create a document type so every upload has a clear, consistent home."
              : "Try another search term or clear the search field."
          }
          action={
            total === 0 ? (
              <button type="button" onClick={() => edit()} className="app-btn app-btn-primary">
                Create first type
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="ef-table min-w-[720px] text-left">
            <thead>
              <tr>
                <th>Document type</th>
                <th>Category</th>
                <th>Retention</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paging.items.map((item: any) => (
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
                    {DOCUMENT_TYPE_CATEGORIES.find(([id]) => id === item.category)?.[1] ||
                      item.category}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {item.default_retention_years} years
                  </td>
                    <td>
                      <StatusPill label={item.active ? "Active" : "Inactive"} />
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
          <ListPagination
            page={paging.page}
            pageSize={paging.pageSize}
            total={paging.total}
            onPageChange={paging.setPage}
          />
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

function LifecyclePanel({ values, update }: any) {
  return (
    <div className="app-page-body">
      <table>
        <thead>
          <tr>
            <th>Setting</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <p className="font-semibold">Default retention</p>
              <p className="text-xs text-slate-500">
                Applied to new folders unless an administrator chooses a different period.
              </p>
            </td>
            <td className="w-56">
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
            </td>
          </tr>
          <tr>
            <td>
              <p className="font-semibold">Recycle-bin retention</p>
              <p className="text-xs text-slate-500">
                Deleted items remain recoverable for this many days before cleanup.
              </p>
            </td>
            <td>
              <input
                type="number"
                min="1"
                className="field"
                value={values.recycle_bin_retention_days || 30}
                onChange={(event) =>
                  update("recycle_bin_retention_days", Number(event.target.value))
                }
              />
            </td>
          </tr>
        </tbody>
      </table>
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
