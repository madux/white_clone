"use client";

import { ArrowDown, ArrowUp, Check, CircleHelp } from "lucide-react";
import { FormEvent, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";

export const DOCUMENT_TYPE_CATEGORIES = [
  ["hr", "Human Resources"],
  ["finance", "Finance"],
  ["legal", "Legal"],
  ["identity", "Identity"],
  ["employment", "Employment"],
  ["medical", "Medical"],
  ["training", "Training"],
  ["other", "Other"],
] as const;

export type DocumentTypeFormValues = {
  id?: number;
  name: string;
  category: string;
  description: string;
  is_mandatory_default: boolean;
  expiry_applicable: boolean;
  require_upload_approval: boolean;
  require_issue_date: boolean;
  require_description: boolean;
  enable_versioning: boolean;
  duplicate_detection_mode: string;
  approval_flow: string;
  approver_ids: number[];
  default_retention_years: number;
};

type Approver = { id: number; name: string; email?: string };

const RETENTION_YEARS = [1, 3, 5, 7, 10] as const;

function retentionYearOptions(current: number) {
  const years = RETENTION_YEARS.includes(
    current as (typeof RETENTION_YEARS)[number],
  )
    ? [...RETENTION_YEARS]
    : [...RETENTION_YEARS, current].sort((a, b) => a - b);
  return years.map((value) => ({
    value: String(value),
    label: value === 1 ? "1 year" : `${value} years`,
  }));
}

const emptyForm = (): DocumentTypeFormValues => ({
  name: "",
  category: "other",
  description: "",
  is_mandatory_default: false,
  expiry_applicable: false,
  require_upload_approval: false,
  require_issue_date: false,
  require_description: false,
  enable_versioning: true,
  duplicate_detection_mode: "inherit",
  approval_flow: "any",
  approver_ids: [],
  default_retention_years: 7,
});

export function emptyDocumentTypeForm(
  item?: Record<string, any> | null,
): DocumentTypeFormValues {
  const base = emptyForm();
  if (!item) return base;
  return {
    ...base,
    ...item,
    approver_ids:
      item.approver_ids ??
      (item.approvers ?? []).map((approver: { id: number }) => approver.id),
  };
}

function FieldHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border border-[var(--rule)] text-slate-400 hover:border-brand-pink hover:text-brand-text"
        aria-label={`About ${label}`}
      >
        <CircleHelp className="size-3" />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="z-[120] max-w-[280px] flex-col items-start text-left leading-4"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-brand-pink" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function RuleToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <Switch checked={checked} onChange={() => onChange(!checked)} label={title} />
    </div>
  );
}

function TypeApprovalEditor({
  form,
  setForm,
  allApprovers,
}: {
  form: DocumentTypeFormValues;
  setForm: (next: DocumentTypeFormValues) => void;
  allApprovers: Approver[];
}) {
  const selectedIds = form.approver_ids ?? [];
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
    .map((id) => allApprovers.find((item) => Number(item.id) === id))
    .filter(Boolean) as Approver[];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-sm font-semibold text-slate-800">Who needs to approve</p>
      <div className="grid gap-1 rounded-lg bg-white p-1 sm:grid-cols-3">
        {[
          {
            value: "any",
            label: "Anyone",
            description: "One selected reviewer is enough.",
          },
          {
            value: "sequential",
            label: "In order",
            description: "They approve in the order you set.",
          },
          {
            value: "random",
            label: "Everyone",
            description: "All selected reviewers must approve.",
          },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setForm({ ...form, approval_flow: option.value })}
            aria-pressed={form.approval_flow === option.value}
            className={`rounded-md px-3 py-2 text-left transition ${
              form.approval_flow === option.value
                ? "bg-pink-50 text-brand-text shadow-sm ring-1 ring-pink-100"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <span className="block text-xs font-semibold">{option.label}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
              {option.description}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5">
          {allApprovers.length ? (
            allApprovers.map((person) => {
              const active = selectedIds.includes(Number(person.id));
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggleApprover(Number(person.id))}
                  className={`mb-0.5 flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm ${
                    active
                      ? "bg-pink-50 font-semibold text-brand-text"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{person.name}</span>
                  {active ? <Check className="size-4" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-3 text-xs text-slate-400">
              Approvers could not be loaded.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">Selected</p>
          {selectedPeople.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {selectedPeople.map((person) => (
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
                        className="rounded-md p-1 hover:bg-slate-100"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={() => moveApprover(Number(person.id), 1)}
                        className="rounded-md p-1 hover:bg-slate-100"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Choose at least one reviewer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentTypeFormDialog({
  form,
  setForm,
  onClose,
  onSubmit,
  saving,
  allApprovers = [],
  error,
  zIndex,
  submitLabel,
}: {
  form: DocumentTypeFormValues;
  setForm: (next: DocumentTypeFormValues) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  saving?: boolean;
  allApprovers?: Approver[];
  error?: string;
  zIndex?: number;
  submitLabel?: string;
}) {
  const isEdit = Boolean(form.id);

  return (
    <ModalDialog
      title={isEdit ? "Edit document type" : "Add document type"}
      description="Name the type, then set how uploads of this kind should behave."
      onClose={onClose}
      size="lg"
      zIndex={zIndex}
      backdropClassName="bg-slate-950/35"
      titleClassName="text-xl"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Name</span>
            <input
              required
              autoFocus
              className="field"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Employment contract"
            />
          </label>
          <label>
            <span className="label">Category</span>
            <ThemedSelect
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
              options={DOCUMENT_TYPE_CATEGORIES.map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Description</span>
            <textarea
              rows={2}
              className="field min-h-[4.5rem]"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="When should people use this type?"
            />
          </label>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="label mb-0">Keep for</span>
              <FieldHelp label="Keep for">
                How many years files of this type should be kept. This is the
                default retention for new uploads.
              </FieldHelp>
            </div>
            <ThemedSelect
              value={String(form.default_retention_years ?? 7)}
              onChange={(value) =>
                setForm({
                  ...form,
                  default_retention_years: Number(value),
                })
              }
              options={retentionYearOptions(form.default_retention_years ?? 7)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="label mb-0">If a file already exists</span>
              <FieldHelp label="If a file already exists">
                <span className="flex flex-col gap-1">
                  <span>
                    What happens when someone uploads another file of this type
                    for the same person.
                  </span>
                  <span>
                    Use company default — follow the workspace setting.
                  </span>
                  <span>Warn, then allow — show a warning, then continue.</span>
                  <span>Block duplicates — stop the upload.</span>
                  <span>
                    Ask for confirmation — the uploader must confirm a second
                    copy.
                  </span>
                </span>
              </FieldHelp>
            </div>
            <ThemedSelect
              value={String(form.duplicate_detection_mode || "inherit")}
              onChange={(value) =>
                setForm({ ...form, duplicate_detection_mode: value })
              }
              options={[
                { value: "inherit", label: "Use company default" },
                { value: "warn", label: "Warn, then allow" },
                { value: "prevent", label: "Block duplicates" },
                { value: "allow_confirm", label: "Ask for confirmation" },
              ]}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Rules</p>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <RuleToggle
              title="Required by default"
              description="Employees are expected to have this on file."
              checked={Boolean(form.is_mandatory_default)}
              onChange={(next) =>
                setForm({ ...form, is_mandatory_default: next })
              }
            />
            <RuleToggle
              title="Has an expiry date"
              description="Uploads need an expiry date, such as passports or certificates."
              checked={Boolean(form.expiry_applicable)}
              onChange={(next) =>
                setForm({ ...form, expiry_applicable: next })
              }
            />
            <RuleToggle
              title="Keep versions"
              description="Updating replaces the current file and stores the previous one."
              checked={Boolean(form.enable_versioning ?? true)}
              onChange={(next) =>
                setForm({ ...form, enable_versioning: next })
              }
            />
            <RuleToggle
              title="Issue date required"
              description="Ask for the date the document was issued."
              checked={Boolean(form.require_issue_date)}
              onChange={(next) =>
                setForm({ ...form, require_issue_date: next })
              }
            />
            <RuleToggle
              title="Description required"
              description="Ask for a short note on every upload."
              checked={Boolean(form.require_description)}
              onChange={(next) =>
                setForm({ ...form, require_description: next })
              }
            />
            <RuleToggle
              title="Requires Approval"
              description="Hold new files until a reviewer approves them."
              checked={Boolean(form.require_upload_approval)}
              onChange={(next) =>
                setForm({ ...form, require_upload_approval: next })
              }
            />
          </div>
        </div>

        {form.require_upload_approval ? (
          <TypeApprovalEditor
            form={form}
            setForm={setForm}
            allApprovers={allApprovers}
          />
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="app-btn app-btn-primary"
          >
            {saving
              ? "Saving…"
              : submitLabel || (isEdit ? "Save type" : "Add type")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
