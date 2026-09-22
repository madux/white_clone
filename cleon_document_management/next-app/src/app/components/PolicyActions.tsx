"use client";

import { Eye, FileText, Pencil, Play, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  useDeletePolicy,
  useEvaluatePolicy,
  useUpdatePolicy,
} from "../../../hooks/useDocuments";
import ModalDialog from "./ModalDialog";
import PolicyTypeMultiSelect from "./PolicyTypeMultiSelect";
import ThemedSelect from "./ThemedSelect";
import { ScopeChecklist, AlertCadenceSelector } from "./CompliancePage";
import { formatFieldLabel } from "../../../lib/formatLabel";
import {
  AUDIT_FREQUENCY_LABELS,
  EVENT_TRIGGER_LABELS,
  eventTriggerLabel,
} from "../../../lib/complianceCopy";

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

export default function PolicyActions({
  policy,
  documents,
  types,
  targets,
}: {
  policy: any;
  documents: { id: number; name: string }[];
  types: any[];
  targets: any;
}) {
  const [mode, setMode] = useState<"view" | "edit" | null>(null);
  const [form, setForm] = useState({
    name: policy.name,
    description: policy.description || "",
    policy_type_id: String(policy.policy_type_id || ""),
    document_type_ids: policy.document_type_ids ?? [],
    applies_to: policy.applies_to || "all",
    scope_ids: policy[`${policy.applies_to}_ids`] ?? [],
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
  });
  const [error, setError] = useState("");
  const update = useUpdatePolicy();
  const remove = useDeletePolicy();
  const evaluate = useEvaluatePolicy();
  const requiredDocuments = (policy.document_type_ids ?? [])
    .map((id: number) => documents.find((document) => document.id === id)?.name)
    .filter(Boolean);
  const scopeOptions =
    form.applies_to === "department"
      ? (targets?.departments ?? [])
      : form.applies_to === "grade"
        ? (targets?.grades ?? [])
        : (targets?.employees ?? []);

  const selectedType = (types || []).find(
    (t: any) => String(t.id) === String(form.policy_type_id),
  );
  const typeCode = selectedType?.code || policy.policy_type_code || "";

  const toggle = (field: "document_type_ids" | "scope_ids", id: number) =>
    setForm({
      ...form,
      [field]: form[field].includes(id)
        ? form[field].filter((item: number) => item !== id)
        : [...form[field], id],
    });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.policy_type_id) return setError("Please select a policy type.");
    if (!form.document_type_ids.length)
      return setError("Select at least one required document type.");
    setError("");
    const effectiveAppliesTo =
      form.applies_to === "all" || form.scope_ids.length === 0
        ? "all"
        : form.applies_to;
    try {
      await update.mutateAsync({
        id: policy.id,
        name: form.name.trim(),
        description: form.description.trim(),
        policy_type_id: Number(form.policy_type_id),
        document_type_ids: form.document_type_ids,
        applies_to: effectiveAppliesTo,
        department_ids: effectiveAppliesTo === "department" ? form.scope_ids : [],
        grade_ids: effectiveAppliesTo === "grade" ? form.scope_ids : [],
        employee_ids: effectiveAppliesTo === "employee" ? form.scope_ids : [],
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
      });
    } catch (error: any) {
      setError(error?.message || "Failed to save policy.");
      return;
    }
    setMode(null);
  };
  const run = async () => {
    const result = await evaluate.mutateAsync(policy.id);
    window.alert(result.message || "Policy check completed.");
  };
  const deletePolicy = async () => {
    if (window.confirm(`Delete "${policy.name}"? This cannot be undone.`))
      await remove.mutateAsync(policy.id);
  };
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setMode("view")}
          className="row-action"
          title="View policy"
          aria-label="View policy"
        >
          <Eye />
        </button>
        <button
          type="button"
          onClick={run}
          disabled={evaluate.isPending}
          className="row-action"
          title="Run policy check"
          aria-label="Run policy check"
        >
          <Play />
        </button>
        <button
          type="button"
          onClick={() => setMode("edit")}
          className="row-action"
          title="Edit policy"
          aria-label="Edit policy"
        >
          <Pencil />
        </button>
        <button
          type="button"
          onClick={deletePolicy}
          disabled={remove.isPending}
          className="row-action danger"
          title="Delete policy"
          aria-label="Delete policy"
        >
          <Trash2 />
        </button>
      </div>
      {mode && (
        <ModalDialog
          title={mode === "view" ? policy.name : "Edit policy"}
          eyebrow="Policy"
          onClose={() => setMode(null)}
          size="3xl"
          backdropClassName="bg-slate-900/40"
          titleClassName="text-xl"
        >
            {mode === "view" ? (
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <p>{policy.description || "No description provided."}</p>
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
                  <Info label="Type" value={policy.policy_type} />
                  <Info
                    label="Scope"
                    value={formatFieldLabel(policy.applies_to)}
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
                  {policy.policy_type_code === "retention" && (
                    <>
                      <Info
                        label="How often"
                        value={AUDIT_FREQUENCY_LABELS[policy.audit_frequency] || policy.audit_frequency}
                      />
                      <Info
                        label="People checked"
                        value={`${policy.sample_pct}%`}
                      />
                      <Info
                        label="HR contact"
                        value={policy.assigned_auditor || "Unassigned"}
                      />
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-xl bg-brand-pink px-4 py-2.5 font-semibold text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
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
                    onChange={(value) =>
                      setForm({ ...form, policy_type_id: value })
                    }
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

                {/* Render Type-specific configuration fields */}
                {typeCode === "document_requirement" && (
                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 grid gap-3 sm:grid-cols-2">
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
                    <label className="flex items-center gap-2 pt-6 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.allow_waiver}
                        onChange={(e) =>
                          setForm({ ...form, allow_waiver: e.target.checked })
                        }
                        className="h-4 w-4 accent-pink-600 rounded"
                      />
                      Allow exceptions or waivers
                    </label>
                  </div>
                )}

                {typeCode === "renewable_document" && (
                  <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
                      Expiration Alert Settings
                    </p>

                    <AlertCadenceSelector
                      value={form.alert_schedule_days}
                      onChange={(val: string) =>
                        setForm({ ...form, alert_schedule_days: val })
                      }
                    />

                    <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-slate-200/60">
                      <label>
                        <span className="label">Also notify HR admin</span>
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

                      <div className="flex items-center pt-5">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
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
                          Create a task for the employee to upload a new copy
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {typeCode === "compliance_request" && (
                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="label">When should this start?</span>
                      <ThemedSelect
                        value={form.event_trigger}
                        onChange={(val) =>
                          setForm({ ...form, event_trigger: val })
                        }
                        options={Object.entries(EVENT_TRIGGER_LABELS).map(
                          ([value, label]) => ({ value, label }),
                        )}
                      />
                    </label>
                    <label>
                      <span className="label">Days to submit documents</span>
                      <input
                        type="number"
                        min="1"
                        className="field"
                        value={form.due_days}
                        onChange={(e) =>
                          setForm({ ...form, due_days: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="label">
                        Who follows up?
                      </span>
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
                  </div>
                )}

                {typeCode === "retention" && (
                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="label">How often to check</span>
                      <ThemedSelect
                        value={form.audit_frequency}
                        onChange={(val) =>
                          setForm({ ...form, audit_frequency: val })
                        }
                        options={Object.entries(AUDIT_FREQUENCY_LABELS).map(
                          ([value, label]) => ({ value, label }),
                        )}
                      />
                    </label>
                    <label>
                      <span className="label">How many people to check (%)</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="field"
                        value={form.sample_pct}
                        onChange={(e) =>
                          setForm({ ...form, sample_pct: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="label">Who runs the check?</span>
                      <ThemedSelect
                        value={String(form.assigned_auditor_id || "")}
                        onChange={(val) =>
                          setForm({ ...form, assigned_auditor_id: val })
                        }
                        placeholder="Select HR contact"
                        options={(targets?.users || []).map((u: any) => ({
                          value: String(u.id),
                          label: u.name,
                        }))}
                      />
                    </label>
                  </div>
                )}

                <label className="sm:col-span-2">
                  <span className="label">Which documents are needed?</span>
                  <div className="mt-2">
                    <PolicyTypeMultiSelect
                      types={documents}
                      selected={form.document_type_ids}
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
                </label>
                <label>
                  <span className="label">Applies to</span>
                  <ThemedSelect
                    value={form.applies_to}
                    onChange={(value) =>
                      setForm({ ...form, applies_to: value, scope_ids: [] })
                    }
                    options={[
                      { value: "all", label: "All Employees" },
                      { value: "department", label: "Departments" },
                      { value: "grade", label: "Groups" },
                      { value: "employee", label: "Employees" },
                    ]}
                  />
                </label>
                <ScopeChecklist
                  appliesTo={form.applies_to}
                  items={scopeOptions}
                  selected={form.scope_ids}
                  onToggle={(id: number) => toggle("scope_ids", id)}
                />
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
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
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
