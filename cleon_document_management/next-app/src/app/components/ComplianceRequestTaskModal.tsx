"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import { api } from "../../../lib/api";
import { buildScopePayload } from "../../../lib/policyScope";
import {
  emptyRequestTask,
  TASK_TYPE_LABELS,
  validateRequestTask,
  type ComplianceLinkableContext,
  type ComplianceLinkableContentItem,
  type ComplianceRequestTaskDefinition,
  type ComplianceRequestTaskType,
} from "../../../lib/complianceRequestTasks";
import type { DocumentType } from "../../../lib/types";

function linkableContentValue(task: ComplianceRequestTaskDefinition): string {
  if (task.linked_org_policy_id) {
    return `org_policy:${task.linked_org_policy_id}`;
  }
  if (task.linked_document_id) {
    return `document:${task.linked_document_id}`;
  }
  return "";
}

function linkableContentLabel(task: ComplianceRequestTaskDefinition): string {
  if (task.linked_org_policy_name) return task.linked_org_policy_name;
  if (task.linked_document_name) return task.linked_document_name;
  return "";
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
  onSave: (task: ComplianceRequestTaskDefinition) => void;
}) {
  const [form, setForm] = useState<ComplianceRequestTaskDefinition>(emptyRequestTask());
  const [error, setError] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [contentOptions, setContentOptions] = useState<ComplianceLinkableContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : emptyRequestTask());
      setError("");
      setContentSearch(linkableContentLabel(initial ?? emptyRequestTask()));
    }
  }, [open, initial]);

  const scopePayload = useMemo(
    () => buildScopePayload(linkableContext.scope),
    [linkableContext.scope],
  );

  useEffect(() => {
    if (!open) return;
    if (form.task_type !== "read" && form.task_type !== "acknowledge") return;
    const timer = window.setTimeout(() => {
      setContentLoading(true);
      void api
        .listComplianceRequestLinkableContent({
          search: contentSearch,
          policy_id: linkableContext.policyId,
          applies_to: scopePayload.applies_to,
          department_ids: scopePayload.department_ids,
          grade_ids: scopePayload.grade_ids,
          employee_ids: scopePayload.employee_ids,
          work_location_ids: scopePayload.work_location_ids,
          employment_type_ids: scopePayload.employment_type_ids,
          branch_ids: scopePayload.branch_ids,
        })
        .then((result) => {
          if (result.success && result.data?.items) {
            setContentOptions(result.data.items);
          } else {
            setContentOptions([]);
          }
        })
        .finally(() => setContentLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    open,
    form.task_type,
    contentSearch,
    linkableContext.policyId,
    scopePayload,
  ]);

  const contentSelectOptions = useMemo(() => {
    const fromApi = contentOptions.map((item) => ({
      value: `${item.kind}:${item.id}`,
      label:
        item.kind === "org_policy"
          ? `${item.name} (policy)`
          : `${item.name} · ${item.folder_name}`,
    }));
    const current = linkableContentValue(form);
    if (current && !fromApi.some((option) => option.value === current)) {
      const label = linkableContentLabel(form);
      if (label) {
        fromApi.unshift({ value: current, label });
      }
    }
    return fromApi;
  }, [contentOptions, form]);

  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = validateRequestTask(form);
    if (message) {
      setError(message);
      return;
    }
    onSave(form);
    onClose();
  };

  const applyLinkableContent = (value: string) => {
    if (!value) {
      setForm({
        ...form,
        linked_org_policy_id: undefined,
        linked_org_policy_name: undefined,
        linked_document_id: undefined,
        linked_document_name: undefined,
      });
      return;
    }
    const item = contentOptions.find((row) => `${row.kind}:${row.id}` === value);
    if (!item) {
      return;
    }
    if (item.kind === "org_policy") {
      setForm({
        ...form,
        linked_org_policy_id: item.id,
        linked_org_policy_name: item.name,
        linked_document_id: undefined,
        linked_document_name: undefined,
      });
      setContentSearch(item.name);
      return;
    }
    setForm({
      ...form,
      linked_document_id: item.id,
      linked_document_name: item.name,
      linked_org_policy_id: undefined,
      linked_org_policy_name: undefined,
    });
    setContentSearch(item.name);
  };

  return (
    <ModalDialog title="Compliance task" eyebrow="Request task" onClose={onClose} size="lg">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">Task name</span>
          <input
            required
            className="field"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
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
        {form.task_type === "read" || form.task_type === "acknowledge" ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="label">Organizational content</span>
            <input
              className="field mb-2"
              value={contentSearch}
              onChange={(event) => setContentSearch(event.target.value)}
              placeholder="Search org policies and files in scope…"
            />
            <ThemedSelect
              value={linkableContentValue(form)}
              onChange={applyLinkableContent}
              placeholder={contentLoading ? "Loading…" : "Select content"}
              options={contentSelectOptions}
            />
            <p className="mt-1 text-xs text-slate-500">
              Only active, non-private org content that already covers your Applies to
              audience is listed.
            </p>
          </label>
        ) : null}
        {error ? (
          <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
        ) : null}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">Save task</button>
        </div>
      </form>
    </ModalDialog>
  );
}
