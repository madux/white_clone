"use client";

import { useMemo, useState } from "react";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import ComplianceContentTreePicker from "./ComplianceContentTreePicker";
import { buildScopePayload } from "../../../lib/policyScope";
import {
  applySelectionToTask,
  emptyRequestTask,
  selectionFromTask,
  TASK_TYPE_LABELS,
  validateRequestTask,
  type ComplianceContentSelection,
  type ComplianceLinkableContext,
  type ComplianceRequestTaskDefinition,
  type ComplianceRequestTaskType,
} from "../../../lib/complianceRequestTasks";
import type { DocumentType } from "../../../lib/types";

function isContentTask(type: ComplianceRequestTaskType) {
  return type === "read" || type === "acknowledge";
}

export default function ComplianceRequestTaskModal({
  open,
  initial,
  documentTypes,
  linkableContext,
  forms,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: ComplianceRequestTaskDefinition | null;
  documentTypes: DocumentType[];
  linkableContext: ComplianceLinkableContext;
  forms: { id: number; name: string }[];
  onClose: () => void;
  onSave: (tasks: ComplianceRequestTaskDefinition[]) => void;
}) {
  const [form, setForm] = useState<ComplianceRequestTaskDefinition>(() =>
    initial ? { ...initial } : emptyRequestTask(),
  );
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<ComplianceContentSelection[]>(() => {
    const picked = initial ? selectionFromTask(initial) : null;
    return picked ? [picked] : [];
  });
  const editing = Boolean(initial);

  const scopePayload = useMemo(
    () => buildScopePayload(linkableContext.scope, linkableContext.applies_to),
    [linkableContext.scope, linkableContext.applies_to],
  );

  if (!open) return null;

  const contentTask = isContentTask(form.task_type);
  const bulk = contentTask && !editing && selection.length > 1;

  const contentTaskName = (item: ComplianceContentSelection) => {
    const base = form.name.trim();
    if (bulk) {
      return base ? `${base}: ${item.name}` : `${TASK_TYPE_LABELS[form.task_type]}: ${item.name}`;
    }
    return base || `${TASK_TYPE_LABELS[form.task_type]}: ${item.name}`;
  };

  const submit = () => {
    if (!contentTask) {
      const message = validateRequestTask(form);
      if (message) {
        setError(message);
        return;
      }
      onSave([form]);
      onClose();
      return;
    }
    if (!selection.length) {
      setError("Select at least one file or folder to link.");
      return;
    }
    const items = editing ? selection.slice(0, 1) : selection;
    const tasks = items.map((item, index) => {
      const base: ComplianceRequestTaskDefinition =
        editing || index === 0 ? { ...form } : { ...form, id: undefined };
      return applySelectionToTask({ ...base, name: contentTaskName(item) }, item);
    });
    for (const task of tasks) {
      const message = validateRequestTask(task);
      if (message) {
        setError(message);
        return;
      }
    }
    onSave(tasks);
    onClose();
  };

  return (
    <ModalDialog title="Compliance task" eyebrow="Request task" onClose={onClose} size="lg">
      {/* Not a <form>: this modal renders inside the rule wizard's form, so Enter in an
          input must not implicitly submit that outer form. */}
      <div
        className="grid gap-3 sm:grid-cols-2"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
            event.preventDefault();
          }
        }}
      >
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">
            Task name
            {contentTask ? (
              <span className="ml-1 font-normal text-slate-400">(optional)</span>
            ) : null}
          </span>
          <input
            required={!contentTask}
            className="field"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder={
              contentTask
                ? `Defaults to “${TASK_TYPE_LABELS[form.task_type]}: <file name>”`
                : undefined
            }
          />
          {bulk ? (
            <span className="block text-xs text-slate-500">
              Each file becomes its own task
              {form.name.trim() ? ` named “${form.name.trim()}: <file name>”` : ""}.
            </span>
          ) : null}
        </label>
        <label className="block space-y-1">
          <span className="label">Task type</span>
          <ThemedSelect
            value={form.task_type}
            onChange={(value) =>
              setForm({ ...form, task_type: value as ComplianceRequestTaskType })
            }
            options={Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </label>
        <label className="block space-y-1">
          <span className="label">Requirement</span>
          <ThemedSelect
            value={form.requirement}
            onChange={(value) =>
              setForm({
                ...form,
                requirement: value as ComplianceRequestTaskDefinition["requirement"],
              })
            }
            options={[
              { value: "required", label: "Required" },
              { value: "optional", label: "Optional" },
            ]}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">Instructions</span>
          <textarea
            className="field min-h-20"
            value={form.instructions || ""}
            onChange={(event) => setForm({ ...form, instructions: event.target.value })}
          />
        </label>
        {form.task_type === "declaration" ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="label">Declaration statement</span>
            <textarea
              required
              className="field min-h-24"
              value={form.declaration_text || ""}
              onChange={(event) =>
                setForm({ ...form, declaration_text: event.target.value })
              }
            />
          </label>
        ) : null}
        {form.task_type === "upload_evidence" ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="label">Evidence document type</span>
            <ThemedSelect
              value={String(form.evidence_document_type_id || "")}
              onChange={(value) =>
                setForm({
                  ...form,
                  evidence_document_type_id: value ? Number(value) : undefined,
                })
              }
              placeholder="Select type"
              options={documentTypes.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
            />
          </label>
        ) : null}
        {form.task_type === "complete_form" ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="label">Form template</span>
            <ThemedSelect
              value={String(form.linked_form_id || "")}
              onChange={(value) =>
                setForm({
                  ...form,
                  linked_form_id: value ? Number(value) : undefined,
                })
              }
              placeholder="Select form"
              options={forms.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
            />
          </label>
        ) : null}
        {contentTask ? (
          <div className="space-y-1 sm:col-span-2">
            <span className="label">Organizational content</span>
            <p className="text-xs text-slate-500">
              {editing
                ? "Pick the file this task links to."
                : "Tick a folder to include every eligible file in it, or pick individual files."}{" "}
              Only active, non-private content that covers your Applies to audience can be
              selected.
            </p>
            <ComplianceContentTreePicker
              key={JSON.stringify(scopePayload)}
              scopePayload={scopePayload}
              policyId={linkableContext.policyId}
              multiple={!editing}
              selected={selection}
              onChange={(next) => {
                setSelection(next);
                setError("");
              }}
            />
            {bulk ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {selection.length} separate {TASK_TYPE_LABELS[form.task_type].toLowerCase()}{" "}
                tasks will be created. If Tasks needed is set to “At least one” or a
                minimum count, employees may finish the request without completing every
                file.
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
        ) : null}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={submit}>
            {bulk ? `Add ${selection.length} tasks` : "Save task"}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
