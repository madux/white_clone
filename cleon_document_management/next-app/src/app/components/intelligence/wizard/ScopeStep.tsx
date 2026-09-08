"use client";

import { useMemo, useState } from "react";

type Option = { id: number; name: string; department?: string };

const EMPLOYEE_SCOPES = [
  { value: "one_employee", label: "One employee" },
  { value: "multiple_employees", label: "Multiple employees" },
  { value: "department", label: "Department" },
  { value: "business_unit", label: "Business unit" },
  { value: "location", label: "Location" },
  { value: "grade", label: "Grade" },
  { value: "employment_type", label: "Employment type" },
  { value: "company", label: "Entire company" },
] as const;

export default function ScopeStep({
  source,
  scopeKind,
  scopeIds,
  options,
  estimate,
  onKind,
  onIds,
}: {
  source: string;
  scopeKind: string;
  scopeIds: number[];
  options: {
    employees: Option[];
    departments: Option[];
    grades: Option[];
    business_units: Option[];
    employment_types: Option[];
    locations: Option[];
  };
  estimate?: { document_count: number; employee_count: number };
  onKind: (value: string) => void;
  onIds: (value: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const needsPicker = source === "employee" && scopeKind !== "company";
  const single = scopeKind === "one_employee";
  const rows = useMemo(() => {
    const list =
      scopeKind === "one_employee" || scopeKind === "multiple_employees"
        ? options.employees
        : scopeKind === "department"
          ? options.departments
          : scopeKind === "grade"
            ? options.grades
            : scopeKind === "business_unit"
              ? options.business_units
              : scopeKind === "employment_type"
                ? options.employment_types
                : scopeKind === "location"
                  ? options.locations
                  : [];
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return list;
    }
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        (item.department || "").toLowerCase().includes(needle),
    );
  }, [options, query, scopeKind]);

  function toggle(id: number) {
    if (single) {
      onIds([id]);
      return;
    }
    onIds(scopeIds.includes(id) ? scopeIds.filter((item) => item !== id) : [...scopeIds, id]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Who does this cover?</h2>
        <p className="mt-1 text-sm text-slate-500">
          {source === "organizational"
            ? "Organizational Files are company documents. The run will use every organizational file you can access."
            : "Choose people or groups. The estimate below is recalculated from live files, not a saved snapshot."}
        </p>
      </div>
      {source === "employee" ? (
        <div className="flex flex-wrap gap-2">
          {EMPLOYEE_SCOPES.filter(
            (item) =>
              item.value !== "location" || options.locations.length > 0,
          )
            .filter(
              (item) =>
                item.value !== "business_unit" || options.business_units.length > 0,
            )
            .map((item) => (
              <button
                key={item.value}
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  scopeKind === item.value
                    ? "bg-brand-pink text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => onKind(item.value)}
              >
                {item.label}
              </button>
            ))}
        </div>
      ) : null}
      {needsPicker ? (
        <div className="space-y-2">
          <input
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
            {rows.length ? (
              rows.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-pink-50"
                >
                  <input
                    type={single ? "radio" : "checkbox"}
                    name="dataset-scope"
                    checked={scopeIds.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 accent-pink-600"
                  />
                  <span>
                    <span className="block font-semibold text-slate-800">{item.name}</span>
                    {item.department ? (
                      <span className="text-xs text-slate-400">{item.department}</span>
                    ) : null}
                  </span>
                </label>
              ))
            ) : (
              <p className="px-3 py-6 text-sm text-slate-400">
                {query.trim()
                  ? "No matches."
                  : "Nothing is configured for this scope yet."}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400">{scopeIds.length} selected</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-900">
            {(estimate?.document_count ?? 0).toLocaleString()}
          </span>{" "}
          matching documents
          {source === "employee" ? (
            <>
              {" "}
              ·{" "}
              <span className="font-semibold text-slate-900">
                {(estimate?.employee_count ?? 0).toLocaleString()}
              </span>{" "}
              employees
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
