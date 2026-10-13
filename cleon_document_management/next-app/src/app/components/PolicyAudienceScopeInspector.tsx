"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  MapPin,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  type PolicyScopeState,
  type PolicyScopeTargets,
  listEmployeesInPolicyScope,
} from "../../../lib/policyScope";

type ScopeEmployee = NonNullable<PolicyScopeTargets["employees"]>[number];

const SCOPE_PANEL_ANIMATION_MS = 300;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function employeeLocation(employee: ScopeEmployee) {
  const loc =
    "work_location" in employee && typeof employee.work_location === "string"
      ? employee.work_location
      : "";
  const legacy =
    "location" in employee && typeof employee.location === "string"
      ? employee.location
      : "";
  return (loc || legacy).trim();
}

function gradeBadge(employee: ScopeEmployee) {
  const grade =
    "grade" in employee && typeof employee.grade === "string"
      ? employee.grade.trim()
      : "";
  if (grade) return grade;
  const title = (employee.job_title || "").trim();
  if (!title) return null;
  if (title.length <= 28) return title;
  return `${title.slice(0, 25)}…`;
}

export default function PolicyAudienceScopeInspector({
  open,
  onClose,
  allEmployees,
  scope,
  targets,
  onRemoveEmployee,
}: {
  open: boolean;
  onClose: () => void;
  allEmployees: boolean;
  scope: PolicyScopeState;
  targets?: PolicyScopeTargets;
  onRemoveEmployee: (employeeId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "all">("all");
  const [rendered, setRendered] = useState(open);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setActive(false);
    const timeout = window.setTimeout(
      () => setRendered(false),
      SCOPE_PANEL_ANIMATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [open]);

  const matched = useMemo(
    () =>
      listEmployeesInPolicyScope(scope, targets, { allEmployees }),
    [allEmployees, scope, targets],
  );

  const departmentOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const emp of matched) {
      const id = emp.department_id;
      if (typeof id === "number" && id > 0) {
        byId.set(id, emp.department || `Department #${id}`);
      }
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matched.filter((employee) => {
      if (departmentId !== "all") {
        const deptId = employee.department_id;
        if (typeof deptId !== "number" || deptId !== departmentId) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [
        employee.name,
        employee.job_title,
        employee.work_email,
        employee.department,
        "grade" in employee ? employee.grade : "",
        employeeLocation(employee),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [departmentId, matched, query]);

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        type="button"
        className={`flex-1 cursor-default ${active ? "" : "pointer-events-none"}`}
        aria-label="Close eligible audience scope"
        onClick={onClose}
      />
      <aside
        className={`flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out will-change-transform ${
          active ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-audience-scope-title"
      >
        <header className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-brand-pink"
                aria-hidden
              >
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2
                  id="policy-audience-scope-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Eligible audience scope
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {matched.length === 1
                    ? "1 matched team member based on criteria"
                    : `${matched.length} matched team members based on criteria`}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-3 border-b border-slate-100 px-5 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees"
              className="field w-full pl-10"
              autoComplete="off"
            />
          </div>
          {departmentOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDepartmentId("all")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  departmentId === "all"
                    ? "bg-brand-pink text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-pink-200"
                }`}
              >
                All departments
              </button>
              {departmentOptions.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setDepartmentId(dept.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    departmentId === dept.id
                      ? "bg-brand-pink text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-pink-200"
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No team members match your filters.
            </p>
          ) : (
            <ul className="space-y-2 py-1">
              {filtered.map((employee) => {
                const badge = gradeBadge(employee);
                const location = employeeLocation(employee);
                return (
                  <li
                    key={employee.id}
                    className="group relative rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 pr-8 transition hover:border-slate-200 hover:bg-white"
                  >
                    <button
                      type="button"
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity hover:border-red-200 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Remove ${employee.name} from scope`}
                      onClick={() => onRemoveEmployee(employee.id)}
                    >
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                    <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-pink-50 text-xs font-bold text-brand-pink">
                        {initialsFromName(employee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {employee.name}
                        </span>
                        {badge ? (
                          <span
                            className="rounded-md bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-pink"
                          >
                            {badge}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {employee.job_title ? (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
                            {employee.job_title}
                          </span>
                        ) : null}
                        {location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            {location}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-sm text-slate-600">
            {filtered.length === matched.length ? (
              <>
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {matched.length}
                </span>{" "}
                matched {matched.length === 1 ? "member" : "members"}
              </>
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {filtered.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-900">
                  {matched.length}
                </span>{" "}
                matched members
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}
