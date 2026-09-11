"use client";

import { 
  ClipboardCheck,
  Ban,
  FileText,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { formatFieldLabel, formatStatusLabel } from "../../../lib/formatLabel";
import {
  useComplianceTargets,
  useCreateException,
  useApproveException,
  useDeactivateException,
  useDeleteException,
  useCreatePolicy,
  useDocumentTypes,
  useEvaluatePolicy,
  useEvaluations,
  useEvaluationRuns,
  useExceptions,
  useReactivateException,
  useRejectException,
  usePolicies,
  usePolicyTypes,
} from "../../../hooks/useDocuments";
import PolicyActions from "./PolicyActions";
import ModalDialog from "./ModalDialog";
import PolicyTypeMultiSelect from "./PolicyTypeMultiSelect";
import SortableTable from "./SortableTable";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";
import ThemedSelect from "./ThemedSelect";
import {
  AUDIT_FREQUENCY_LABELS,
  EVENT_TRIGGER_LABELS,
} from "../../../lib/complianceCopy";

type Tab = "policies" | "exceptions" | "evaluations" | "history";
const schedules = [
  "manual",
  "one_time",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
  "custom",
];

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>("policies");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [policySubmitError, setPolicySubmitError] = useState("");
  const [running, setRunning] = useState(false);
  const policies = usePolicies();
  const exceptions = useExceptions();
  const evaluations = useEvaluations();
  const runs = useEvaluationRuns();
  const types = usePolicyTypes();
  const documents = useDocumentTypes();
  const targets = useComplianceTargets();
  const createPolicy = useCreatePolicy();
  const createException = useCreateException();
  const evaluate = useEvaluatePolicy();
  const [policyForm, setPolicyForm] = useState({
    name: "",
    description: "",
    policy_type_id: "",
    document_type_ids: [] as number[],
    applies_to: "all",
    scope_ids: [] as number[],
    schedule: "monthly",
    custom_schedule_days: "30",
    minimum_documents: "1",
    grace_period_days: "0",
    effective_date: new Date().toISOString().slice(0, 10),
    // Type-specific fields
    allow_waiver: true,
    alert_schedule_days: "60,30,15,7,0",
    escalate_manager_days: 0,
    escalate_hr_days: 7,
    auto_request_renewal: true,
    event_trigger: "onboarding",
    due_days: 14,
    reminder_frequency_days: 3,
    assigned_reviewer_id: "",
    audit_frequency: "quarterly",
    sample_pct: 100,
    assigned_auditor_id: "",
  });

  useEffect(() => {
    if (!policyForm.policy_type_id && types.data && types.data.length > 0) {
      setPolicyForm((prev) => ({
        ...prev,
        policy_type_id: String(types.data[0].id),
      }));
    }
  }, [types.data, policyForm.policy_type_id]);

  const [exceptionForm, setExceptionForm] = useState({
    employee_ids: [] as number[],
    policy_id: "",
    reason: "",
    valid_until: "",
  });
  const displayedPolicies = (policies.data ?? []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const displayedExceptions = (exceptions.data ?? []).filter((item) =>
    `${item.employee} ${item.policy} ${item.reason}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const displayedEvaluations = (evaluations.data ?? []).filter((item) =>
    `${item.employee} ${item.policy} ${item.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    setPolicySubmitError("");
    const effectiveAppliesTo =
      policyForm.applies_to === "all" || policyForm.scope_ids.length === 0
        ? "all"
        : policyForm.applies_to;

    try {
      await createPolicy.mutateAsync({
        ...policyForm,
        policy_type_id: Number(policyForm.policy_type_id),
        applies_to: effectiveAppliesTo,
        document_type_ids: policyForm.document_type_ids,
        employee_ids:
          effectiveAppliesTo === "employee" ? policyForm.scope_ids : [],
        department_ids:
          effectiveAppliesTo === "department" ? policyForm.scope_ids : [],
        grade_ids: effectiveAppliesTo === "grade" ? policyForm.scope_ids : [],
        custom_schedule_days: Number(policyForm.custom_schedule_days),
        minimum_documents: Number(policyForm.minimum_documents),
        grace_period_days: Number(policyForm.grace_period_days),
        assigned_reviewer_id: policyForm.assigned_reviewer_id
          ? Number(policyForm.assigned_reviewer_id)
          : false,
        assigned_auditor_id: policyForm.assigned_auditor_id
          ? Number(policyForm.assigned_auditor_id)
          : false,
        escalate_manager_days: 0,
      });
    } catch (error: any) {
      setPolicySubmitError(error?.message || "Failed to create policy.");
      return;
    }
    setShowForm(false);
    setPolicyForm({
      name: "",
      description: "",
      policy_type_id: types.data?.[0]?.id ? String(types.data[0].id) : "",
      document_type_ids: [],
      applies_to: "all",
      scope_ids: [],
      schedule: "monthly",
      custom_schedule_days: "30",
      minimum_documents: "1",
      grace_period_days: "0",
      effective_date: new Date().toISOString().slice(0, 10),
      allow_waiver: true,
      alert_schedule_days: "60,30,15,7,0",
      escalate_manager_days: 0,
      escalate_hr_days: 7,
      auto_request_renewal: true,
      event_trigger: "onboarding",
      due_days: 14,
      reminder_frequency_days: 3,
      assigned_reviewer_id: "",
      audit_frequency: "quarterly",
      sample_pct: 100,
      assigned_auditor_id: "",
    });
  };
  const submitException = async (event: FormEvent) => {
    event.preventDefault();
    if (!exceptionForm.employee_ids.length) return;
    await createException.mutateAsync({
      employee_ids: exceptionForm.employee_ids,
      policy_id: Number(exceptionForm.policy_id),
      reason: exceptionForm.reason,
      valid_until: exceptionForm.valid_until,
    });
    setShowForm(false);
    setExceptionForm({
      employee_ids: [],
      policy_id: "",
      reason: "",
      valid_until: "",
    });
  };
  const runCheck = async () => {
    setRunning(true);
    try {
      for (const policy of policies.data ?? []) await evaluate.mutateAsync(policy.id);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-pink hover:text-brand-pink"
          >
            <ListChecks className="h-4 w-4" />
            {running ? "Running..." : "Run Check"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPolicySubmitError("");
              setShowForm(true);
            }}
            disabled={tab === "evaluations" || tab === "history"}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {tab === "exceptions" ? "New Exception" : "New Policy"}
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-text to-brand-pink p-5 text-white shadow-lg shadow-pink-200">
          <ShieldCheck className="h-5 w-5" />
          <p className="mt-5 text-3xl font-bold">
            {policies.data?.length ?? 0}
          </p>
          <p className="text-sm text-white/80">Active policies</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ClipboardCheck className="h-5 w-5 text-brand-pink" />
          <p className="mt-5 text-3xl font-bold text-slate-900">
            {exceptions.data?.filter((item) => item.active !== false && ["draft", "approved"].includes(item.status)).length ?? 0}
          </p>
          <p className="text-sm text-slate-500">Open exceptions</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <FileText className="h-5 w-5 text-brand-pink" />
          <p className="mt-5 text-3xl font-bold text-slate-900">
            {evaluations.data?.length ?? 0}
          </p>
          <p className="text-sm text-slate-500">Recorded evaluations</p>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <nav
            className="flex gap-1 rounded-xl bg-slate-50 p-1"
            aria-label="Compliance sections"
          >
            {(
              [
                ["policies", "Policies"],
                ["exceptions", "Exceptions"],
                ["evaluations", "Evaluations"],
                ["history", "Run History"],
              ] as [Tab, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setSearch("");
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === value ? "bg-white text-brand-pink shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <label className="relative block sm:w-72">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${tab}...`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
            />
          </label>
        </div>
        {tab === "policies" && (
            <PolicyTable
            policies={displayedPolicies}
            documents={documents.data ?? []}
            types={types.data ?? []}
            targets={targets.data}
          />
        )}
        {tab === "exceptions" && (
          <ExceptionTable exceptions={displayedExceptions} />
        )}
        {tab === "evaluations" && (
          <EvaluationTable evaluations={displayedEvaluations} />
        )}
        {tab === "history" && (
            <HistoryTable runs={runs.data ?? []} />
        )}
      </section>
      {showForm &&
        (tab === "exceptions" ? (
          <ExceptionForm
            form={exceptionForm}
            setForm={setExceptionForm}
            employees={targets.data?.employees ?? []}
            policies={policies.data ?? []}
            pending={createException.isPending}
            onClose={() => setShowForm(false)}
            onSubmit={submitException}
          />
        ) : (
          <PolicyForm
            form={policyForm}
            setForm={setPolicyForm}
            types={types.data ?? []}
            documents={documents.data ?? []}
            targets={targets.data}
            pending={createPolicy.isPending}
            submitError={policySubmitError}
            onClose={() => {
              setPolicySubmitError("");
              setShowForm(false);
            }}
            onSubmit={submitPolicy}
          />
        ))}
    </div>
  );
}

function PolicyTable({
  policies,
  documents,
  types,
  targets,
}: {
  policies: any[];
  documents: any[];
  types: any[];
  targets: any;
}) {
  return (
    <Table
      headers={[
        "Policy name",
        "Policy type",
        "Details",
        "Applies to",
        "Schedule",
        "Next run",
        "Status",
        "Actions",
      ]}
      empty="No policies found."
    >
      <>
        {policies.map((policy) => (
          <tr key={policy.id} className="hover:bg-pink-50/30">
            <td className="cell">
              <b>{policy.name}</b>
              <small>{policy.description || "No description provided"}</small>
            </td>
            <td className="cell">
              <span className="tag">{policy.policy_type}</span>
            </td>
            <td className="cell">
              {policy.minimum_documents} document
              {policy.minimum_documents === 1 ? "" : "s"}
            </td>
            <td className="cell">
              {formatFieldLabel(policy.applies_to)}
            </td>
            <td className="cell">
              {formatFieldLabel(policy.schedule)}
            </td>
            <td className="cell">
              <small>{policy.schedule === "manual" ? "Manual only" : policy.next_run_at ? formatDateTime(policy.next_run_at) : "Not scheduled"}</small>
              {policy.last_run_at && <small className="mt-1">Last: {formatDateTime(policy.last_run_at)}</small>}
            </td>
            <td className="cell">
              <span className="status">
                {policy.active ? "Active" : "Inactive"}
              </span>
            </td>
            <td className="cell">
              <PolicyActions
                policy={policy}
                documents={documents}
                types={types}
                targets={targets}
              />
            </td>
          </tr>
        ))}
      </>
    </Table>
  );
}
function EvaluationTable({ evaluations }: { evaluations: any[] }) {
  return (
    <Table
      headers={["Employee", "Policy", "Status", "Score", "Missing", "Grace", "Evaluated"]}
      empty="No evaluations found."
    >
      <>
        {evaluations.map((item) => (
          <tr key={item.id} className="hover:bg-pink-50/30">
            <td className="cell"><b>{item.employee}</b></td>
            <td className="cell">{item.policy}</td>
            <td className="cell">
              <span className={`status ${item.status === "compliant" ? "approved" : item.status === "non_compliant" ? "danger" : "pending"}`}>
                {formatStatusLabel(item.status)}
              </span>
            </td>
            <td className="cell">{item.score}%</td>
            <td className="cell">{item.missing_count}</td>
            <td className="cell">{item.grace_count}</td>
            <td className="cell"><small>{item.evaluated_at ? formatDateTime(item.evaluated_at) : "—"}</small></td>
          </tr>
        ))}
      </>
    </Table>
  );
}

function ExceptionTable({ exceptions }: { exceptions: any[] }) {
  return (
    <Table
      headers={["Employee", "Reason", "Valid until", "Status", "Actions"]}
      empty="No exceptions found."
    >
      <>
        {exceptions.map((item) => (
          <tr key={item.id} className="hover:bg-pink-50/30">
            <td className="cell">
              <b>{item.employee}</b>
              <small>{item.policy}</small>
            </td>
            <td className="cell">{item.reason}</td>
            <td className="cell">{item.valid_until}</td>
            <td className="cell">
              <span className={`status ${item.status === "approved" ? "approved" : item.status === "rejected" || item.status === "expired" ? "danger" : "pending"}`}>{formatStatusLabel(item.status)}</span>
            </td>
            <td className="cell"><ExceptionActions exception={item} /></td>
          </tr>
        ))}
      </>
    </Table>
  );
}

function ExceptionActions({ exception }: { exception: any }) {
  const approve = useApproveException();
  const reject = useRejectException();
  const deactivate = useDeactivateException();
  const reactivate = useReactivateException();
  const remove = useDeleteException();
  const active = exception.active !== false;
  const toggle = async () => {
    if (active) await deactivate.mutateAsync(exception.id);
    else await reactivate.mutateAsync(exception.id);
  };
  const deleteException = async () => {
    if (window.confirm("Delete this exception? This cannot be undone."))
      await remove.mutateAsync(exception.id);
  };
  return <div className="flex flex-wrap items-center justify-end gap-1">
    {exception.status === "draft" && <><button type="button" onClick={() => approve.mutateAsync(exception.id)} disabled={approve.isPending} className="row-action text-emerald-600" title="Approve exception" aria-label="Approve exception"><ShieldCheck /></button><button type="button" onClick={() => reject.mutateAsync(exception.id)} disabled={reject.isPending} className="row-action danger" title="Reject exception" aria-label="Reject exception"><Ban /></button></>}
    <button type="button" onClick={toggle} disabled={deactivate.isPending || reactivate.isPending} className="row-action" title={active ? "Deactivate exception" : "Reactivate exception"}>{active ? <Ban /> : <RotateCcw />}</button>
    <button type="button" onClick={deleteException} disabled={remove.isPending} className="row-action danger" title="Delete exception"><Trash2 /></button>
  </div>;
}
function HistoryTable({ runs }: { runs: any[] }) {
  return (
    <Table
      headers={["Policy", "Run type", "Employees", "Results", "Evaluated at"]}
      empty="No run history yet."
    >
      <>
        {runs.map((item) => (
          <tr key={item.id} className="hover:bg-pink-50/30">
            <td className="cell">
              <b>{item.policy}</b>
            </td>
            <td className="cell">{formatFieldLabel(item.run_type)}</td>
            <td className="cell">{item.employee_count}</td>
            <td className="cell"><small>{item.compliant_count} compliant · {item.partial_count} partial · {item.non_compliant_count} missing · {item.excepted_count} excepted</small></td>
            <td className="cell">{item.evaluated_at}</td>
          </tr>
        ))}
      </>
    </Table>
  );
}

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")));
}
function Table({
  children,
  headers,
  empty,
}: {
  children: React.ReactNode;
  headers: string[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <SortableTable className="w-full min-w-[760px] text-left">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-5 py-4">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </SortableTable>
    </div>
  );
}
export function ScopeChecklist({
  appliesTo,
  items,
  selected,
  onToggle,
}: {
  appliesTo: string;
  items: any[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  if (appliesTo === "all") {
    return (
      <div className="sm:col-span-2 rounded-2xl border border-pink-200/80 bg-gradient-to-r from-pink-50/70 to-slate-50 p-4 text-slate-700 shadow-sm">
        <p className="font-semibold text-brand-pink flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Applies to All Employees
        </p>
        <p className="mt-1 text-xs text-slate-500">
          This policy will automatically apply to and evaluate all active employees in the organization.
        </p>
      </div>
    );
  }

  const labelText =
    appliesTo === "department"
      ? "Departments"
      : appliesTo === "grade"
        ? "Groups"
        : "Employees";

  const filtered = (items || []).filter((item: any) => {
    const q = query.toLowerCase();
    const nameMatch = (item.name || "").toLowerCase().includes(q);
    const deptMatch = (item.department || "").toLowerCase().includes(q);
    const titleMatch = (item.job_title || "").toLowerCase().includes(q);
    const emailMatch = (item.work_email || "").toLowerCase().includes(q);
    return nameMatch || deptMatch || titleMatch || emailMatch;
  });

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="label text-slate-700 font-semibold">Select {labelText}</span>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${labelText.toLowerCase()}...`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-brand-pink/40 focus:bg-white focus:ring-2 focus:ring-brand-pink/10"
          />
        </div>
      </div>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
        <span>
          💡 <strong>Note:</strong> If no {labelText.toLowerCase()} are selected, this policy will automatically apply to <strong>all employees</strong>.
        </span>
        {selected.length > 0 && (
          <span className="text-[11px] font-semibold text-brand-pink">
            {selected.length} selected
          </span>
        )}
      </div>

      <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="sm:col-span-2 text-center text-xs text-slate-400 py-3">
            No matching {labelText.toLowerCase()} found.
          </p>
        ) : (
          filtered.map((item: any) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-pink-200 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 accent-pink-600 rounded"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">{item.name}</span>
                {item.department && appliesTo === "employee" && (
                  <span className="block truncate text-xs text-slate-400">
                    {item.department} {item.job_title ? `· ${item.job_title}` : ""}
                  </span>
                )}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function AlertCadenceSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (newValue: string) => void;
}) {
  const PRESETS = [
    { label: "90 days before", days: 90 },
    { label: "60 days before", days: 60 },
    { label: "30 days before", days: 30 },
    { label: "15 days before", days: 15 },
    { label: "7 days before", days: 7 },
    { label: "1 day before", days: 1 },
    { label: "On expiry day", days: 0 },
  ];

  const currentDays = (value || "60,30,15,7,0")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  const toggleDay = (day: number) => {
    let next: number[];
    if (currentDays.includes(day)) {
      next = currentDays.filter((d) => d !== day);
    } else {
      next = [...currentDays, day].sort((a, b) => b - a);
    }
    onChange(next.join(","));
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="label text-slate-700 font-semibold">
        When to send reminders
      </span>
      <p className="text-xs text-slate-500">
        Choose how far before the expiry date the employee should be reminded:
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {PRESETS.map((preset) => {
          const isSelected = currentDays.includes(preset.days);
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => toggleDay(preset.days)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? "bg-brand-pink text-white shadow-sm shadow-pink-200"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-pink-300 hover:text-brand-pink"
              }`}
            >
              {isSelected ? "✓ " : "+ "}
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TypeSpecificFields({
  typeCode,
  form,
  setForm,
  targets,
}: {
  typeCode: string;
  form: any;
  setForm: any;
  targets: any;
}) {
  if (typeCode === "document_requirement") {
    return (
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
          Document Requirement Settings
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Extra days to submit">
            <input
              type="number"
              min="0"
              className="field"
              value={form.grace_period_days}
              onChange={(e) =>
                setForm({ ...form, grace_period_days: e.target.value })
              }
            />
          </Field>
          <div className="flex items-center pt-5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
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
        </div>
      </div>
    );
  }

  if (typeCode === "renewable_document") {
    return (
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
          Expiration Alert Settings
        </p>

        <AlertCadenceSelector
          value={form.alert_schedule_days}
          onChange={(val) => setForm({ ...form, alert_schedule_days: val })}
        />

        <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-slate-200/60">
          <Field label="Also notify HR admin">
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
          </Field>

          <Field label="Extra days after expiry">
            <input
              type="number"
              min="0"
              className="field"
              value={form.grace_period_days}
              onChange={(e) =>
                setForm({ ...form, grace_period_days: e.target.value })
              }
            />
          </Field>

          <div className="flex items-center pt-5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.auto_request_renewal}
                onChange={(e) =>
                  setForm({ ...form, auto_request_renewal: e.target.checked })
                }
                className="h-4 w-4 accent-pink-600 rounded"
              />
              Create a task for the employee to upload a new copy
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (typeCode === "compliance_request") {
    return (
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
          Compliance Request Settings
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="When should this start?">
            <ThemedSelect
              value={form.event_trigger}
              onChange={(val) => setForm({ ...form, event_trigger: val })}
              options={Object.entries(EVENT_TRIGGER_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Field>
          <Field label="Days to submit documents">
            <input
              type="number"
              min="1"
              className="field"
              value={form.due_days}
              onChange={(e) =>
                setForm({ ...form, due_days: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Send reminder every (days)">
            <input
              type="number"
              min="1"
              className="field"
              value={form.reminder_frequency_days}
              onChange={(e) =>
                setForm({
                  ...form,
                  reminder_frequency_days: Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Who follows up?">
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
          </Field>
        </div>
      </div>
    );
  }

  if (typeCode === "retention") {
    return (
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
          Review Schedule Settings
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How often to check">
            <ThemedSelect
              value={form.audit_frequency}
              onChange={(val) => setForm({ ...form, audit_frequency: val })}
              options={Object.entries(AUDIT_FREQUENCY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Field>
          <Field label="How many people to check (%)">
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
          </Field>
          <Field label="Who runs the check?" full>
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
          </Field>
        </div>
      </div>
    );
  }

  return null;
}

function PolicyForm({
  form,
  setForm,
  types,
  documents,
  targets,
  pending,
  submitError,
  onClose,
  onSubmit,
}: any) {
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [formError, setFormError] = useState("");
  const scopeOptions =
    form.applies_to === "department"
      ? (targets?.departments ?? [])
      : form.applies_to === "grade"
        ? (targets?.grades ?? [])
        : (targets?.employees ?? []);

  const selectedType = (types || []).find(
    (t: any) => String(t.id) === String(form.policy_type_id)
  );
  const typeCode = selectedType?.code || "";

  const toggleScope = (id: number) => {
    setForm({
      ...form,
      scope_ids: form.scope_ids.includes(id)
        ? form.scope_ids.filter((item: number) => item !== id)
        : [...form.scope_ids, id],
    });
  };

  const submit = (event: FormEvent) => {
    if (!form.policy_type_id) {
      event.preventDefault();
      setFormError("Please select a policy type.");
      return;
    }
    if (!form.document_type_ids.length) {
      event.preventDefault();
      setFormError("Select at least one required document type.");
      return;
    }
    setFormError("");
    if (step === "configure") {
      event.preventDefault();
      setStep("review");
      return;
    }
    onSubmit(event);
  };

  const selectedDocumentTypes = documents.filter((item: any) =>
    form.document_type_ids.includes(item.id),
  );
  const scopeLabels =
    form.applies_to === "all"
      ? ["All employees"]
      : scopeOptions
          .filter((item: any) => form.scope_ids.includes(item.id))
          .map((item: any) => item.name);

  return (
    <ModalDialog
      title={step === "configure" ? "Create policy" : "Review policy"}
      eyebrow="Compliance engine"
      onClose={onClose}
      size="3xl"
    >
      {step === "configure" ? (
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Policy name">
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Policy type">
          <ThemedSelect
            value={form.policy_type_id}
            onChange={(value) => setForm({ ...form, policy_type_id: value })}
            placeholder="Select type"
            options={types.map((item: any) => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
        </Field>
        <Field label="Description" full>
          <textarea
            className="field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <TypeSpecificFields
          typeCode={typeCode}
          form={form}
          setForm={setForm}
          targets={targets}
        />

        <Field label="Which documents are needed?">
          <PolicyTypeMultiSelect
            types={documents}
            selected={form.document_type_ids}
            onChange={(document_type_ids) =>
              setForm({ ...form, document_type_ids })
            }
            error={
              formError === "Select at least one required document type."
                ? formError
                : undefined
            }
          />
        </Field>
        <Field label="Applies to">
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
        </Field>
        <ScopeChecklist
          appliesTo={form.applies_to}
          items={scopeOptions}
          selected={form.scope_ids}
          onToggle={toggleScope}
        />
        <Field label="Schedule">
          <ThemedSelect
            value={form.schedule}
            onChange={(value) =>
              setForm({ ...form, schedule: value === "manual" ? "" : value })
            }
            options={schedules.map((item) => ({
              value: item,
              label: item === "manual" ? "Manual Only" : formatFieldLabel(item),
            }))}
          />
        </Field>
        <Field label="Effective date">
          <input
            required
            type="date"
            className="field"
            value={form.effective_date}
            onChange={(e) =>
              setForm({ ...form, effective_date: e.target.value })
            }
          />
        </Field>
        <Field label="How many copies are needed?">
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
        </Field>
        <Field label="Extra days before marked missing">
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
        </Field>
        {(formError || submitError) && (
          <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {formError || submitError}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
          >
            Review
          </button>
        </div>
      </form>
      ) : (
        <div>
          <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Policy name</dt>
              <dd className="font-bold text-slate-800">{form.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Policy type</dt>
              <dd className="text-slate-700">{selectedType?.name || "—"}</dd>
            </div>
            {form.description && (
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Description</dt>
                <dd className="text-right text-slate-700">{form.description}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Required document types</dt>
              <dd className="text-right text-slate-700">
                {selectedDocumentTypes.map((item: any) => item.name).join(", ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Applies to</dt>
              <dd className="text-right text-slate-700">{scopeLabels.join(", ")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Schedule</dt>
              <dd className="text-slate-700">
                {formatFieldLabel(form.schedule || "manual")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Effective date</dt>
              <dd className="text-slate-700">{form.effective_date}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Minimum documents</dt>
              <dd className="text-slate-700">{form.minimum_documents}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Grace period</dt>
              <dd className="text-slate-700">{form.grace_period_days} days</dd>
            </div>
          </dl>
          {submitError && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setStep("configure")}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={(event) => submit(event as unknown as FormEvent)}
              className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
            >
              {pending ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
function ExceptionForm({
  form,
  setForm,
  employees,
  policies,
  pending,
  onClose,
  onSubmit,
}: any) {
  return (
    <ModalDialog
      title="Create exception"
      eyebrow="Compliance engine"
      onClose={onClose}
      size="3xl"
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <EmployeeChecklist employees={employees} form={form} setForm={setForm} />
        <Field label="Policy">
          <ThemedSelect value={form.policy_id} onChange={(value) => setForm({ ...form, policy_id: value })} placeholder="Select policy" options={policies.map((item: any) => ({ value: String(item.id), label: item.name }))} />
        </Field>
        <Field label="Reason">
          <textarea
            required
            className="field min-h-24"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </Field>
        <Field label="Valid until">
          <input
            required
            type="date"
            className="field"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
          />
        </Field>
        <Actions pending={pending} onClose={onClose} />
      </form>
    </ModalDialog>
  );
}
function EmployeeChecklist({ employees, form, setForm }: any) {
  const [query, setQuery] = useState("");
  const visible = employees.filter((item: any) => item.name.toLowerCase().includes(query.toLowerCase()));
  return <Field label="Employees"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees..." className="field" /><div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">{visible.map((item: any) => <label key={item.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-pink-50"><input type="checkbox" checked={form.employee_ids.includes(item.id)} onChange={() => setForm({ ...form, employee_ids: form.employee_ids.includes(item.id) ? form.employee_ids.filter((id: number) => id !== item.id) : [...form.employee_ids, item.id] })} className="h-4 w-4 accent-pink-600" />{item.name}<span className="ml-auto text-xs text-slate-400">{item.department}</span></label>)}</div>{!form.employee_ids.length && <p className="mt-1 text-xs text-red-500">Select at least one employee.</p>}</Field>;
}
function Field({ label, full, children }: any) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
function Actions({ pending, onClose }: any) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
      >
        Cancel
      </button>
      <button
        disabled={pending}
        className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
      >
        {pending ? "Saving..." : "Create"}
      </button>
    </div>
  );
}
