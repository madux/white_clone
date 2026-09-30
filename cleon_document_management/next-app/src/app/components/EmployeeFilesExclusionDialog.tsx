"use client";

import { UserMinus } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../lib/api";
import type { EmployeeFileExclusion } from "../../../lib/types";
import EmployeeMetricPicker from "./EmployeeMetricPicker";
import ModalDialog from "./ModalDialog";

type Mode = "select" | "view";

export default function EmployeeFilesExclusionDialog({
  mode,
  exclusions,
  onClose,
  onSaved,
  onRemoved,
}: {
  mode: Mode;
  exclusions: EmployeeFileExclusion[];
  onClose: () => void;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const excludedIds = useMemo(
    () => new Set(exclusions.map((row) => row.employee_id)),
    [exclusions],
  );

  const importCsv = async (file: File) => {
    setPending(true);
    setError("");
    try {
      const text = await file.text();
      const ids = text
        .split(/\r?\n/)
        .slice(1)
        .map((line) => Number((line.split(",")[0] || "").replace(/"/g, "").trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (!ids.length) throw new Error("No employee IDs found in the CSV.");
      await api.importEmployeeFileExclusions(ids);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Unable to import exclusions.");
    } finally {
      setPending(false);
    }
  };

  const save = async () => {
    if (!selected.length) return;
    setPending(true);
    setError("");
    try {
      await api.addEmployeeFileExclusions(selected);
      setSelected([]);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Unable to save exclusions.");
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: number) => {
    setPending(true);
    setError("");
    try {
      await api.removeEmployeeFileExclusion(id);
      onRemoved();
    } catch (err: any) {
      setError(err?.message || "Unable to remove exclusion.");
    } finally {
      setPending(false);
    }
  };

  if (mode === "view") {
    return (
      <ModalDialog
        title="Excluded employees"
        eyebrow="Employee exclusions"
        description="These EMS employees will not receive an Employee File during setup. You can change this list later in Settings."
        onClose={onClose}
        size="2xl"
        zIndex={120}
      >
        {exclusions.length ? (
          <ul className="employee-file-tree max-h-80 overflow-y-auto rounded-2xl border border-slate-100 p-2">
            {exclusions.map((row) => (
              <li
                key={row.id}
                className="employee-tree-row employee-tree-row-employee flex items-center justify-between gap-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-800">{row.employee_name}</span>
                  <span className="block text-xs text-slate-500">
                    {row.department_name || "Unassigned"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  className="shrink-0 text-xs font-semibold text-slate-500 hover:text-brand-pink"
                  onClick={() => remove(row.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No manual exclusions configured.
          </p>
        )}
        {error ? (
          <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <button type="button" className="rounded-xl px-4 py-2.5 font-semibold text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog
      title="Select employees to exclude"
      eyebrow="Employee exclusions"
      description="Choose EMS employees who should not receive an Employee File when setup runs."
      onClose={onClose}
      size="2xl"
      zIndex={120}
    >
      <EmployeeMetricPicker
        selectedIds={selected}
        onChange={(ids) => setSelected(ids)}
        disabledIds={Array.from(excludedIds)}
        placeholder="Search employees, departments, or other EMS metrics…"
      />

      {error ? (
        <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-semibold text-slate-600">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="ml-2 text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCsv(file);
            }}
          />
        </label>
        <p className="text-sm text-slate-600">
          {selected.length
            ? `${selected.length} employee${selected.length === 1 ? "" : "s"} selected`
            : "Select employees to add to the exclusion list"}
        </p>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl px-4 py-2.5 font-semibold text-slate-500" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected.length || pending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white disabled:opacity-50"
            onClick={save}
          >
            <UserMinus className="h-4 w-4" />
            {pending ? "Saving…" : "Add to exclusions"}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
