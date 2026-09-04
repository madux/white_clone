"use client";

import { Eye, FileText, Pencil, Play, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useDeletePolicy, useEvaluatePolicy, useUpdatePolicy } from "../../../hooks/useDocuments";

const schedules = ["one_time", "daily", "weekly", "monthly", "quarterly", "semi_annually", "annually", "custom"];

export default function PolicyActions({ policy, documents, types, targets }: { policy: any; documents: any[]; types: any[]; targets: any }) {
  const [mode, setMode] = useState<"view" | "edit" | null>(null);
  const [form, setForm] = useState({
    name: policy.name, description: policy.description || "", policy_type_id: String(policy.policy_type_id),
    document_type_ids: policy.document_type_ids ?? [], applies_to: policy.applies_to,
    scope_ids: policy[`${policy.applies_to}_ids`] ?? [], schedule: policy.schedule === "manual" ? "" : policy.schedule,
    custom_schedule_days: String(policy.custom_schedule_days ?? 30), minimum_documents: String(policy.minimum_documents ?? 1),
    grace_period_days: String(policy.grace_period_days ?? 0), effective_date: policy.effective_date || "", active: policy.active,
  });
  const [error, setError] = useState("");
  const update = useUpdatePolicy(); const remove = useDeletePolicy(); const evaluate = useEvaluatePolicy();
  const requiredDocuments = (policy.document_type_ids ?? []).map((id: number) => documents.find((document) => document.id === id)?.name).filter(Boolean);
  const scopeOptions = form.applies_to === "department" ? targets?.departments ?? [] : form.applies_to === "grade" ? targets?.grades ?? [] : targets?.employees ?? [];
  const toggle = (field: "document_type_ids" | "scope_ids", id: number) => setForm({ ...form, [field]: form[field].includes(id) ? form[field].filter((item: number) => item !== id) : [...form[field], id] });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.document_type_ids.length) return setError("Select at least one required document type.");
    if (!form.scope_ids.length) return setError(`Select at least one ${form.applies_to}.`);
    setError("");
    await update.mutateAsync({ id: policy.id, name: form.name.trim(), description: form.description.trim(), policy_type_id: Number(form.policy_type_id), document_type_ids: form.document_type_ids, applies_to: form.applies_to, department_ids: form.applies_to === "department" ? form.scope_ids : [], grade_ids: form.applies_to === "grade" ? form.scope_ids : [], employee_ids: form.applies_to === "employee" ? form.scope_ids : [], schedule: form.schedule || false, custom_schedule_days: Number(form.custom_schedule_days), minimum_documents: Number(form.minimum_documents), grace_period_days: Number(form.grace_period_days), effective_date: form.effective_date, active: form.active });
    setMode(null);
  };
  const run = async () => { await evaluate.mutateAsync(policy.id); window.alert("Policy check completed."); };
  const deletePolicy = async () => { if (window.confirm(`Delete "${policy.name}"? This cannot be undone.`)) await remove.mutateAsync(policy.id); };
  return <>
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => setMode("view")} className="row-action" title="View policy"><Eye /></button>
      <button type="button" onClick={run} disabled={evaluate.isPending} className="row-action" title="Run policy check"><Play /></button>
      <button type="button" onClick={() => setMode("edit")} className="row-action" title="Edit policy"><Pencil /></button>
      <button type="button" onClick={deletePolicy} disabled={remove.isPending} className="row-action danger" title="Delete policy"><Trash2 /></button>
    </div>
    {mode && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm"><div className="my-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">Policy</p><h2 className="mt-1 text-xl font-bold text-slate-900">{mode === "view" ? policy.name : "Edit policy"}</h2></div><button type="button" onClick={() => setMode(null)} className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><X /></button></div>
      {mode === "view" ? <div className="mt-5 space-y-4 text-sm text-slate-600"><p>{policy.description || "No description provided."}</p><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Required documents</p><ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">{requiredDocuments.map((name: string, index: number) => <li key={name} className="flex items-center gap-3 bg-white px-3.5 py-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-50 text-xs font-bold text-brand-pink">{index + 1}</span><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="font-semibold text-slate-700">{name}</span></li>)}</ol></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Info label="Type" value={policy.policy_type} /><Info label="Scope" value={policy.applies_to.replace("_", " ")} /><Info label="Schedule" value={policy.schedule.replace("_", " ")} /><Info label="Minimum documents" value={String(policy.minimum_documents)} /><Info label="Grace period" value={`${policy.grace_period_days} days`} /><Info label="Status" value={policy.active ? "Active" : "Inactive"} /></div><button type="button" onClick={() => setMode(null)} className="rounded-xl bg-brand-pink px-4 py-2.5 font-semibold text-white">Close</button></div> : <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label><span className="label">Policy name</span><input required className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label><span className="label">Policy type</span><select required className="field" value={form.policy_type_id} onChange={(e) => setForm({ ...form, policy_type_id: e.target.value })}>{types.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="label">Description</span><textarea className="field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <Checklist label="Required document types" items={documents} selected={form.document_type_ids} onToggle={(id: number) => toggle("document_type_ids", id)} />
        <label><span className="label">Applies to</span><select className="field" value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value, scope_ids: [] })}><option value="department">Departments</option><option value="grade">Grades</option><option value="employee">Employees</option></select></label>
        <Checklist label={`Select ${form.applies_to}s`} items={scopeOptions} selected={form.scope_ids} onToggle={(id: number) => toggle("scope_ids", id)} />
        <label><span className="label">Schedule</span><select className="field" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}><option value="">Manual</option>{schedules.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></label>
        <label><span className="label">Effective date</span><input required type="date" className="field" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></label>
        <label><span className="label">Minimum documents</span><input required min="1" type="number" className="field" value={form.minimum_documents} onChange={(e) => setForm({ ...form, minimum_documents: e.target.value })} /></label>
        <label><span className="label">Grace period (days)</span><input required min="0" type="number" className="field" value={form.grace_period_days} onChange={(e) => setForm({ ...form, grace_period_days: e.target.value })} /></label>
        {form.schedule === "custom" && <label><span className="label">Custom interval (days)</span><input required min="1" type="number" className="field" value={form.custom_schedule_days} onChange={(e) => setForm({ ...form, custom_schedule_days: e.target.value })} /></label>}
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-pink-600" /> Active policy</label>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setMode(null)} className="rounded-xl px-4 py-2.5 font-semibold text-slate-500">Cancel</button><button disabled={update.isPending} className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white">{update.isPending ? "Saving..." : "Save changes"}</button></div>
      </form>}
    </div></div>}
  </>;
}

function Checklist({ label, items, selected, onToggle }: any) { return <label className="sm:col-span-2"><span className="label">{label}</span><div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">{items.map((item: any) => <span key={item.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 accent-pink-600" /><span className="font-medium">{item.name}</span></span>)}</div></label>; }
function Info({ label, value }: { label: string; value: string }) { return <span className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{label}</span><strong className="mt-1 block capitalize text-slate-900">{value}</strong></span>; }
