"use client";

import { Eye, FileText, Pencil, Play, Power, PowerOff, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import ComplianceRequestScheduleFields from "./ComplianceRequestScheduleFields";
import ComplianceRequestTaskList from "./ComplianceRequestTaskList";
import {
  useDeletePolicy,
  useDocumentTypes,
  useDocuments,
  useEvaluatePolicy,
  usePolicies,
  useUpdatePolicy,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { canImportDocumentAsPolicy } from "../../../lib/policyDocumentName";
import { useAppDialog } from "../../../hooks/useAppDialog";
import ModalDialog from "./ModalDialog";
import ComplianceRuleSourceUploadModal from "./ComplianceRuleSourceUploadModal";
import ComplianceDocumentTypeMultiSelect from "./ComplianceDocumentTypeMultiSelect";
import ThemedSelect from "./ThemedSelect";
import { AlertCadenceSelector } from "./CompliancePage";
import { PolicyAudienceFilters } from "./PolicyAudienceFilters";
import {
  buildScopePayload,
  emptyPolicyScope,
  formatPolicyScopeSummary,
  policyScopeFromApi,
} from "../../../lib/policyScope";
import { formatFieldLabel } from "../../../lib/formatLabel";
import {
  AUDIT_FREQUENCY_LABELS,
  EVENT_TRIGGER_LABELS,
  eventTriggerLabel,
} from "../../../lib/complianceCopy";
import {
  documentTypesForCompliancePolicy,
  pruneDocumentTypeIdsForPolicy,
} from "../../../lib/complianceDocumentTypes";
import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import type { DocumentType } from "../../../lib/types";
import ComplianceRetentionFields from "./ComplianceRetentionFields";
import ComplianceReviewScheduleFields from "./ComplianceReviewScheduleFields";
import ComplianceVerificationFields from "./ComplianceVerificationFields";
import {
  REVIEW_COMPLETION_LABELS,
  REVIEW_REVIEWER_LABELS,
  REVIEW_TRIGGER_LABELS,
} from "../../../lib/reviewSchedule";
import Link from "next/link";

const RETENTION_MODE_LABELS: Record<string, string> = {
  report_only: "Report only",
  owner_approval: "Owner approval",
  automatic: "Automatic",
};

const schedules = [
  "one_time",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
  "custom",
];

export default function ComplianceRuleActions({
  policy,
  documents,
  types,
  targets,
  openView = false,
  onViewClose,
}: {
  policy: any;
  documents: { id: number; name: string }[];
  types: any[];
  targets: any;
  openView?: boolean;
  onViewClose?: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkDocumentId, setLinkDocumentId] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const orgDocuments = useDocuments(undefined, false, linkOpen);
  const documentTypes = useDocumentTypes();
  const policies = usePolicies();
  const { showAlert, showConfirm } = useAppDialog();
  const [form, setForm] = useState({
    name: policy.name,
    description: policy.description || "",
    policy_type_id: String(policy.policy_type_id || ""),
    document_type_ids: policy.document_type_ids ?? [],
    applies_to:
      policy.applies_to === "filtered" || policy.applies_to === "all"
        ? policy.applies_to
        : "filtered",
    scope: policyScopeFromApi(policy),
    schedule: policy.schedule === "manual" ? "" : policy.schedule,
    custom_schedule_days: String(policy.custom_schedule_days ?? 30),
    minimum_documents: String(policy.minimum_documents ?? 1),
    grace_period_days: String(policy.grace_period_days ?? 0),
    effective_date: policy.effective_date || "",
    active: policy.active,
    // Type-specific parameters
    allow_waiver: policy.allow_waiver ?? true,
    alert_schedule_days: policy.alert_schedule_days || "60,30,15,7,0",
    escalate_manager_days: 0,
    escalate_hr_days: policy.escalate_hr_days ?? 7,
    auto_request_renewal: policy.auto_request_renewal ?? true,
    event_trigger: policy.event_trigger || "onboarding",
    due_days: policy.due_days ?? 14,
    reminder_frequency_days: policy.reminder_frequency_days ?? 3,
    assigned_reviewer_id: String(policy.assigned_reviewer_id || ""),
    audit_frequency: policy.audit_frequency || "quarterly",
    sample_pct: policy.sample_pct ?? 100,
    assigned_auditor_id: String(policy.assigned_auditor_id || ""),
    request_trigger: policy.request_trigger || "policy_effective",
    request_start_date: policy.request_start_date || "",
    repeat_every_months: policy.repeat_every_months ?? 0,
    tasks_needed_mode: policy.tasks_needed_mode || "all_required",
    tasks_needed_minimum: policy.tasks_needed_minimum ?? 1,
    reopen_on_content_change: policy.reopen_on_content_change !== false,
    request_tasks: policy.request_tasks ?? [],
    retention_action_mode: policy.retention_action_mode || "report_only",
    retention_owner_notice_days: policy.retention_owner_notice_days ?? 14,
    review_trigger: policy.review_trigger || "employee_start",
    review_start_date: policy.review_start_date || "",
    review_reviewer_mode: policy.review_reviewer_mode || "line_manager",
    review_completion_mode: policy.review_completion_mode || "all_scheduled",
    review_completion_minimum: policy.review_completion_minimum ?? 1,
    review_overdue_mode: policy.review_overdue_mode || "after_grace",
    review_milestones: policy.review_milestones ?? [],
    verified_by: policy.verified_by || "hr_admin",
    verification_sla_days: policy.verification_sla_days ?? 3,
  });
  const [retentionBatches, setRetentionBatches] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");
  const update = useUpdatePolicy();
  const remove = useDeletePolicy();
  const evaluate = useEvaluatePolicy();
  useEffect(() => {
    if (openView) setMode("view");
  }, [openView]);

  useEffect(() => {
    if (mode !== "view" || policy.policy_type_code !== "retention") {
      setRetentionBatches([]);
      return;
    }
    void api.listRetentionBatches(policy.id).then((result) => {
      if (result.success) setRetentionBatches(result.data || []);
    });
  }, [mode, policy.id, policy.policy_type_code]);
  const closeMode = () => {
    setMode(null);
    if (mode === "view") onViewClose?.();
  };
  const requiredDocuments = (policy.document_type_ids ?? [])
    .map((id: number) => documents.find((document) => document.id === id)?.name)
    .filter(Boolean);
  const selectedType = (types || []).find(
    (t: any) => String(t.id) === String(form.policy_type_id),
  );
  const typeCode = selectedType?.code || policy.policy_type_code || "";
  const allDocumentTypes = (documentTypes.data ??
    documents) as DocumentType[];
  const selectableDocumentTypes = useMemo(
    () => documentTypesForCompliancePolicy(typeCode, allDocumentTypes),
    [typeCode, allDocumentTypes],
  );

  useEffect(() => {
    if (mode !== "edit") return;
    if (typeCode !== "compliance_request" && typeCode !== "review_schedule") return;
    void api.listActiveTemplatesForms({ kind: "form" }).then((result) => {
      const templates = result.data?.templates ?? [];
      setFormTemplates(
        templates.map((item) => ({
          id: Number(item.id),
          name: String(item.name || "Form"),
        })),
      );
    });
  }, [mode, typeCode]);

  const toggleDocumentType = (id: number) =>
    setForm({
      ...form,
      document_type_ids: form.document_type_ids.includes(id)
        ? form.document_type_ids.filter((item: number) => item !== id)
        : [...form.document_type_ids, id],
    });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.policy_type_id) return setError("Please select a rule type.");
    if (
      typeCode !== "compliance_request" &&
      typeCode !== "review_schedule" &&
      !form.document_type_ids.length
    )
      return setError("Select at least one required document type.");
    setError("");
    const scopePayload =
      form.applies_to === "all"
        ? buildScopePayload(emptyPolicyScope())
        : buildScopePayload(form.scope);
    try {
      await update.mutateAsync({
        id: policy.id,
        name: form.name.trim(),
        description: form.description.trim(),
        policy_type_id: Number(form.policy_type_id),
        document_type_ids: form.document_type_ids,
        applies_to: form.applies_to === "all" ? "all" : scopePayload.applies_to,
        department_ids: scopePayload.department_ids,
        grade_ids: scopePayload.grade_ids,
        employee_ids: scopePayload.employee_ids,
        work_location_ids: scopePayload.work_location_ids,
        employment_type_ids: scopePayload.employment_type_ids,
        branch_ids: scopePayload.branch_ids,
        schedule: form.schedule || false,
        custom_schedule_days: Number(form.custom_schedule_days),
        minimum_documents: Number(form.minimum_documents),
        grace_period_days: Number(form.grace_period_days),
        effective_date: form.effective_date,
        active: form.active,
        allow_waiver: form.allow_waiver,
        alert_schedule_days: form.alert_schedule_days,
        escalate_manager_days: 0,
        escalate_hr_days: Number(form.escalate_hr_days),
        auto_request_renewal: form.auto_request_renewal,
        event_trigger: form.event_trigger,
        due_days: Number(form.due_days),
        reminder_frequency_days: Number(form.reminder_frequency_days),
        assigned_reviewer_id: form.assigned_reviewer_id
          ? Number(form.assigned_reviewer_id)
          : false,
        audit_frequency: form.audit_frequency,
        sample_pct: Number(form.sample_pct),
        assigned_auditor_id: form.assigned_auditor_id
          ? Number(form.assigned_auditor_id)
          : false,
        request_trigger: form.request_trigger,
        request_start_date: form.request_start_date || false,
        repeat_every_months: form.repeat_every_months,
        tasks_needed_mode: form.tasks_needed_mode,
        tasks_needed_minimum: form.tasks_needed_minimum,
        reopen_on_content_change: form.reopen_on_content_change,
        request_tasks: form.request_tasks,
        retention_action_mode: form.retention_action_mode,
        retention_owner_notice_days: form.retention_owner_notice_days,
        review_trigger: form.review_trigger,
        review_start_date: form.review_start_date || false,
        review_reviewer_mode: form.review_reviewer_mode,
        review_completion_mode: form.review_completion_mode,
        review_completion_minimum: form.review_completion_minimum,
        review_overdue_mode: form.review_overdue_mode,
        review_milestones: form.review_milestones,
        verified_by: form.verified_by,
        verification_sla_days: form.verification_sla_days,
      });
    } catch (error: any) {
      setError(error?.message || "Failed to save rule.");
      return;
    }
    setMode(null);
  };
  const run = async () => {
    const result = await evaluate.mutateAsync(policy.id);
    await showAlert(result.message || "Rule check completed.", {
      title: "Rule check",
    });
  };
  const toggleActive = async () => {
    const nextActive = !policy.active;
    if (
      policy.active &&
      !(await showConfirm(
        `Deactivate "${policy.name}"? It will stop running until you activate it again.`,
        { title: "Deactivate rule", confirmLabel: "Deactivate" },
      ))
    ) {
      return;
    }
    try {
      await update.mutateAsync({
        id: policy.id,
        active: nextActive,
        lifecycle_status: "active",
      });
    } catch (error: any) {
      await showAlert(error?.message || "Unable to update this rule.", {
        title: nextActive ? "Activate rule" : "Deactivate rule",
      });
    }
  };
  const deletePolicy = async () => {
    if (
      await showConfirm(`Delete "${policy.name}"? This cannot be undone.`, {
        title: "Delete rule",
        confirmLabel: "Delete",
      })
    )
      await remove.mutateAsync(policy.id);
  };
  const canRun = Boolean(policy.active) && policy.lifecycle_status !== "archived";
  return (
    <>
      <div className="table-actions-group">
        <button
          type="button"
          onClick={() => setMode("view")}
          className="row-action"
          title="View rule"
          aria-label="View rule"
        >
          <Eye />
        </button>
        <button
          type="button"
          onClick={() => void toggleActive()}
          disabled={update.isPending}
          className="row-action"
          title={policy.active ? "Deactivate rule" : "Activate rule"}
          aria-label={policy.active ? "Deactivate rule" : "Activate rule"}
        >
          {policy.active ? <PowerOff /> : <Power />}
        </button>
        {canRun ? (
          <button
            type="button"
            onClick={run}
            disabled={evaluate.isPending}
            className="row-action"
            title="Run rule check"
            aria-label="Run rule check"
          >
            <Play />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMode("edit")}
          className="row-action"
          title="Edit rule"
          aria-label="Edit rule"
        >
          <Pencil />
        </button>
        <button
          type="button"
          onClick={deletePolicy}
          disabled={remove.isPending}
          className="row-action danger"
          title="Delete rule"
          aria-label="Delete rule"
        >
          <Trash2 />
        </button>
      </div>
      {mode && (
        <ModalDialog
          title={mode === "view" ? policy.name : "Edit rule"}
          eyebrow="Compliance rule"
          onClose={closeMode}
          size="3xl"
          backdropClassName="bg-slate-900/40"
          titleClassName="text-xl"
        >
            {mode === "view" ? (
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                {policy.lifecycle_status === "draft" ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Saved as Draft. Activate it from the table when it is ready.
                  </p>
                ) : null}
                <p>{policy.description || "No description provided."}</p>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Source document
                  </p>
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <p className="font-semibold text-slate-700">
                      {policy.source_document_id
                        ? policy.source_document_name ||
                          `Document #${policy.source_document_id}`
                        : "No file linked yet"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setUploadOpen(true)}
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setLinkOpen(true)}
                      >
                        {policy.source_document_id ? "Change link" : "Link file"}
                      </button>
                      {policy.source_document_id ? (
                        <button
                          type="button"
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:text-brand-pink"
                          onClick={() =>
                            void (async () => {
                              if (
                                !(await showConfirm(
                                  "Unlink this file from the rule?",
                                  { title: "Unlink source document" },
                                ))
                              ) {
                                return;
                              }
                              const result = await api.unlinkPolicyDocument(
                                policy.id,
                              );
                              if (!result.success) {
                                await showAlert(
                                  result.message || "Unable to unlink.",
                                  { title: "Unlink" },
                                );
                                return;
                              }
                              await policies.refetch();
                            })()
                          }
                        >
                          Unlink
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Required document types
                  </p>
                  <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {requiredDocuments.map((name: string, index: number) => (
                      <li
                        key={name}
                        className="flex items-center gap-3 bg-white px-3.5 py-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-50 text-xs font-bold text-brand-pink">
                          {index + 1}
                        </span>
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="font-semibold text-slate-700">
                          {name}
                        </span>
                        <span className="ml-auto text-xs text-slate-400">
                          {policy.minimum_documents} required
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Info
                    label="Status"
                    value={
                      policy.active
                        ? "Active"
                        : policy.lifecycle_status === "draft"
                          ? "Draft"
                          : "Inactive"
                    }
                  />
                  <Info label="Type" value={policy.policy_type} />
                  <Info
                    label="Scope"
                    value={
                      formatPolicyScopeSummary(
                        policyScopeFromApi(policy),
                        targets,
                      ).join("; ") || formatFieldLabel(policy.applies_to)
                    }
                  />
                  <Info
                    label="Schedule"
                    value={
                      policy.schedule === "manual"
                        ? "Manual only"
                        : formatFieldLabel(policy.schedule)
                    }
                  />
                  <Info
                    label="Grace period"
                    value={`${policy.grace_period_days} days`}
                  />
                  <Info
                    label="Last run"
                    value={formatDateTime(policy.last_run_at)}
                  />
                  <Info
                    label="Next run"
                    value={
                      policy.schedule === "manual"
                        ? "Manual only"
                        : formatDateTime(policy.next_run_at)
                    }
                  />
                  {policy.policy_type_code === "renewable_document" && (
                    <>
                      <Info
                        label="Reminder schedule"
                        value={`${policy.alert_schedule_days} days`}
                      />
                      <Info
                        label="Notify HR admin"
                        value={`${policy.escalate_hr_days} days before`}
                      />
                    </>
                  )}
                  {policy.policy_type_code === "compliance_request" && (
                    <>
                      <Info
                        label="Starts when"
                        value={eventTriggerLabel(policy.event_trigger, "—")}
                      />
                      <Info
                        label="Days to submit"
                        value={`${policy.due_days} days`}
                      />
                      <Info
                        label="HR contact"
                        value={policy.assigned_reviewer || "Unassigned"}
                      />
                    </>
                  )}
                  {policy.policy_type_code === "review_schedule" && (
                    <>
                      <Info
                        label="Starts when"
                        value={
                          REVIEW_TRIGGER_LABELS[policy.review_trigger] ||
                          policy.review_trigger
                        }
                      />
                      <Info
                        label="Reviewer"
                        value={
                          REVIEW_REVIEWER_LABELS[policy.review_reviewer_mode] ||
                          policy.review_reviewer_mode
                        }
                      />
                      <Info
                        label="Milestones"
                        value={`${(policy.review_milestones || []).length} configured`}
                      />
                      <Info
                        label="Reviews needed"
                        value={
                          REVIEW_COMPLETION_LABELS[policy.review_completion_mode] ||
                          policy.review_completion_mode
                        }
                      />
                    </>
                  )}
                  {policy.policy_type_code === "retention" && (
                    <>
                      <Info
                        label="Action mode"
                        value={
                          RETENTION_MODE_LABELS[policy.retention_action_mode] ||
                          policy.retention_action_mode
                        }
                      />
                      {policy.retention_action_mode === "owner_approval" ? (
                        <Info
                          label="Owner notice"
                          value={`${policy.retention_owner_notice_days || 0} days`}
                        />
                      ) : null}
                      <Info
                        label="Retention settings"
                        value={
                          <Link
                            href="/pages/settings?section=retention_compliance"
                            className="font-semibold text-brand-pink hover:underline"
                          >
                            Open Settings
                          </Link>
                        }
                      />
                    </>
                  )}
                </div>
                {policy.policy_type_code === "retention" &&
                retentionBatches.length ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-800">
                      Open retention approvals
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      {retentionBatches.map((batch) => (
                        <li
                          key={batch.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span>
                            {batch.action} due {batch.due_date} ·{" "}
                            {batch.item_count} file(s)
                          </span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand-pink"
                              onClick={() =>
                                void api
                                  .approveRetentionBatch(batch.id)
                                  .then(() =>
                                    api.listRetentionBatches(policy.id).then(
                                      (r) =>
                                        r.success &&
                                        setRetentionBatches(r.data || []),
                                    ),
                                  )
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-slate-500"
                              onClick={() =>
                                void api
                                  .rejectRetentionBatch(batch.id)
                                  .then(() =>
                                    api.listRetentionBatches(policy.id).then(
                                      (r) =>
                                        r.success &&
                                        setRetentionBatches(r.data || []),
                                    ),
                                  )
                              }
                            >
                              Reject
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("edit")}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:border-brand-pink hover:text-brand-pink"
                  >
                    Edit rule
                  </button>
                  <button
                    type="button"
                    onClick={closeMode}
                    className="rounded-xl bg-brand-pink px-4 py-2.5 font-semibold text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">Policy name</span>
                  <input
                    required
                    className="field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  <span className="label">Policy type</span>
                  <ThemedSelect
                    value={form.policy_type_id}
                    onChange={(value) => {
                      const nextTypeCode =
                        (types || []).find(
                          (item: any) => String(item.id) === value,
                        )?.code ?? "";
                      setForm({
                        ...form,
                        policy_type_id: value,
                        document_type_ids: pruneDocumentTypeIdsForPolicy(
                          nextTypeCode,
                          form.document_type_ids,
                          allDocumentTypes,
                        ),
                      });
                    }}
                    options={types.map((item: any) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                    placeholder="Select type"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="label">Description</span>
                  <textarea
                    className="field min-h-20"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>

                {typeCode === "document_requirement" && (
                  <>
                    <label>
                      <span className="label">Extra days to submit</span>
                      <input
                        type="number"
                        min="0"
                        className="field"
                        value={form.grace_period_days}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            grace_period_days: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-1 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.allow_waiver}
                        onChange={(e) =>
                          setForm({ ...form, allow_waiver: e.target.checked })
                        }
                        className="h-4 w-4 accent-pink-600 rounded"
                      />
                      Allow exceptions
                    </label>
                  </>
                )}

                {typeCode === "renewable_document" && (
                  <>
                    <AlertCadenceSelector
                      value={form.alert_schedule_days}
                      onChange={(val: string) =>
                        setForm({ ...form, alert_schedule_days: val })
                      }
                    />
                    <label>
                      <span className="label">Also notify HR</span>
                      <ThemedSelect
                        value={String(form.escalate_hr_days)}
                        onChange={(val) =>
                          setForm({ ...form, escalate_hr_days: Number(val) })
                        }
                        options={[
                          { value: "15", label: "15 days before expiry" },
                          { value: "7", label: "7 days before expiry" },
                          { value: "3", label: "3 days before expiry" },
                          { value: "1", label: "1 day before expiry" },
                          { value: "0", label: "On expiry day" },
                        ]}
                      />
                    </label>
                    <label>
                      <span className="label">Extra days after expiry</span>
                      <input
                        type="number"
                        min="0"
                        className="field"
                        value={form.grace_period_days}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            grace_period_days: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-1 text-sm text-slate-700 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={form.auto_request_renewal}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            auto_request_renewal: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-pink-600 rounded"
                      />
                      Create a renewal task for the employee
                    </label>
                  </>
                )}

                {typeCode === "compliance_request" && (
                  <>
                    <ComplianceRequestTaskList
                      tasks={form.request_tasks}
                      onChange={(request_tasks) =>
                        setForm({ ...form, request_tasks })
                      }
                      documentTypes={allDocumentTypes}
                      linkableContext={{
                        policyId: policy.id,
                        applies_to: form.applies_to,
                        scope: form.scope,
                      }}
                      forms={formTemplates}
                    />
                    <ComplianceRequestScheduleFields
                      schedule={{
                        request_trigger: form.request_trigger,
                        request_start_date: form.request_start_date,
                        repeat_every_months: form.repeat_every_months,
                        tasks_needed_mode: form.tasks_needed_mode,
                        tasks_needed_minimum: form.tasks_needed_minimum,
                        reopen_on_content_change: form.reopen_on_content_change,
                      }}
                      onChange={(schedule) => setForm({ ...form, ...schedule })}
                      dueDays={form.due_days}
                      gracePeriodDays={form.grace_period_days}
                      reminderDays={form.reminder_frequency_days}
                      onDueDaysChange={(due_days) =>
                        setForm({ ...form, due_days })
                      }
                      onGraceChange={(grace_period_days) =>
                        setForm({ ...form, grace_period_days })
                      }
                      onReminderChange={(reminder_frequency_days) =>
                        setForm({ ...form, reminder_frequency_days })
                      }
                    />
                    <label className="sm:col-span-2">
                      <span className="label">Who follows up?</span>
                      <ThemedSelect
                        value={String(form.assigned_reviewer_id || "")}
                        onChange={(val) =>
                          setForm({ ...form, assigned_reviewer_id: val })
                        }
                        placeholder="Select HR contact"
                        options={(targets?.users || []).map((u: any) => ({
                          value: String(u.id),
                          label: u.name,
                        }))}
                      />
                    </label>
                  </>
                )}

                {typeCode === "retention" ? (
                  <ComplianceRetentionFields form={form as any} setForm={setForm as any} />
                ) : null}

                {typeCode !== "review_schedule" ? (
                  <ComplianceVerificationFields
                    form={form as PolicyCreateFormState}
                    setForm={setForm as (next: PolicyCreateFormState) => void}
                    typeCode={typeCode}
                    documentTypes={allDocumentTypes}
                  />
                ) : null}

                {typeCode === "review_schedule" ? (
                  <ComplianceReviewScheduleFields
                    form={form as any}
                    setForm={setForm as any}
                    forms={formTemplates}
                    targets={targets}
                  />
                ) : null}

                {typeCode !== "compliance_request" && typeCode !== "review_schedule" ? (
                  <div className="sm:col-span-2">
                    <span className="label">Required documents</span>
                    <ComplianceDocumentTypeMultiSelect
                      types={selectableDocumentTypes}
                      selected={form.document_type_ids}
                      expiryTypesOnly={typeCode === "renewable_document"}
                      onChange={(document_type_ids) =>
                        setForm({ ...form, document_type_ids })
                      }
                      error={
                        error === "Select at least one required document type."
                          ? error
                          : undefined
                      }
                    />
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <span className="label">Applies to</span>
                  <PolicyAudienceFilters
                    scope={form.scope}
                    targets={targets}
                    allEmployees={form.applies_to === "all"}
                    onAllEmployeesChange={(all) =>
                      setForm({
                        ...form,
                        applies_to: all ? "all" : "filtered",
                        scope: all ? emptyPolicyScope() : form.scope,
                      })
                    }
                    onChange={(scope) =>
                      setForm({
                        ...form,
                        applies_to: "filtered",
                        scope,
                      })
                    }
                  />
                </div>
                <label>
                  <span className="label">Schedule</span>
                  <ThemedSelect
                    value={form.schedule}
                    onChange={(value) => setForm({ ...form, schedule: value })}
                    options={[
                      { value: "", label: "Manual" },
                      ...schedules.map((item) => ({
                        value: item,
                        label: formatFieldLabel(item),
                      })),
                    ]}
                  />
                </label>
                <label>
                  <span className="label">Effective date</span>
                  <input
                    required
                    type="date"
                    className="field"
                    value={form.effective_date}
                    onChange={(e) =>
                      setForm({ ...form, effective_date: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="label">Minimum documents</span>
                  <input
                    required
                    min="1"
                    type="number"
                    className="field"
                    value={form.minimum_documents}
                    onChange={(e) =>
                      setForm({ ...form, minimum_documents: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="label">Grace period (days)</span>
                  <input
                    required
                    min="0"
                    type="number"
                    className="field"
                    value={form.grace_period_days}
                    onChange={(e) =>
                      setForm({ ...form, grace_period_days: e.target.value })
                    }
                  />
                </label>
                {form.schedule === "custom" && (
                  <label>
                    <span className="label">Custom interval (days)</span>
                    <input
                      required
                      min="1"
                      type="number"
                      className="field"
                      value={form.custom_schedule_days}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          custom_schedule_days: e.target.value,
                        })
                      }
                    />
                  </label>
                )}
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                    className="h-4 w-4 accent-pink-600"
                  />{" "}
                  Active policy
                </label>
                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={update.isPending}
                    className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
                  >
                    {update.isPending ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}
        </ModalDialog>
      )}
      {uploadOpen ? (
        <ComplianceRuleSourceUploadModal
          policyId={policy.id}
          defaultFolderId={policy.source_folder_id || undefined}
          documentTypes={documentTypes.data ?? []}
          replaceExisting={Boolean(policy.source_document_id)}
          onClose={() => setUploadOpen(false)}
          onLinked={async () => {
            await policies.refetch();
            await showAlert("File uploaded and linked to this policy.", {
              title: "Source document",
            });
          }}
        />
      ) : null}
      {linkOpen ? (
        <ModalDialog
          title="Link organizational file"
          eyebrow="Source document"
          onClose={() => {
            setLinkOpen(false);
            setLinkDocumentId("");
          }}
          size="md"
          zIndex={120}
        >
          <ThemedSelect
            value={linkDocumentId}
            onChange={setLinkDocumentId}
            placeholder="Select a file"
            options={(orgDocuments.data ?? [])
              .filter(
                (item) =>
                  canImportDocumentAsPolicy(item) ||
                  item.id === policy.source_document_id,
              )
              .map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setLinkOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!linkDocumentId || linkPending}
              onClick={() =>
                void (async () => {
                  setLinkPending(true);
                  try {
                    const result = await api.linkPolicyDocument(
                      policy.id,
                      Number(linkDocumentId),
                    );
                    if (!result.success) {
                      await showAlert(
                        result.message || "Unable to link file.",
                        { title: "Link file" },
                      );
                      return;
                    }
                    await policies.refetch();
                    setLinkOpen(false);
                    setLinkDocumentId("");
                  } finally {
                    setLinkPending(false);
                  }
                })()
              }
            >
              {linkPending ? "Linking…" : "Link"}
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="rounded-xl bg-slate-50 p-3">
      <span className="text-xs text-slate-400">{label}</span>
      <strong className="mt-1 block text-slate-900">{value}</strong>
    </span>
  );
}
function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(
    new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")),
  );
}
