"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  FolderCog,
  History,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  useSaveSettings,
  useSaveSettingsDocumentType,
  useSettings,
  useToggleSettingsDocumentType,
} from "../../../hooks/useDocuments";
import ThemedSelect from "./ThemedSelect";

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
    id: "approval",
    label: "Approval workflow",
    shortLabel: "Approvals",
    description: "Set the default review rule and approval chain.",
    icon: ShieldCheck,
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

type SectionId = (typeof sections)[number]["id"];

export default function SettingsPage() {
  const query = useSettings();
  const save = useSaveSettings();
  const saveType = useSaveSettingsDocumentType();
  const toggleType = useToggleSettingsDocumentType();
  const [section, setSection] = useState<SectionId>("types");
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [typeForm, setTypeForm] = useState<Record<string, any> | null>(null);
  const [search, setSearch] = useState("");
  const [approverSearch, setApproverSearch] = useState("");
  const [notice, setNotice] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);

  useEffect(() => {
    if (query.data?.settings && !settings) setSettings(query.data.settings);
  }, [query.data?.settings, settings]);

  const values = settings ?? query.data?.settings ?? fallbackSettings;
  const documentTypes = query.data?.document_types ?? [];
  const allApprovers = query.data?.approvers ?? [];
  const selectedApprovers = Array.isArray(values.default_approver_ids)
    ? values.default_approver_ids.map(Number)
    : [];
  const currentSection =
    sections.find((item) => item.id === section) ?? sections[0];

  const filteredTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documentTypes;
    return documentTypes.filter((item: any) =>
      `${item.name} ${item.category} ${item.description ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [documentTypes, search]);

  const filteredApprovers = useMemo(() => {
    const term = approverSearch.trim().toLowerCase();
    if (!term) return allApprovers;
    return allApprovers.filter((item: any) =>
      `${item.name} ${item.email}`.toLowerCase().includes(term),
    );
  }, [allApprovers, approverSearch]);

  const update = (key: string, value: any) => {
    setSettings({ ...values, [key]: value });
    setNotice(null);
  };

  const toggleApprover = (id: number) => {
    const next = selectedApprovers.includes(id)
      ? selectedApprovers.filter((value: number) => value !== id)
      : [...selectedApprovers, id];
    update("default_approver_ids", next);
  };

  const moveApprover = (id: number, direction: -1 | 1) => {
    const index = selectedApprovers.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedApprovers.length)
      return;
    const next = [...selectedApprovers];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    update("default_approver_ids", next);
  };

  const saveSettings = async () => {
    try {
      const result = await save.mutateAsync(values);
      if (result.success) {
        setSettings(result.data ?? values);
        setNotice({ message: "Workspace settings saved." });
      } else {
        setNotice({
          message: result.message || "Unable to save settings.",
          error: true,
        });
      }
    } catch {
      setNotice({
        message:
          "The settings could not be saved. Check your connection and try again.",
        error: true,
      });
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

  return (
    <div className="min-h-full bg-[#f7f8fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-7 flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold tracking-[-0.035em] text-slate-950">
              Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Shape how your organization classifies, reviews, shares, and keeps
              its documents.
            </p>
          </div>
        </header>

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
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-pink">
                  Workspace controls
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Configure your document experience
                </h2>
              </div>
              <ShieldCheck className="hidden h-7 w-7 text-pink-200 sm:block" />
            </div>
            <nav
              className="mt-6 flex gap-1 overflow-x-auto"
              aria-label="Settings sections"
            >
              {sections.map((item) => {
                const Icon = item.icon;
                const active = item.id === section;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`group flex shrink-0 items-center gap-2.5 !rounded-t-xl !rounded-b-none border-b px-3.5 py-3 text-sm font-bold transition sm:px-4 ${active ? "border-brand-pink text-brand-text" : "border-transparent text-slate-400 hover:border-pink-200 hover:text-slate-700"}`}
                  >
                    <Icon
                      className={`h-4 w-4 ${active ? "text-brand-pink" : "text-slate-400 group-hover:text-slate-600"}`}
                    />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden">{item.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
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
                edit={setTypeForm}
                toggle={(id: number) => toggleType.mutate(id)}
                loading={toggleType.isPending}
              />
            ) : (
              <SettingsPanel
                section={section}
                values={values}
                update={update}
                allApprovers={allApprovers}
                approvers={filteredApprovers}
                approverSearch={approverSearch}
                setApproverSearch={setApproverSearch}
                selected={selectedApprovers}
                toggleApprover={toggleApprover}
                moveApprover={moveApprover}
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
  loading,
}: any) {
  return (
    <section>
      <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold tracking-[-0.02em] text-slate-900">
              Classification library
            </h3>
            <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-brand-text">
              {total}
            </span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Use consistent document types across employee, organizational, and
            compliance records.
          </p>
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
            onClick={() =>
              edit({
                name: "",
                category: "other",
                description: "",
                is_mandatory_default: false,
                default_retention_years: 7,
              })
            }
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
              onClick={() =>
                edit({
                  name: "",
                  category: "other",
                  description: "",
                  is_mandatory_default: false,
                  default_retention_years: 7,
                })
              }
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
                    <button
                      type="button"
                      onClick={() => edit(item)}
                      className="mr-3 text-xs font-bold text-brand-text hover:text-brand-pink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => toggle(item.id)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                    >
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
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
  allApprovers,
  approvers,
  approverSearch,
  setApproverSearch,
  selected,
  toggleApprover,
  moveApprover,
  save,
  saving,
}: any) {
  return (
    <section>
      <div className="mb-8 flex flex-col gap-2 border-b border-slate-100 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
          {sections.find((item) => item.id === section)?.label}
        </p>
        <h3 className="text-2xl font-bold tracking-[-0.03em] text-slate-900">
          {section === "approval"
            ? "Make review predictable"
            : section === "access"
              ? "Set the default audience"
              : "Keep documents recoverable"}
        </h3>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          {sections.find((item) => item.id === section)?.description}
        </p>
      </div>

      {section === "approval" && (
        <ApprovalPanel
          values={values}
          update={update}
          allApprovers={allApprovers}
          approvers={approvers}
          approverSearch={approverSearch}
          setApproverSearch={setApproverSearch}
          selected={selected}
          toggleApprover={toggleApprover}
          moveApprover={moveApprover}
        />
      )}
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

function ApprovalPanel({
  values,
  update,
  allApprovers,
  approvers,
  approverSearch,
  setApproverSearch,
  selected,
  toggleApprover,
  moveApprover,
}: any) {
  const selectedPeople = selected
    .map((id: number) =>
      allApprovers.find((item: any) => Number(item.id) === id),
    )
    .filter(Boolean);
  const sequential = values.default_approval_flow === "sequential";
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">
                Require approval for new uploads
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                New folders inherit this rule unless an admin changes it.
              </p>
            </div>
            <Switch
              checked={Boolean(values.default_require_upload_approval)}
              onChange={() =>
                update(
                  "default_require_upload_approval",
                  !values.default_require_upload_approval,
                )
              }
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-bold text-slate-800">Review mode</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Choose how selected reviewers can approve a document.
          </p>
          <div className="mt-4 grid gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3">
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
                label: "All reviewers",
                description: "Everyone must approve; order does not matter.",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("default_approval_flow", option.value)}
                aria-pressed={values.default_approval_flow === option.value}
                className={`!rounded-lg px-3 py-2.5 text-left transition ${values.default_approval_flow === option.value ? "bg-white text-brand-text shadow-sm" : "text-slate-400 hover:bg-white/70 hover:text-slate-700"}`}
              >
                <span className="block text-xs font-bold">{option.label}</span>
                <span className={`mt-1 block text-[10px] font-medium leading-4 ${values.default_approval_flow === option.value ? "text-slate-500" : "text-slate-400"}`}>
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border p-5 ${sequential ? "border-pink-200 bg-pink-50/40" : "border-slate-200 bg-white"}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Approval chain
              </h4>
              {sequential && (
                <span className="rounded-full bg-pink-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-text">
                  Ordered
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {sequential
                ? "Select reviewers and arrange the order they must approve in."
                : "Select the people who can review new documents."}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
            {selected.length} selected
          </span>
        </div>
        {sequential && selected.length === 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Sequential review needs at least one approver.
          </div>
        )}

        {sequential && selectedPeople.length > 0 && (
          <div className="mt-5 rounded-xl border border-pink-100 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Review order
            </p>
            <div className="space-y-2">
              {selectedPeople.map((person: any, index: number) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-text text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-700">
                      {person.name}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {person.email || "Workspace user"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => moveApprover(Number(person.id), -1)}
                    disabled={index === 0}
                    className="!rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand-text disabled:opacity-30"
                    aria-label={`Move ${person.name} up`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveApprover(Number(person.id), 1)}
                    disabled={index === selectedPeople.length - 1}
                    className="!rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand-text disabled:opacity-30"
                    aria-label={`Move ${person.name} down`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleApprover(Number(person.id))}
                    className="!rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600"
                    aria-label={`Remove ${person.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="relative mt-5 block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={approverSearch}
            onChange={(event) => setApproverSearch(event.target.value)}
            placeholder="Search employees or approvers"
            className="field bg-white pl-10"
          />
        </label>
        {approvers.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500">
            No approvers match your search.
          </p>
        ) : (
          <div className="mt-3 grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
            {approvers.map((item: any) => {
              const checked = selected.includes(Number(item.id));
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 !rounded-xl border p-3 transition ${checked ? "border-brand-pink bg-white shadow-sm" : "border-slate-200 bg-white hover:border-pink-200"}`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? "border-brand-pink bg-brand-pink text-white" : "border-slate-300 bg-white"}`}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleApprover(Number(item.id))}
                    className="sr-only"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-700">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {item.email || "Workspace user"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
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

function TypeModal({ form, setForm, submit, saving }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <form
        onSubmit={submit}
        className="w-full max-w-xl rounded-[24px] border border-white/70 bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-slate-900">
              {form.id ? "Edit document type" : "Add document type"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Give uploads a clear, consistent classification.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm(null)}
            className="!rounded-lg p-2 text-brand-text/50 hover:bg-pink-50 hover:text-brand-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
    </div>
  );
}
