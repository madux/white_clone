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
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";
import {
  useComplianceTargets,
  useCreateException,
  useDeactivateException,
  useDeleteException,
  useCreatePolicy,
  useDocumentTypes,
  useEvaluatePolicy,
  useEvaluations,
  useExceptions,
  useReactivateException,
  usePolicies,
  usePolicyTypes,
} from "../../../hooks/useDocuments";
import PolicyActions from "./PolicyActions";

type Tab = "policies" | "exceptions" | "history";
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

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>("policies");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState(false);
  const policies = usePolicies();
  const exceptions = useExceptions();
  const evaluations = useEvaluations();
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
    applies_to: "employee",
    scope_ids: [] as number[],
    schedule: "monthly",
    custom_schedule_days: "30",
    minimum_documents: "1",
    grace_period_days: "0",
    effective_date: new Date().toISOString().slice(0, 10),
  });
  const [exceptionForm, setExceptionForm] = useState({
    employee_id: "",
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
  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    await createPolicy.mutateAsync({
      ...policyForm,
      policy_type_id: Number(policyForm.policy_type_id),
      document_type_ids: policyForm.document_type_ids,
      employee_ids:
        policyForm.applies_to === "employee" ? policyForm.scope_ids : [],
      department_ids:
        policyForm.applies_to === "department" ? policyForm.scope_ids : [],
      grade_ids: policyForm.applies_to === "grade" ? policyForm.scope_ids : [],
      custom_schedule_days: Number(policyForm.custom_schedule_days),
      minimum_documents: Number(policyForm.minimum_documents),
      grace_period_days: Number(policyForm.grace_period_days),
    });
    setShowForm(false);
  };
  const submitException = async (event: FormEvent) => {
    event.preventDefault();
    await createException.mutateAsync({
      employee_id: Number(exceptionForm.employee_id),
      policy_id: Number(exceptionForm.policy_id),
      reason: exceptionForm.reason,
      valid_until: exceptionForm.valid_until,
    });
    setShowForm(false);
    setExceptionForm({
      employee_id: "",
      policy_id: "",
      reason: "",
      valid_until: "",
    });
  };
  const runCheck = async () => {
    setRunning(true);
    for (const policy of policies.data ?? [])
      await evaluate.mutateAsync(policy.id);
    setRunning(false);
  };

  return (
    <div className="relative min-h-full mx-auto max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6 pb-10">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
            Employee compliance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Compliance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage requirements, exceptions, and evaluation history for employee
            documents.
          </p>
        </div>
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
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
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
            {exceptions.data?.length ?? 0}
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
              placeholder={`Search ${tab === "policies" ? "policies" : tab === "exceptions" ? "exceptions" : "history"}...`}
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
        {tab === "history" && (
          <HistoryTable evaluations={evaluations.data ?? []} />
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
            onClose={() => setShowForm(false)}
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
            <td className="cell capitalize">
              {policy.applies_to.replace("_", " ")}
            </td>
            <td className="cell capitalize">
              {policy.schedule.replace("_", " ")}
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
              <span className="status pending">{item.status}</span>
            </td>
            <td className="cell"><ExceptionActions exception={item} /></td>
          </tr>
        ))}
      </>
    </Table>
  );
}

function ExceptionActions({ exception }: { exception: any }) {
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
  return <div className="flex items-center justify-end gap-1">
    <button type="button" onClick={toggle} disabled={deactivate.isPending || reactivate.isPending} className="row-action" title={active ? "Deactivate exception" : "Reactivate exception"}>{active ? <Ban /> : <RotateCcw />}</button>
    <button type="button" onClick={deleteException} disabled={remove.isPending} className="row-action danger" title="Delete exception"><Trash2 /></button>
  </div>;
}
function HistoryTable({ evaluations }: { evaluations: any[] }) {
  return (
    <Table
      headers={["Policy", "Complete", "Missing", "Score", "Evaluated at"]}
      empty="No run history yet."
    >
      <>
        {evaluations.map((item) => (
          <tr key={item.id} className="hover:bg-pink-50/30">
            <td className="cell">
              <b>{item.policy}</b>
              <small>{item.employee}</small>
            </td>
            <td className="cell">{item.complete_count} complete</td>
            <td className="cell">{item.missing_count} missing</td>
            <td className="cell">{item.score}%</td>
            <td className="cell">{item.evaluated_at}</td>
          </tr>
        ))}
      </>
    </Table>
  );
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
      <table className="w-full min-w-[760px] text-left">
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
      </table>
    </div>
  );
}
function PolicyForm({
  form,
  setForm,
  types,
  documents,
  targets,
  pending,
  onClose,
  onSubmit,
}: any) {
  const [formError, setFormError] = useState("");
  const scopeKey = `${form.applies_to}s`;
  const scopeOptions =
    form.applies_to === "department"
      ? (targets?.departments ?? [])
      : form.applies_to === "grade"
        ? (targets?.grades ?? [])
        : (targets?.employees ?? []);
  const submit = (event: FormEvent) => {
    if (!form.document_type_ids.length) {
      event.preventDefault();
      setFormError("Select at least one required document type.");
      return;
    }
    if (!form.scope_ids.length) {
      event.preventDefault();
      setFormError(`Select at least one ${form.applies_to}.`);
      return;
    }
    setFormError("");
    onSubmit(event);
  };
  return (
    <Modal title="Create policy" onClose={onClose}>
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
          <select
            required
            className="field"
            value={form.policy_type_id}
            onChange={(e) =>
              setForm({ ...form, policy_type_id: e.target.value })
            }
          >
            <option value="">Select type</option>
            {types.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" full>
          <textarea
            className="field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Required document types" full>
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {documents.map((item: any) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={form.document_type_ids.includes(item.id)}
                  onChange={() =>
                    setForm({
                      ...form,
                      document_type_ids: form.document_type_ids.includes(
                        item.id,
                      )
                        ? form.document_type_ids.filter(
                            (id: number) => id !== item.id,
                          )
                        : [...form.document_type_ids, item.id],
                    })
                  }
                  className="h-4 w-4 accent-pink-600"
                />
                <span className="font-medium">{item.name}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Applies to">
          <select
            className="field"
            value={form.applies_to}
            onChange={(e) =>
              setForm({ ...form, applies_to: e.target.value, scope_ids: [] })
            }
          >
            <option value="department">Departments</option>
            <option value="grade">Grades</option>
            <option value="employee">Employees</option>
          </select>
        </Field>
        <Field label={`Select ${form.applies_to}s`} full>
          <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            {scopeOptions.map((item: any) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={form.scope_ids.includes(item.id)}
                  onChange={() =>
                    setForm({
                      ...form,
                      scope_ids: form.scope_ids.includes(item.id)
                        ? form.scope_ids.filter((id: number) => id !== item.id)
                        : [...form.scope_ids, item.id],
                    })
                  }
                  className="h-4 w-4 accent-pink-600"
                />
                <span className="font-medium">{item.name}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Schedule">
          <select
            className="field"
            value={form.schedule}
            onChange={(e) => setForm({ ...form, schedule: e.target.value })}
          >
            {schedules.map((item) => (
              <option key={item} value={item}>
                {item.replace("_", " ")}
              </option>
            ))}
          </select>
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
        <Field label="Minimum documents">
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
        <Field label="Grace period (days)">
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
        {formError && (
          <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {formError}
          </p>
        )}
        <Actions pending={pending} onClose={onClose} />
      </form>
    </Modal>
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
    <Modal title="Create exception" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Employee">
          <select
            required
            className="field"
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
          >
            <option value="">Select employee</option>
            {employees.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Policy">
          <select
            required
            className="field"
            value={form.policy_id}
            onChange={(e) => setForm({ ...form, policy_id: e.target.value })}
          >
            <option value="">Select policy</option>
            {policies.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
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
    </Modal>
  );
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
function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
              Compliance engine
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
