"use client";

import { useMemo, useState } from "react";
import { templatesFormsApi } from "../../../../lib/templates-forms-api";
import { useTemplateEmployees } from "../../../../hooks/useTemplatesForms";
import type { MergeField, TemplateItem } from "../../../../lib/templates-forms-api";

export default function AssignWizard({
  template,
  onClose,
}: {
  template: TemplateItem;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const employeesQuery = useTemplateEmployees({
    q: search,
    department_id: departmentId ? Number(departmentId) : undefined,
  });
  const employees = employeesQuery.data?.employees || [];
  const departments = employeesQuery.data?.departments || [];
  const fields: MergeField[] = template.merge_fields || [];
  const autoFilled = useMemo(
    () => fields.filter((field) => field.source !== "manual" && values[field.key]).length,
    [fields, values],
  );

  async function ensureAssignment() {
    if (assignmentId) return assignmentId;
    const data = (await templatesFormsApi.startAssignment(
      template.id,
      `assign-${template.id}-${Date.now()}`,
    )) as { id: number };
    setAssignmentId(data.id);
    return data.id;
  }

  async function goFill() {
    setError("");
    if (!selected.length) return;
    setBusy(true);
    try {
      const id = await ensureAssignment();
      await templatesFormsApi.assignment(id, {
        action: "recipients",
        employee_ids: selected,
      });
      const defaults: Record<string, string> = { ...values };
      for (const field of fields) {
        if (field.source !== "manual" && defaults[field.key] == null) {
          defaults[field.key] = "";
        }
      }
      setValues(defaults);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function goPreview() {
    setError("");
    setBusy(true);
    try {
      const id = await ensureAssignment();
      await templatesFormsApi.assignment(id, { action: "field-values", values });
      const data = await templatesFormsApi.assignment(id, { action: "preview" });
      setPreview(data);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError("");
    setBusy(true);
    try {
      const id = await ensureAssignment();
      await templatesFormsApi.assignment(id, { action: "confirm" });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const allIds = employees.map((item) => item.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const missing = (preview?.previews || []).some((item: any) => item.unresolved_fields?.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 p-5">
          <h2 id="assign-title" className="text-lg font-semibold">Assign Document</h2>
          <p className="text-sm text-slate-400">Step {step} of 3 · {template.name}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search employees"
                  className="field"
                  aria-label="Search employees"
                />
                <select
                  aria-label="Department"
                  className="field max-w-xs"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="p-2">
                      <input
                        type="checkbox"
                        aria-label="Select all employees"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? [] : allIds)
                        }
                      />
                    </th>
                    <th className="p-2">Employee</th>
                    <th className="p-2">Department</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Grade Level</th>
                    <th className="p-2">Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name}`}
                          checked={selected.includes(item.id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(item.id)
                                ? current.filter((value) => value !== item.id)
                                : [...current, item.id],
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-xs font-bold text-brand-text">
                            {item.initials}
                          </span>
                          <span>
                            <span className="block font-semibold">{item.name}</span>
                            <span className="text-xs text-slate-400">{item.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-2">{item.department}</td>
                      <td className="p-2">{item.role}</td>
                      <td className="p-2">{item.grade}</td>
                      <td className="p-2">{item.branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{autoFilled} fields auto-filled from employee records</p>
              {fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="label">
                    {field.label}
                    {field.required ? " *" : ""}
                    {field.source !== "manual" ? " · auto-filled" : ""}
                  </span>
                  {field.dataType === "longText" ? (
                    <textarea
                      className="field min-h-20"
                      value={values[field.key] || ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  ) : field.dataType === "select" ? (
                    <select
                      className="field"
                      value={values[field.key] || ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      <option value="">Select</option>
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field"
                      type={field.dataType === "date" ? "date" : field.dataType === "time" ? "time" : field.dataType === "email" ? "email" : "text"}
                      value={values[field.key] || ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              {(preview?.previews || []).map((item: any) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold">{item.name}</h3>
                  {item.unresolved_fields?.length ? (
                    <p className="text-sm text-amber-700">Unresolved: {item.unresolved_fields.join(", ")}</p>
                  ) : null}
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.preview_text || "No preview text."}</pre>
                </article>
              ))}
              <label className="block">
                <span className="label">Delivery</span>
                <select className="field" defaultValue="workspace">
                  <option value="workspace">Workspace</option>
                  <option value="email">Email</option>
                  <option value="both">Email and workspace</option>
                </select>
              </label>
            </div>
          )}
        </div>
        <div className="flex justify-between border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold">
                Back
              </button>
            )}
            {step === 1 && (
              <button type="button" disabled={!selected.length || busy} onClick={goFill} className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Next
              </button>
            )}
            {step === 2 && (
              <button type="button" disabled={busy} onClick={goPreview} className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white">
                Preview
              </button>
            )}
            {step === 3 && (
              <button type="button" disabled={busy || missing} onClick={confirm} className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
