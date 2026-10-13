"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search, Users } from "lucide-react";
import PolicyAudienceScopeInspector from "./PolicyAudienceScopeInspector";
import {
  dimensionResultId,
  searchPolicyAudience,
} from "../../../lib/policyAudienceSearch";
import {
  type PolicyScopeState,
  type PolicyScopeTargets,
  countEmployeesInPolicyScope,
  emptyPolicyScope,
  hasPolicyScopeFilters,
  listEmployeesInScopeDimension,
  removeEmployeeFromPolicyScope,
  toggleScopeId,
} from "../../../lib/policyScope";
import { PinkSwitchRow } from "./PinkSwitch";

type FilterDimension = {
  key: keyof PolicyScopeState;
  label: string;
  filterLabel: string;
  items: { id: number; name: string }[];
};

function buildDimensions(targets?: PolicyScopeTargets): FilterDimension[] {
  return [
    {
      key: "department_ids",
      label: "Department",
      filterLabel: "Department",
      items: targets?.departments ?? [],
    },
    {
      key: "grade_ids",
      label: "Grade",
      filterLabel: "Grade",
      items: targets?.grades ?? [],
    },
    {
      key: "work_location_ids",
      label: "Location",
      filterLabel: "Location",
      items: targets?.locations ?? [],
    },
    {
      key: "employment_type_ids",
      label: "Employment type",
      filterLabel: "Employment type",
      items: targets?.employment_types ?? [],
    },
    {
      key: "branch_ids",
      label: "Business unit",
      filterLabel: "Business unit",
      items: targets?.branches ?? [],
    },
  ];
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const searchRootRef = useRef<HTMLDivElement>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  useEffect(() => {
    if (allEmployees) {
      setSearch("");
      setSearchOpen(false);
      setExpandedGroups(new Set());
    }
  }, [allEmployees]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const node = searchRootRef.current;
      if (node && !node.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  const employeeCount = useMemo(() => {
    if (allEmployees) {
      return targets?.employees?.length ?? 0;
    }
    return countEmployeesInPolicyScope(scope, targets);
  }, [allEmployees, scope, targets]);

  const searchResults = useMemo(
    () => searchPolicyAudience(search, targets),
    [search, targets],
  );

  const showSearchPanel =
    searchOpen && !allEmployees && search.trim().length > 0;

  const canInspect = employeeCount > 0;
  const scopePercent =
    targets?.employees?.length && employeeCount > 0
      ? Math.round((employeeCount / targets.employees.length) * 100)
      : 0;
  const toggleExpanded = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleDimensionFromSearch = (
    key: keyof PolicyScopeState,
    id: number,
  ) => {
    onChange(toggleScopeId(scope, key, id));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Applies to</h2>
        {canInspect ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3.5 py-1.5 text-sm font-semibold text-brand-pink hover:bg-pink-100"
            onClick={() => setInspectOpen(true)}
          >
            Inspect scope ({employeeCount})
          </button>
        ) : null}
      </div>

      <PolicyAudienceScopeInspector
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        allEmployees={allEmployees}
        scope={scope}
        targets={targets}
        onRemoveEmployee={(employeeId) => {
          if (allEmployees) {
            onAllEmployeesChange(false);
            const employee_ids = (targets?.employees ?? [])
              .filter((employee) => employee.id !== employeeId)
              .map((employee) => employee.id);
            onChange({ ...emptyPolicyScope(), employee_ids });
            return;
          }
          onChange(removeEmployeeFromPolicyScope(employeeId, scope, targets));
        }}
      />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <PinkSwitchRow
          label="Apply to all employees"
          description={
            allEmployees
              ? "Everyone in the company is included."
              : "Off by default — search below to build a specific audience."
          }
          checked={allEmployees}
          onCheckedChange={(checked) => {
            onAllEmployeesChange(checked);
          }}
        />
      </div>

      {allEmployees ? (
        <div className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50/60 px-4 py-3 text-sm text-slate-700">
          <Users className="h-5 w-5 shrink-0 text-brand-pink" aria-hidden />
          <span>
            <span className="font-semibold text-slate-900">{employeeCount}</span>
            {employeeCount === 1 ? " employee" : " employees"} in scope
          </span>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="space-y-1.5" ref={searchRootRef}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Search employees
            </p>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search employees"
                className="field w-full bg-white pl-10"
                autoComplete="off"
              />
            </div>

            {showSearchPanel ? (
              <div
                className="max-h-[min(24rem,50vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                role="listbox"
              >
                {searchResults.dimensions.length === 0 &&
                searchResults.people.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    No departments, groups, or people match.
                  </p>
                ) : null}

                {searchResults.dimensions.length > 0 ? (
                  <div className="border-b border-slate-100 p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Groups
                    </p>
                    <ul className="space-y-0.5">
                      {searchResults.dimensions.map((hit) => {
                        const groupId = dimensionResultId(hit.key, hit.id);
                        const expanded = expandedGroups.has(groupId);
                        const selected = scope[hit.key].includes(hit.id);
                        const members = listEmployeesInScopeDimension(
                          hit.key,
                          hit.id,
                          targets,
                        );
                        return (
                          <li key={groupId} className="rounded-lg">
                            <div className="flex items-stretch gap-0.5">
                              <button
                                type="button"
                                className="flex shrink-0 items-center px-2 text-slate-500 hover:text-slate-800"
                                onClick={() => toggleExpanded(groupId)}
                                aria-expanded={expanded}
                                aria-label={
                                  expanded ? "Collapse members" : "Show members"
                                }
                              >
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                className={`min-w-0 flex-1 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-pink-50 ${
                                  selected ? "bg-pink-50/90" : ""
                                }`}
                                onClick={() =>
                                  toggleDimensionFromSearch(hit.key, hit.id)
                                }
                              >
                                <span className="font-semibold text-slate-900">
                                  {hit.label}
                                  {selected ? (
                                    <span className="ml-2 text-xs font-semibold text-brand-pink">
                                      Added
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {hit.dimensionLabel} ·{" "}
                                  {hit.memberCount === 1
                                    ? "1 person"
                                    : `${hit.memberCount} people`}
                                </span>
                              </button>
                            </div>
                            {expanded ? (
                              <ul className="mb-2 ml-9 mr-2 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-1">
                                {members.length === 0 ? (
                                  <li className="px-2 py-2 text-xs text-slate-400">
                                    No employees in this group.
                                  </li>
                                ) : (
                                  members.map((emp) => (
                                    <li
                                      key={emp.id}
                                      className="rounded-md px-2 py-1.5 text-xs text-slate-700"
                                    >
                                      <span className="font-medium text-slate-800">
                                        {emp.name}
                                      </span>
                                      {emp.job_title ? (
                                        <span className="text-slate-500">
                                          {" "}
                                          · {emp.job_title}
                                        </span>
                                      ) : null}
                                    </li>
                                  ))
                                )}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {searchResults.people.length > 0 ? (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      People
                    </p>
                    <ul className="space-y-0.5">
                      {searchResults.people.map((person) => {
                        const selected = scope.employee_ids.includes(person.id);
                        return (
                          <li key={person.id}>
                            <button
                              type="button"
                              className={`flex w-full flex-col rounded-lg px-3 py-2.5 text-left text-sm hover:bg-pink-50 ${
                                selected ? "bg-pink-50/90" : ""
                              }`}
                              onClick={() => {
                                onChange(
                                  toggleScopeId(
                                    scope,
                                    "employee_ids",
                                    person.id,
                                  ),
                                );
                              }}
                            >
                              <span className="font-medium text-slate-800">
                                {person.name}
                                {selected ? (
                                  <span className="ml-2 text-xs font-semibold text-brand-pink">
                                    Added
                                  </span>
                                ) : null}
                              </span>
                              {person.subtitle ? (
                                <span className="text-xs text-slate-500">
                                  {person.subtitle}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {!hasPolicyScopeFilters(scope) ? (
            <p className="text-sm text-slate-600">
              Search to add people or groups to this audience. Group selections
              include everyone in that group.
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Estimated scope:{" "}
            <span className="font-semibold text-slate-900">{employeeCount}</span>
            {employeeCount === 1 ? " employee" : " employees"}
            {allEmployees && targets?.employees?.length ? (
              <span className="text-slate-500"> (100% of company)</span>
            ) : null}
          </span>
          {!allEmployees && !hasPolicyScopeFilters(scope) ? (
            <span className="text-xs font-medium text-amber-700">
              Add criteria to continue
            </span>
          ) : null}
        </div>
        {!allEmployees &&
        employeeCount > 0 &&
        targets?.employees?.length ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 sm:w-36">
              <div
                className="h-full rounded-full bg-brand-pink transition-all"
                style={{ width: `${Math.min(100, scopePercent)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500">
              {scopePercent}% of total
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function policyScopeIsAllEmployees(scope: PolicyScopeState): boolean {
  return !hasPolicyScopeFilters(scope);
}
