"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import ThemedSelect from "./ThemedSelect";
import FilterToggleButton from "./FilterToggleButton";
import {
  type PolicyScopeState,
  type PolicyScopeTargets,
  countEmployeesInPolicyScope,
  hasPolicyScopeFilters,
  removeScopeId,
  toggleScopeId,
} from "../../../lib/policyScope";

type FilterDimension = {
  key: keyof PolicyScopeState;
  label: string;
  filterLabel: string;
  group: "groups" | "filters";
  items: { id: number; name: string }[];
};

function buildDimensions(targets?: PolicyScopeTargets): FilterDimension[] {
  return [
    {
      key: "department_ids",
      label: "Department",
      filterLabel: "Department",
      group: "groups",
      items: targets?.departments ?? [],
    },
    {
      key: "grade_ids",
      label: "Grade",
      filterLabel: "Grade",
      group: "groups",
      items: targets?.grades ?? [],
    },
    {
      key: "work_location_ids",
      label: "Location",
      filterLabel: "Location",
      group: "filters",
      items: targets?.locations ?? [],
    },
    {
      key: "employment_type_ids",
      label: "Employment type",
      filterLabel: "Employment type",
      group: "filters",
      items: targets?.employment_types ?? [],
    },
    {
      key: "branch_ids",
      label: "Business unit",
      filterLabel: "Business unit",
      group: "filters",
      items: targets?.branches ?? [],
    },
  ];
}

function Pill({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-0.5 text-xs font-medium text-pink-900"
    >
      <span className="truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          className="shrink-0 rounded-full p-0.5 text-pink-600 hover:bg-pink-100"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

function FilterPickerPanel({
  dimension,
  selected,
  onToggle,
  onClose,
}: {
  dimension: FilterDimension;
  selected: number[];
  onToggle: (id: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = dimension.items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
      role="dialog"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">
          {dimension.label}
        </span>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-800"
          onClick={onClose}
        >
          Done
        </button>
      </div>
      <div className="relative mb-2">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${dimension.label.toLowerCase()}...`}
          className="field pl-10"
        />
      </div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400">No matches.</p>
        ) : (
          filtered.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-pink-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 accent-pink-600 rounded"
              />
              <span className="truncate text-slate-800">{item.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function PolicyAudienceFilters({
  scope,
  onChange,
  targets,
  allEmployees,
  onAllEmployeesChange,
}: {
  scope: PolicyScopeState;
  onChange: (scope: PolicyScopeState) => void;
  targets?: PolicyScopeTargets;
  allEmployees: boolean;
  onAllEmployeesChange: (all: boolean) => void;
}) {
  const dimensions = buildDimensions(targets);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeDimension, setActiveDimension] = useState<FilterDimension | null>(
    null,
  );
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (allEmployees) {
      setSearch("");
      setFilterOpen(false);
      setActiveDimension(null);
    }
  }, [allEmployees]);

  const employeeCount = useMemo(() => {
    if (allEmployees) {
      return targets?.employees?.length ?? 0;
    }
    return countEmployeesInPolicyScope(scope, targets);
  }, [allEmployees, scope, targets]);

  const groupPills = useMemo(() => {
    const pills: { key: keyof PolicyScopeState; id: number; label: string }[] =
      [];
    for (const dim of dimensions.filter((d) => d.group === "groups")) {
      for (const id of scope[dim.key]) {
        const name =
          dim.items.find((item) => item.id === id)?.name || `#${id}`;
        pills.push({ key: dim.key, id, label: name });
      }
    }
    for (const id of scope.employee_ids) {
      const emp = targets?.employees?.find((e) => e.id === id);
      pills.push({
        key: "employee_ids",
        id,
        label: emp?.name || `#${id}`,
      });
    }
    return pills;
  }, [dimensions, scope, targets]);

  const filterPills = useMemo(() => {
    const pills: { key: keyof PolicyScopeState; id: number; label: string }[] =
      [];
    for (const dim of dimensions.filter((d) => d.group === "filters")) {
      for (const id of scope[dim.key]) {
        const name =
          dim.items.find((item) => item.id === id)?.name || `#${id}`;
        pills.push({
          key: dim.key,
          id,
          label: `${dim.filterLabel}: ${name}`,
        });
      }
    }
    return pills;
  }, [dimensions, scope]);

  const searchHits = useMemo(() => {
    if (!search.trim() || allEmployees) return [];
    const q = search.toLowerCase();
    return (targets?.employees ?? [])
      .filter((emp) => {
        const hay = [
          emp.name,
          emp.department,
          emp.job_title,
          emp.work_email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [search, targets, allEmployees]);

  const visibleGroupPills = groupPills.slice(0, 2);
  const hiddenGroupCount = Math.max(0, groupPills.length - 2);

  const audienceSelect = (
    <div className="w-full sm:w-44 shrink-0 [&_[data-slot=select-trigger]]:h-8">
      <ThemedSelect
        value={allEmployees ? "all" : "filtered"}
        onChange={(value) => {
          onAllEmployeesChange(value === "all");
        }}
        options={[
          { value: "all", label: "All Employees" },
          { value: "filtered", label: "Specific audience" },
        ]}
      />
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {allEmployees ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            This rule applies to all employees in the company.
          </p>
          {audienceSelect}
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="field w-full pl-10"
            />
            {searchHits.length > 0 ? (
              <ul
                className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md"
              >
                {searchHits.map((emp) => {
                  const selected = scope.employee_ids.includes(emp.id);
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-pink-50"
                        onClick={() => {
                          onChange(
                            toggleScopeId(scope, "employee_ids", emp.id),
                          );
                          setSearch("");
                        }}
                      >
                        <span className="font-medium text-slate-800">
                          {emp.name}
                          {selected ? " ✓" : ""}
                        </span>
                        <span className="text-xs text-slate-500">
                          {[emp.department, emp.job_title]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <div className="relative shrink-0" ref={filterRef}>
            <FilterToggleButton
              onClick={() => {
                setFilterOpen((open) => !open);
                setActiveDimension(null);
              }}
              aria-expanded={filterOpen}
            />
            {filterOpen ? (
              activeDimension ? (
                <FilterPickerPanel
                  dimension={activeDimension}
                  selected={scope[activeDimension.key]}
                  onToggle={(id) =>
                    onChange(toggleScopeId(scope, activeDimension.key, id))
                  }
                  onClose={() => setActiveDimension(null)}
                />
              ) : (
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                  {dimensions.map((dim) => (
                    <button
                      key={dim.key}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-800 hover:bg-pink-50"
                      onClick={() => setActiveDimension(dim)}
                    >
                      <span>{dim.label}</span>
                      {scope[dim.key].length > 0 ? (
                        <span className="rounded-full bg-pink-100 px-1.5 text-xs text-pink-800">
                          {scope[dim.key].length}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )
            ) : null}
          </div>
          {audienceSelect}
        </div>
      )}

      {!allEmployees ? (
        <>
          {groupPills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {visibleGroupPills.map((pill) => (
                <Pill
                  key={`${pill.key}-${pill.id}`}
                  label={pill.label}
                  onRemove={() =>
                    onChange(removeScopeId(scope, pill.key, pill.id))
                  }
                />
              ))}
              {hiddenGroupCount > 0 ? (
                <span className="text-xs font-medium text-pink-700">
                  +{hiddenGroupCount} more
                </span>
              ) : null}
            </div>
          ) : null}

          {filterPills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Filters:</span>
              {filterPills.map((pill) => (
                <Pill
                  key={`${pill.key}-${pill.id}`}
                  label={pill.label}
                  onRemove={() =>
                    onChange(removeScopeId(scope, pill.key, pill.id))
                  }
                />
              ))}
            </div>
          ) : null}

          {!hasPolicyScopeFilters(scope) ? (
            <p className="text-xs text-slate-500">
              Use <strong>Filter</strong> for departments, grades, locations, and
              more, or search to add individuals.
            </p>
          ) : null}
        </>
      ) : null}

      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{employeeCount}</span>{" "}
        employee{employeeCount === 1 ? "" : "s"} in scope
      </p>
    </div>
  );
}

export function policyScopeIsAllEmployees(scope: PolicyScopeState): boolean {
  return !hasPolicyScopeFilters(scope);
}
