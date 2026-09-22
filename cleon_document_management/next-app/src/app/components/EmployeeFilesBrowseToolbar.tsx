"use client";

import { Grid2X2, List, Search, SlidersHorizontal, X } from "lucide-react";
import SectionTabs from "./SectionTabs";
import type { EmployeeFilesBrowseFilters } from "../../../lib/employeeFilesBrowsePreferences";
import {
  DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS,
  type EmployeeFilesDocumentColumnId,
  type EmployeeFilesEmployeeColumnId,
  EMPLOYEE_FILES_DOCUMENT_COLUMNS,
  EMPLOYEE_FILES_EMPLOYEE_COLUMNS,
  type EmployeeFilesLayoutMode,
} from "../../../lib/employeeFilesBrowsePreferences";

const DOCUMENT_CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "hr", label: "Human Resources" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
  { value: "identity", label: "Identity" },
  { value: "employment", label: "Employment" },
  { value: "medical", label: "Medical" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "expiring_30", label: "Expiring in 30 days" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "employee", label: "Employee Files" },
  { value: "organizational", label: "Organizational Files" },
];

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  layoutMode: EmployeeFilesLayoutMode;
  onLayoutModeChange: (mode: EmployeeFilesLayoutMode) => void;
  showDocumentFilters?: boolean;
  showEmployeeFilters?: boolean;
  documentFilters?: EmployeeFilesBrowseFilters;
  onDocumentFiltersChange?: (filters: EmployeeFilesBrowseFilters) => void;
  employeeDepartmentId?: string;
  onEmployeeDepartmentChange?: (value: string) => void;
  documentTypes?: { id: number; name: string }[];
  departments?: string[];
  documentColumns?: EmployeeFilesDocumentColumnId[];
  onDocumentColumnsChange?: (cols: EmployeeFilesDocumentColumnId[]) => void;
  employeeColumns?: EmployeeFilesEmployeeColumnId[];
  onEmployeeColumnsChange?: (cols: EmployeeFilesEmployeeColumnId[]) => void;
  resultCount?: number;
  totalCount?: number;
};

export default function EmployeeFilesBrowseToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  layoutMode,
  onLayoutModeChange,
  showDocumentFilters,
  showEmployeeFilters,
  documentFilters = DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS,
  onDocumentFiltersChange,
  employeeDepartmentId = "all",
  onEmployeeDepartmentChange,
  documentTypes = [],
  departments = [],
  documentColumns = [],
  onDocumentColumnsChange,
  employeeColumns = [],
  onEmployeeColumnsChange,
  resultCount,
  totalCount,
}: Props) {
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];

  if (showDocumentFilters && onDocumentFiltersChange) {
    if (documentFilters.category !== "all") {
      const label =
        DOCUMENT_CATEGORIES.find((c) => c.value === documentFilters.category)
          ?.label ?? documentFilters.category;
      activeFilters.push({
        key: "category",
        label: `Category: ${label}`,
        clear: () =>
          onDocumentFiltersChange({ ...documentFilters, category: "all" }),
      });
    }
    if (documentFilters.documentTypeId !== "all") {
      const label =
        documentTypes.find(
          (t) => String(t.id) === documentFilters.documentTypeId,
        )?.name ?? documentFilters.documentTypeId;
      activeFilters.push({
        key: "type",
        label: `Type: ${label}`,
        clear: () =>
          onDocumentFiltersChange({ ...documentFilters, documentTypeId: "all" }),
      });
    }
    if (documentFilters.status !== "all") {
      const label =
        STATUS_OPTIONS.find((s) => s.value === documentFilters.status)?.label ??
        documentFilters.status;
      activeFilters.push({
        key: "status",
        label: `Status: ${label}`,
        clear: () =>
          onDocumentFiltersChange({ ...documentFilters, status: "all" }),
      });
    }
    if (documentFilters.departmentId !== "all") {
      activeFilters.push({
        key: "dept",
        label: `Department: ${documentFilters.departmentId}`,
        clear: () =>
          onDocumentFiltersChange({ ...documentFilters, departmentId: "all" }),
      });
    }
    if (documentFilters.source !== "all") {
      const label =
        SOURCE_OPTIONS.find((s) => s.value === documentFilters.source)?.label ??
        documentFilters.source;
      activeFilters.push({
        key: "source",
        label: `Source: ${label}`,
        clear: () =>
          onDocumentFiltersChange({ ...documentFilters, source: "all" }),
      });
    }
  }

  if (showEmployeeFilters && employeeDepartmentId !== "all" && onEmployeeDepartmentChange) {
    activeFilters.push({
      key: "emp-dept",
      label: `Department: ${employeeDepartmentId}`,
      clear: () => onEmployeeDepartmentChange("all"),
    });
  }

  const clearAll = () => {
    onSearchChange("");
    if (onDocumentFiltersChange) {
      onDocumentFiltersChange(DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS);
    }
    onEmployeeDepartmentChange?.("all");
  };

  const columnDefs = showDocumentFilters
    ? EMPLOYEE_FILES_DOCUMENT_COLUMNS
    : EMPLOYEE_FILES_EMPLOYEE_COLUMNS;
  const visibleCols = showDocumentFilters ? documentColumns : employeeColumns;
  const onColsChange = showDocumentFilters
    ? onDocumentColumnsChange
    : onEmployeeColumnsChange;

  return (
    <div className="space-y-3 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 text-sm"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        <SectionTabs
          items={[
            { id: "list", label: "List", icon: List },
            { id: "card", label: "Cards", icon: Grid2X2 },
          ]}
          value={layoutMode}
          onChange={onLayoutModeChange}
          className="!w-auto shrink-0"
          ariaLabel="Browse view mode"
        />
      </div>

      {(showDocumentFilters || showEmployeeFilters) && (
        <div className="flex flex-wrap items-end gap-3 overflow-visible border-t border-slate-100 pt-3">
          <SlidersHorizontal className="mb-2 h-4 w-4 text-slate-400" />
          {showDocumentFilters && onDocumentFiltersChange ? (
            <>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={documentFilters.category}
                onChange={(e) =>
                  onDocumentFiltersChange({
                    ...documentFilters,
                    category: e.target.value,
                  })
                }
              >
                {DOCUMENT_CATEGORIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={documentFilters.documentTypeId}
                onChange={(e) =>
                  onDocumentFiltersChange({
                    ...documentFilters,
                    documentTypeId: e.target.value,
                  })
                }
              >
                <option value="all">All document types</option>
                {documentTypes.map((type) => (
                  <option key={type.id} value={String(type.id)}>
                    {type.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={documentFilters.status}
                onChange={(e) =>
                  onDocumentFiltersChange({
                    ...documentFilters,
                    status: e.target.value,
                  })
                }
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={documentFilters.source}
                onChange={(e) =>
                  onDocumentFiltersChange({
                    ...documentFilters,
                    source: e.target.value,
                  })
                }
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {departments.length > 0 ? (
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={documentFilters.departmentId}
                  onChange={(e) =>
                    onDocumentFiltersChange({
                      ...documentFilters,
                      departmentId: e.target.value,
                    })
                  }
                >
                  <option value="all">All departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : null}
          {showEmployeeFilters && onEmployeeDepartmentChange ? (
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={employeeDepartmentId}
              onChange={(e) => onEmployeeDepartmentChange(e.target.value)}
            >
              <option value="all">All departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          ) : null}
          {(showDocumentFilters || showEmployeeFilters) && onColsChange ? (
            <details className="relative overflow-visible text-sm">
              <summary
                className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink [&::-webkit-details-marker]:hidden"
              >
                Columns
              </summary>
              <div
                className="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,260px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                  <h3 className="employee-filter-section-title">Visible columns</h3>
                  <div className="employee-filter-options !max-h-none mt-2">
                {columnDefs.map((col) => {
                  const id = col.id as EmployeeFilesDocumentColumnId &
                    EmployeeFilesEmployeeColumnId;
                  const checked = visibleCols.includes(id);
                  return (
                    <label
                      key={col.id}
                      className="employee-filter-checkbox"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={col.id === "name"}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
                        onChange={() => {
                          const next = checked
                            ? visibleCols.filter((c) => c !== id)
                            : [...visibleCols, id];
                          if (!next.length) return;
                          if (showDocumentFilters && onDocumentColumnsChange) {
                            onDocumentColumnsChange(
                              next as EmployeeFilesDocumentColumnId[],
                            );
                          } else if (onEmployeeColumnsChange) {
                            onEmployeeColumnsChange(
                              next as EmployeeFilesEmployeeColumnId[],
                            );
                          }
                        }}
                      />
                      <span>{col.label}</span>
                    </label>
                  );
                })}
                  </div>
              </div>
            </details>
          ) : null}
        </div>
      )}

      {(activeFilters.length > 0 || search.trim()) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Active filters
          </span>
          {search.trim() ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Search: {search.trim()}
              <button type="button" onClick={() => onSearchChange("")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
          {activeFilters.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink"
            >
              {chip.label}
              <button type="button" onClick={chip.clear}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-xs font-semibold text-slate-500 hover:text-brand-pink"
          >
            Clear all
          </button>
        </div>
      )}

      {typeof resultCount === "number" && typeof totalCount === "number" ? (
        <p className="text-xs text-slate-500">
          Showing {resultCount} of {totalCount} results
        </p>
      ) : null}
    </div>
  );
}
