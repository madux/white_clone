"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Search, Users } from "lucide-react";
import PolicyAudienceScopeInspector from "./PolicyAudienceScopeInspector";
import PolicyAudienceSmartSearch from "./PolicyAudienceSmartSearch";
import {
  type PolicyScopeState,
  type PolicyScopeTargets,
  countEmployeesInPolicyScope,
  emptyPolicyScope,
  hasPolicyScopeFilters,
  removeEmployeeFromPolicyScope,
} from "../../../lib/policyScope";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const APPLIES_TO_HELP =
  "If you do not pick any departments, groups, or individuals, this rule applies to all employees in the directory. Use smart search to narrow the audience.";

function AppliesToHelpIcon() {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/30"
        aria-label="How audience selection works"
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[280px] text-left leading-snug">
        {APPLIES_TO_HELP}
      </TooltipContent>
    </Tooltip>
  );
}

export function PolicyAudienceFilters({
  scope,
  onChange,
  targets,
  hideTitle = false,
}: {
  scope: PolicyScopeState;
  onChange: (scope: PolicyScopeState) => void;
  targets?: PolicyScopeTargets;
  hideTitle?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  const audienceIsAll = !hasPolicyScopeFilters(scope);

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
    if (audienceIsAll) {
      return targets?.employees?.length ?? 0;
    }
    return countEmployeesInPolicyScope(scope, targets);
  }, [audienceIsAll, scope, targets]);

  const showSearchPanel = searchOpen;

  const canInspect = employeeCount > 0;
  const scopePercent =
    targets?.employees?.length && employeeCount > 0
      ? Math.round((employeeCount / targets.employees.length) * 100)
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hideTitle ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
            Audience filters
            <AppliesToHelpIcon />
          </span>
        ) : (
          <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-slate-900">
            Applies to
            <AppliesToHelpIcon />
          </h2>
        )}
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
        allEmployees={audienceIsAll}
        scope={scope}
        targets={targets}
        onRemoveEmployee={(employeeId) => {
          if (audienceIsAll) {
            const employee_ids = (targets?.employees ?? [])
              .filter((employee) => employee.id !== employeeId)
              .map((employee) => employee.id);
            onChange({ ...emptyPolicyScope(), employee_ids });
            return;
          }
          onChange(removeEmployeeFromPolicyScope(employeeId, scope, targets));
        }}
      />

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        {audienceIsAll ? (
          <div className="flex items-center gap-3 rounded-xl border border-pink-100 bg-pink-50/60 px-4 py-3 text-sm text-slate-700">
            <Users className="h-5 w-5 shrink-0 text-brand-pink" aria-hidden />
            <span>
              <span className="font-semibold text-slate-900">All employees</span>
              {targets?.employees?.length ? (
                <>
                  {" "}
                  —{" "}
                  <span className="font-semibold text-slate-900">
                    {targets.employees.length}
                  </span>
                  {targets.employees.length === 1 ? " person" : " people"} in the
                  directory. Search below to limit who this applies to.
                </>
              ) : (
                " — search below to limit who this applies to."
              )}
            </span>
          </div>
        ) : null}

        <div className="space-y-1.5" ref={searchRootRef}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Smart search
          </p>
          {!showSearchPanel ? (
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
                placeholder="Search departments, groups, and employees…"
                className="field w-full bg-white pl-10"
                autoComplete="off"
              />
            </div>
          ) : null}

          {showSearchPanel ? (
            <PolicyAudienceSmartSearch
              scope={scope}
              onChange={onChange}
              targets={targets}
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setSearchOpen(true);
              }}
              onDone={() => setSearchOpen(false)}
            />
          ) : null}
        </div>

        {audienceIsAll ? (
          <p className="text-sm text-slate-600">
            No audience filters selected. This rule applies to everyone unless you
            pick departments, groups, or individuals above.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Estimated scope:{" "}
            <span className="font-semibold text-slate-900">{employeeCount}</span>
            {employeeCount === 1 ? " employee" : " employees"}
            {audienceIsAll && targets?.employees?.length ? (
              <span className="text-slate-500"> (all employees)</span>
            ) : null}
          </span>
        </div>
        {!audienceIsAll && employeeCount > 0 && targets?.employees?.length ? (
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
