"use client";

import { Building2, Check, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { employeeFileDimensionLabel } from "../../../lib/employeeFileDimensions";
import type { EmsEmployeeOption } from "../../../lib/types";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

export type MetricEmployee = {
  id: number;
  name: string;
  department_name?: string;
  employment_type?: string;
  work_location?: string;
  job_title?: string;
  status?: string;
  branch?: string;
  grade?: string;
};

export const METRIC_FIELDS = [
  { key: "department", label: "Department", field: "department_name" },
  { key: "employment_type", label: "Employment type", field: "employment_type" },
  { key: "work_location", label: "Location", field: "work_location" },
  { key: "job_title", label: "Job title", field: "job_title" },
  { key: "status", label: "Status", field: "status" },
  { key: "branch", label: "Branch", field: "branch" },
  { key: "grade", label: "Grade", field: "grade" },
] as const;

export function metricSearchHaystack(employee: MetricEmployee) {
  return METRIC_FIELDS.map((field) =>
    String(employee[field.field] || ""),
  )
    .concat(employee.name || "")
    .join(" ")
    .toLowerCase();
}

export function employeeMatchesMetricQuery(
  employee: MetricEmployee,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return metricSearchHaystack(employee).includes(needle);
}

export function groupMetricResults(employees: MetricEmployee[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const groups: {
    key: string;
    dimension: string;
    dimensionKey: string;
    label: string;
    employees: MetricEmployee[];
  }[] = [];
  for (const dim of METRIC_FIELDS) {
    const byValue = new Map<string, MetricEmployee[]>();
    for (const employee of employees) {
      const value = String(employee[dim.field] || "").trim();
      if (!value || !value.toLowerCase().includes(needle)) continue;
      const current = byValue.get(value) ?? [];
      current.push(employee);
      byValue.set(value, current);
    }
    for (const [value, members] of byValue) {
      groups.push({
        key: `${dim.key}:${value}`,
        dimension: dim.label,
        dimensionKey: dim.key,
        label: value,
        employees: members,
      });
    }
  }
  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

function fromEms(row: EmsEmployeeOption): MetricEmployee {
  return {
    id: row.id,
    name: row.name,
    department_name: row.department_name,
    employment_type: row.employment_type,
    work_location: row.work_location,
    job_title: row.job_title,
    status: row.status || (row.active === false ? "Inactive" : "Active"),
    branch: row.branch,
    grade: row.grade,
  };
}

export default function EmployeeMetricPicker({
  selectedIds,
  onChange,
  employees,
  mode = "multiple",
  placeholder = "Search employees, departments, or other EMS metrics…",
  disabledIds,
}: {
  selectedIds: number[];
  onChange: (ids: number[], selected: MetricEmployee[]) => void;
  employees?: MetricEmployee[];
  mode?: "single" | "multiple";
  placeholder?: string;
  disabledIds?: number[];
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<MetricEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (employees) return;
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      api
        .listEmsEmployees(query.trim() || undefined)
        .then((rows) => {
          if (!cancelled) setRemote(rows.map(fromEms));
        })
        .catch((caught: Error) => {
          if (!cancelled) setError(caught.message || "Unable to load employees.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [employees, query]);

  const source = employees ?? remote;
  const visibleEmployees = useMemo(
    () => source.filter((employee) => employeeMatchesMetricQuery(employee, query)),
    [query, source],
  );
  const groups = useMemo(
    () => groupMetricResults(source, query),
    [query, source],
  );
  const blocked = useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const applyIds = (ids: number[], extra: MetricEmployee[] = []) => {
    const known = new Map(
      [...source, ...extra].map((employee) => [employee.id, employee]),
    );
    const unique = Array.from(new Set(ids)).filter((id) => !blocked.has(id));
    onChange(
      unique,
      unique.map((id) => known.get(id)).filter(Boolean) as MetricEmployee[],
    );
  };

  const toggleEmployee = (employee: MetricEmployee) => {
    if (blocked.has(employee.id)) return;
    if (mode === "single") {
      applyIds([employee.id], [employee]);
      return;
    }
    applyIds(
      selectedSet.has(employee.id)
        ? selectedIds.filter((id) => id !== employee.id)
        : [...selectedIds, employee.id],
      [employee],
    );
  };

  const toggleGroup = (groupEmployees: MetricEmployee[]) => {
    const ids = groupEmployees
      .map((employee) => employee.id)
      .filter((id) => !blocked.has(id));
    if (mode === "single") {
      setExpandedGroup(null);
      applyIds(ids.slice(0, 1), groupEmployees);
      return;
    }
    const allSelected = ids.every((id) => selectedSet.has(id));
    applyIds(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids])),
      groupEmployees,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-[220px] flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
        </InputGroup>
        {mode === "multiple" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const ids = visibleEmployees
                .map((employee) => employee.id)
                .filter((id) => !blocked.has(id));
              const allSelected =
                ids.length > 0 && ids.every((id) => selectedSet.has(id));
              applyIds(
                allSelected
                  ? selectedIds.filter((id) => !ids.includes(id))
                  : Array.from(new Set([...selectedIds, ...ids])),
                visibleEmployees,
              );
            }}
          >
            {visibleEmployees.length &&
            visibleEmployees
              .filter((employee) => !blocked.has(employee.id))
              .every((employee) => selectedSet.has(employee.id))
              ? "Clear all"
              : "Select all"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-500">Searching employees…</p>
      ) : null}
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
        {groups.length ? (
          <div>
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Metric groups
            </p>
            {groups.map((group) => {
              const ids = group.employees
                .map((employee) => employee.id)
                .filter((id) => !blocked.has(id));
              const allSelected =
                ids.length > 0 && ids.every((id) => selectedSet.has(id));
              const open = expandedGroup === group.key;
              return (
                <div key={group.key} className="rounded-md">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroup(open ? null : group.key)
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-brand-pink" />
                      <span className="min-w-0 truncate font-semibold text-slate-800">
                        {group.label}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {employeeFileDimensionLabel(group.dimensionKey)} ·{" "}
                        {group.employees.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.employees)}
                      className="app-btn app-btn-secondary !px-2 !py-1 text-xs"
                    >
                      {allSelected ? "Clear" : "Select all"}
                    </button>
                  </div>
                  {open
                    ? group.employees.map((employee) => (
                        <EmployeeRow
                          key={`${group.key}-${employee.id}`}
                          employee={employee}
                          selected={selectedSet.has(employee.id)}
                          disabled={blocked.has(employee.id)}
                          onToggle={() => toggleEmployee(employee)}
                          nested
                        />
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        ) : null}
        <div>
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Employees
          </p>
          {visibleEmployees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              selected={selectedSet.has(employee.id)}
              disabled={blocked.has(employee.id)}
              onToggle={() => toggleEmployee(employee)}
            />
          ))}
          {!visibleEmployees.length && !loading ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              No employees match this search.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmployeeRow({
  employee,
  selected,
  disabled,
  onToggle,
  nested = false,
}: {
  employee: MetricEmployee;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-pink-50 disabled:opacity-50 ${
        nested ? "pl-8" : ""
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          selected
            ? "border-brand-pink bg-brand-pink text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
      <Users className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-800">
          {employee.name}
        </span>
        <span className="block truncate text-xs text-slate-400">
          {[
            employee.job_title,
            employee.department_name,
            employee.employment_type,
            employee.work_location,
          ]
            .filter(Boolean)
            .join(" · ") || "Employee"}
        </span>
      </span>
    </button>
  );
}
