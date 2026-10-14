"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";
import {
  type AudienceDimensionHit,
  type AudienceSearchFilterTab,
  dimensionResultId,
  searchPolicyAudience,
} from "../../../lib/policyAudienceSearch";
import {
  type PolicyScopeState,
  type PolicyScopeTargets,
  countEmployeesPickedInDimension,
  countUniqueDirectoryMembersInScope,
  isEmployeeInPolicyScope,
  listEmployeesInScopeDimension,
  pickAllEmployeesInDimension,
  pickScopeDimension,
  toggleEmployeeInPolicyScope,
  unpickAllEmployeesInDimension,
  unpickScopeDimension,
} from "../../../lib/policyScope";
import { cn } from "@/lib/utils";

function memberMatchesSearch(
  employee: NonNullable<PolicyScopeTargets["employees"]>[number],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    employee.name,
    employee.job_title,
    employee.work_email,
    employee.department,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => word.length > 0 && hay.includes(word));
}

function DimensionRow({
  hit,
  scope,
  targets,
  searchQuery,
  expanded,
  onToggleExpand,
  onChange,
}: {
  hit: AudienceDimensionHit;
  scope: PolicyScopeState;
  targets?: PolicyScopeTargets;
  searchQuery: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (scope: PolicyScopeState) => void;
}) {
  const dimensionSelected = scope[hit.key].includes(hit.id);
  const members = useMemo(
    () =>
      listEmployeesInScopeDimension(hit.key, hit.id, targets).filter((row) =>
        memberMatchesSearch(row, searchQuery),
      ),
    [hit.id, hit.key, searchQuery, targets],
  );
  const { picked, total } = countEmployeesPickedInDimension(
    hit.key,
    hit.id,
    scope,
    targets,
    (row) => memberMatchesSearch(row, searchQuery),
  );

  const pickDepartment = () => {
    if (dimensionSelected) {
      onChange(unpickScopeDimension(scope, hit.key, hit.id, targets));
      return;
    }
    onChange(pickScopeDimension(scope, hit.key, hit.id, targets));
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-2 p-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-pink focus:ring-brand-pink/30"
          checked={dimensionSelected}
          onChange={pickDepartment}
          aria-label={`Select ${hit.label}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-left text-sm font-bold text-slate-900 hover:text-brand-pink"
              onClick={onToggleExpand}
            >
              {hit.label}
            </button>
            <span className="rounded-md bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-pink">
              {hit.abbrev}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {hit.memberCount === 1
                ? "1 employee"
                : `${hit.memberCount} employees`}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{hit.description}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-pink/40 hover:bg-pink-50"
          onClick={pickDepartment}
        >
          {dimensionSelected ? "Unpick" : `+ Pick ${hit.dimensionLabel}`}
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">
              Employees in {hit.label} ({picked} of {total} picked)
            </p>
            <div className="flex gap-3 text-xs font-semibold">
              <button
                type="button"
                className="text-brand-pink hover:underline disabled:opacity-40"
                disabled={!total || picked === total}
                onClick={() =>
                  onChange(
                    pickAllEmployeesInDimension(
                      scope,
                      hit.key,
                      hit.id,
                      targets,
                      (row) => memberMatchesSearch(row, searchQuery),
                    ),
                  )
                }
              >
                Pick All
              </button>
              <button
                type="button"
                className="text-slate-500 hover:underline disabled:opacity-40"
                disabled={picked === 0}
                onClick={() =>
                  onChange(
                    unpickAllEmployeesInDimension(
                      scope,
                      hit.key,
                      hit.id,
                      targets,
                      (row) => memberMatchesSearch(row, searchQuery),
                    ),
                  )
                }
              >
                Unpick All
              </button>
            </div>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-slate-400">No employees match your search.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {members.map((employee) => {
                const inScope = isEmployeeInPolicyScope(
                  employee.id,
                  scope,
                  targets,
                );
                return (
                  <li key={employee.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-sm transition",
                        inScope
                          ? "border-violet-200 bg-violet-50/80"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-pink focus:ring-brand-pink/30"
                        checked={inScope}
                        onChange={() =>
                          onChange(
                            toggleEmployeeInPolicyScope(
                              employee.id,
                              scope,
                              targets,
                            ),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-900">
                          {employee.name}
                        </span>
                        {employee.job_title ? (
                          <span className="block truncate text-xs text-slate-500">
                            {employee.job_title}
                          </span>
                        ) : null}
                      </span>
                      {!inScope ? (
                        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          Excluded
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

function FilterPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
        active
          ? "bg-brand-pink text-white shadow-sm"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-pink-200",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px]",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function PolicyAudienceSmartSearch({
  scope,
  onChange,
  targets,
  search,
  onSearchChange,
  onDone,
}: {
  scope: PolicyScopeState;
  onChange: (scope: PolicyScopeState) => void;
  targets?: PolicyScopeTargets;
  search: string;
  onSearchChange: (value: string) => void;
  onDone?: () => void;
}) {
  const [filterTab, setFilterTab] = useState<AudienceSearchFilterTab>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const results = useMemo(
    () => searchPolicyAudience(search, targets),
    [search, targets],
  );

  const scopeCount = countUniqueDirectoryMembersInScope(scope, targets);

  const showDepartments =
    filterTab === "all" || filterTab === "departments";
  const showGroups = filterTab === "all" || filterTab === "groups";
  const showPeople = filterTab === "all" || filterTab === "employees";

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const empty =
    results.counts.all === 0 && search.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search departments, groups, and employees…"
            className="field w-full bg-slate-50/80 pl-10"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Filter:
        </span>
        <FilterPill
          active={filterTab === "all"}
          label="All Results"
          count={results.counts.all}
          onClick={() => setFilterTab("all")}
        />
        <FilterPill
          active={filterTab === "departments"}
          label="Departments"
          count={results.counts.departments}
          onClick={() => setFilterTab("departments")}
        />
        <FilterPill
          active={filterTab === "groups"}
          label="Groups"
          count={results.counts.groups}
          onClick={() => setFilterTab("groups")}
        />
        <FilterPill
          active={filterTab === "employees"}
          label="Employees"
          count={results.counts.employees}
          onClick={() => setFilterTab("employees")}
        />
      </div>

      <div className="max-h-[min(28rem,55vh)] overflow-y-auto px-3 py-3">
        {empty ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No departments, groups, or employees match.
          </p>
        ) : null}

        {showDepartments && results.departments.length > 0 ? (
          <section className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Users className="h-3.5 w-3.5 text-brand-pink" aria-hidden />
                Departments ({results.departments.length})
              </h3>
              <span className="text-[10px] font-medium text-slate-400">
                Click to pick all employees in department
              </span>
            </div>
            <ul className="space-y-2">
              {results.departments.map((hit) => {
                const groupId = dimensionResultId(hit.key, hit.id);
                return (
                  <DimensionRow
                    key={groupId}
                    hit={hit}
                    scope={scope}
                    targets={targets}
                    searchQuery={search}
                    expanded={expandedGroups.has(groupId)}
                    onToggleExpand={() => toggleExpanded(groupId)}
                    onChange={onChange}
                  />
                );
              })}
            </ul>
          </section>
        ) : null}

        {showGroups && results.groups.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Groups ({results.groups.length})
            </h3>
            <ul className="space-y-2">
              {results.groups.map((hit) => {
                const groupId = dimensionResultId(hit.key, hit.id);
                return (
                  <DimensionRow
                    key={groupId}
                    hit={hit}
                    scope={scope}
                    targets={targets}
                    searchQuery={search}
                    expanded={expandedGroups.has(groupId)}
                    onToggleExpand={() => toggleExpanded(groupId)}
                    onChange={onChange}
                  />
                );
              })}
            </ul>
          </section>
        ) : null}

        {showPeople && results.people.length > 0 ? (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Employees ({results.people.length})
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.people.map((person) => {
                const inScope = isEmployeeInPolicyScope(person.id, scope, targets);
                return (
                  <li key={person.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-sm transition",
                        inScope
                          ? "border-violet-200 bg-violet-50/80"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-pink focus:ring-brand-pink/30"
                        checked={inScope}
                        onChange={() =>
                          onChange(
                            toggleEmployeeInPolicyScope(person.id, scope, targets),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-900">
                          {person.name}
                        </span>
                        {person.subtitle ? (
                          <span className="block truncate text-xs text-slate-500">
                            {person.subtitle}
                          </span>
                        ) : null}
                      </span>
                      {!inScope ? (
                        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          Excluded
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {!empty &&
        ((showDepartments && results.departments.length === 0) ||
          (showGroups && results.groups.length === 0) ||
          (showPeople && results.people.length === 0)) &&
        filterTab !== "all" ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No matches in this category.
          </p>
        ) : null}

        {!empty && search.trim().length === 0 && results.counts.all === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Type to search, or browse using the filters above.
          </p>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-sm text-slate-600">
          Scope now:{" "}
          <span className="font-semibold text-slate-900">{scopeCount}</span>
          {scopeCount === 1 ? " employee" : " employees"}
          <span className="text-slate-500">
            {" "}
            ({scopeCount} unique directory member
            {scopeCount === 1 ? "" : "s"})
          </span>
        </p>
        {onDone ? (
          <button
            type="button"
            className="rounded-full bg-brand-pink px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-pink/90"
            onClick={onDone}
          >
            Done searching
          </button>
        ) : null}
      </footer>
    </div>
  );
}
