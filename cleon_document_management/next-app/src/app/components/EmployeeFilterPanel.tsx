"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  countActiveEmployeeFilters,
  INITIAL_EMPLOYEE_FILE_FILTERS,
  LIFECYCLE_STATUS_OPTIONS,
  type EmployeeFileFilterState,
} from "../../../lib/employeeFileFilters";
import type { ComplianceTargets } from "../../../lib/types";

function FilterCheckbox({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  name: string;
}) {
  return (
    <label className="employee-filter-checkbox">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 accent-pink-600"
      />
      <span>{label}</span>
    </label>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="employee-filter-section">
      <h3 className="employee-filter-section-title">{title}</h3>
      <div className="employee-filter-options">{children}</div>
    </section>
  );
}

export default function EmployeeFilterPanel({
  filters,
  onChange,
  targets,
  searchPlaceholder = "Search name, department, grade, title...",
  showSearch = true,
}: {
  filters: EmployeeFileFilterState;
  onChange: (filters: EmployeeFileFilterState) => void;
  targets?: ComplianceTargets;
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveEmployeeFilters(filters);
  const locations = targets?.locations ?? [];
  const grades = targets?.grades ?? [];

  const update = (patch: Partial<EmployeeFileFilterState>) =>
    onChange({ ...filters, ...patch });

  const toggleLifecycle = (
    value: EmployeeFileFilterState["lifecycleStatuses"][number],
  ) => {
    const current = filters.lifecycleStatuses;
    update({
      lifecycleStatuses: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

  const toggleLocation = (id: number) => {
    const current = filters.locationIds;
    update({
      locationIds: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  };

  const toggleGrade = (id: number) => {
    const current = filters.gradeIds;
    update({
      gradeIds: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {showSearch ? (
          <label className="relative block min-w-[240px] flex-1 sm:max-w-md">
            <input
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
            />
          </label>
        ) : null}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="employee-file-filters"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange(INITIAL_EMPLOYEE_FILE_FILTERS)}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-brand-pink"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div
          id="employee-file-filters"
          className="employee-filter-panel"
          role="region"
          aria-label="Employee filters"
        >
          <FilterSection title="Employee Status">
            {LIFECYCLE_STATUS_OPTIONS.map((option) => (
              <FilterCheckbox
                key={option.value}
                name={`status-${option.value}`}
                label={option.label}
                checked={filters.lifecycleStatuses.includes(option.value)}
                onChange={() => toggleLifecycle(option.value)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Branch / Location">
            {locations.length ? (
              locations.map((location) => (
                <FilterCheckbox
                  key={location.id}
                  name={`location-${location.id}`}
                  label={location.name}
                  checked={filters.locationIds.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                />
              ))
            ) : (
              <p className="employee-filter-empty">No work locations configured.</p>
            )}
          </FilterSection>

          <FilterSection title="Grade Level">
            {grades.length ? (
              grades.map((grade) => (
                <FilterCheckbox
                  key={grade.id}
                  name={`grade-${grade.id}`}
                  label={grade.name}
                  checked={filters.gradeIds.includes(grade.id)}
                  onChange={() => toggleGrade(grade.id)}
                />
              ))
            ) : (
              <p className="employee-filter-empty">No grades configured.</p>
            )}
          </FilterSection>

          <FilterSection title="Pending Documents">
            <FilterCheckbox
              name="pending-yes"
              label="Has pending documents"
              checked={filters.pendingDocuments === "yes"}
              onChange={() =>
                update({
                  pendingDocuments:
                    filters.pendingDocuments === "yes" ? "all" : "yes",
                })
              }
            />
            <FilterCheckbox
              name="pending-no"
              label="No pending documents"
              checked={filters.pendingDocuments === "no"}
              onChange={() =>
                update({
                  pendingDocuments:
                    filters.pendingDocuments === "no" ? "all" : "no",
                })
              }
            />
          </FilterSection>
        </div>
      ) : null}
    </div>
  );
}
