"use client";

import { useMemo, useState } from "react";
import { resolveHeaderFieldCatalog } from "../../../lib/employeeFileHeaderFields";
import type { EmployeeFilesHeaderFieldOption } from "../../../lib/types";
import ThemedSelect from "./ThemedSelect";

type Props = {
  available: EmployeeFilesHeaderFieldOption[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
};

export default function EmployeeFilesHeaderFieldsSettings({
  available,
  selectedKeys,
  onChange,
}: Props) {
  const catalog = useMemo(() => resolveHeaderFieldCatalog(available), [available]);
  const usingApiCatalog = available.length > 0;
  const [pickKey, setPickKey] = useState("");

  const addOptions = catalog
    .filter((field) => !selectedKeys.includes(field.key))
    .map((field) => ({ value: field.key, label: field.label }));

  const orderedSelected = selectedKeys
    .map((key) => catalog.find((item) => item.key === key))
    .filter(Boolean) as EmployeeFilesHeaderFieldOption[];

  const addField = () => {
    if (!pickKey || selectedKeys.includes(pickKey)) return;
    onChange([...selectedKeys, pickKey]);
    setPickKey("");
  };

  const removeField = (key: string) => {
    onChange(selectedKeys.filter((item) => item !== key));
  };

  const move = (key: string, direction: -1 | 1) => {
    const index = selectedKeys.indexOf(key);
    if (index < 0) return;
    const next = [...selectedKeys];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    onChange(next);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">Employee information (header)</p>
        <p className="mt-1 text-sm text-slate-500">
          Choose which EMS fields appear on each employee file header. Changes apply on the next
          page load and do not write back to EMS.
        </p>
        {!usingApiCatalog ? (
          <p className="mt-2 text-xs text-amber-800">
            Showing default field list. Upgrade the Employee Files module on Odoo if options look
            incomplete.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Add header field
          </span>
          <ThemedSelect
            value={pickKey}
            onChange={setPickKey}
            portaled
            ariaLabel="Add header field"
            placeholder={
              addOptions.length
                ? "Select a field to add…"
                : "All fields are already on the header"
            }
            options={addOptions}
          />
        </label>
        <button
          type="button"
          onClick={addField}
          disabled={!pickKey}
          className="shrink-0 rounded-xl border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm font-semibold text-brand-text transition hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add to header
        </button>
      </div>

      {orderedSelected.length ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Header fields (order)
          </p>
          <ul className="space-y-2">
            {orderedSelected.map((field, index) => (
              <li
                key={field.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-800">{field.label}</span>
                  {field.ems_managed ? (
                    <span className="mt-0.5 block text-xs text-slate-500">Read-only · EMS</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    disabled={index === 0}
                    onClick={() => move(field.key, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    disabled={index === orderedSelected.length - 1}
                    onClick={() => move(field.key, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    onClick={() => removeField(field.key)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-amber-800">
          Add at least one header field using the dropdown above.
        </p>
      )}
    </div>
  );
}
