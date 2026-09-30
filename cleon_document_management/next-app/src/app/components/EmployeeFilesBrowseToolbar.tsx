"use client";

import { Filter, X } from "lucide-react";
import { useState } from "react";
import ViewToggle from "./ViewToggle";
import AppToolbar from "./AppToolbar";
import ThemedSelect from "./ThemedSelect";
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
  { value: "needs_attention", label: "Needs attention" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "expiring_30", label: "Expiring in 30 days" },
];

const EMPLOYEE_ATTENTION_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "ok", label: "OK" },
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
  employeeAttentionFilter?: string;
  onEmployeeAttentionFilterChange?: (value: string) => void;
  documentTypes?: { id: number; name: string }[];
  departments?: string[];
  documentColumns?: EmployeeFilesDocumentColumnId[];
  onDocumentColumnsChange?: (cols: EmployeeFilesDocumentColumnId[]) => void;
  employeeColumns?: EmployeeFilesEmployeeColumnId[];
  onEmployeeColumnsChange?: (cols: EmployeeFilesEmployeeColumnId[]) => void;
  resultCount?: number;
  totalCount?: number;
  showLayoutToggle?: boolean;
  groupByOptions?: { id: string; label: string }[];
  groupByValue?: string;
  onGroupByChange?: (value: string) => void;
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
  employeeAttentionFilter = "all",
  onEmployeeAttentionFilterChange,
  documentTypes = [],
  departments = [],
  documentColumns = [],
  onDocumentColumnsChange,
  employeeColumns = [],
  onEmployeeColumnsChange,
  resultCount,
  totalCount,
  showLayoutToggle = true,
  groupByOptions,
  groupByValue,
  onGroupByChange,
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

  if (
    showEmployeeFilters &&
    employeeAttentionFilter !== "all" &&
    onEmployeeAttentionFilterChange
  ) {
    const label =
      EMPLOYEE_ATTENTION_OPTIONS.find((s) => s.value === employeeAttentionFilter)
        ?.label ?? employeeAttentionFilter;
    activeFilters.push({
      key: "emp-attention",
      label: `Status: ${label}`,
      clear: () => onEmployeeAttentionFilterChange("all"),
    });
  }

  const clearAll = () => {
    onSearchChange("");
    if (onDocumentFiltersChange) {
      onDocumentFiltersChange(DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS);
    }
    onEmployeeDepartmentChange?.("all");
    onEmployeeAttentionFilterChange?.("all");
  };

  const columnDefs = showDocumentFilters
    ? EMPLOYEE_FILES_DOCUMENT_COLUMNS
    : EMPLOYEE_FILES_EMPLOYEE_COLUMNS;
  const visibleCols = showDocumentFilters ? documentColumns : employeeColumns;
  const onColsChange = showDocumentFilters
    ? onDocumentColumnsChange
    : onEmployeeColumnsChange;

  const [expanded, setExpanded] = useState(false);

  return (
    <AppToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      extras={
        <>
          {groupByOptions?.length && onGroupByChange ? (
            <div className="group-by-switch">
              <span className="group-by-switch-label">Group by</span>
              <div
                className="group-by-switch-track"
                role="tablist"
                aria-label="Organizing dimension"
              >
                {groupByOptions.map((option) => {
                  const active = option.id === groupByValue;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={active ? "is-active" : undefined}
                      onClick={() => onGroupByChange(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {showDocumentFilters && onDocumentFiltersChange ? (
            <>
              <div className="w-40">
                <ThemedSelect
                  value={documentFilters.status}
                  onChange={(value) =>
                    onDocumentFiltersChange({ ...documentFilters, status: value })
                  }
                  options={STATUS_OPTIONS}
                />
              </div>
              <button
                type="button"
                className="app-btn app-btn-secondary"
                onClick={() => setExpanded((open) => !open)}
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilters.length ? (
                  <span className="status-pill status-pill--pending">
                    {activeFilters.length}
                  </span>
                ) : null}
              </button>
            </>
          ) : null}
          {showEmployeeFilters && onEmployeeAttentionFilterChange ? (
            <div className="w-44">
              <ThemedSelect
                value={employeeAttentionFilter}
                onChange={onEmployeeAttentionFilterChange}
                options={EMPLOYEE_ATTENTION_OPTIONS}
              />
            </div>
          ) : null}
          {showEmployeeFilters && onEmployeeDepartmentChange && departments.length ? (
            <div className="w-44">
              <ThemedSelect
                value={employeeDepartmentId}
                onChange={onEmployeeDepartmentChange}
                options={[
                  { value: "all", label: "All departments" },
                  ...departments.map((dept) => ({ value: dept, label: dept })),
                ]}
              />
            </div>
          ) : null}
          {(showDocumentFilters || showEmployeeFilters) && onColsChange ? (
            <details className="relative overflow-visible text-sm">
              <summary className="app-btn app-btn-secondary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                Columns
              </summary>
              <div
                className="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,260px)] border border-slate-200 bg-white p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="employee-filter-section-title">Visible columns</h3>
                <div className="employee-filter-options !max-h-none mt-2">
                  {columnDefs.map((col) => {
                    const id = col.id as EmployeeFilesDocumentColumnId &
                      EmployeeFilesEmployeeColumnId;
                    const checked = visibleCols.includes(id);
                    return (
                      <label key={col.id} className="employee-filter-checkbox">
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
        </>
      }
      toggle={
        showLayoutToggle ? (
          <ViewToggle
            value={layoutMode === "card" ? "card" : "list"}
            onChange={(value) => onLayoutModeChange(value === "card" ? "card" : "list")}
            ariaLabel="Browse view mode"
          />
        ) : null
      }
      footer={
        <>
          {expanded && showDocumentFilters && onDocumentFiltersChange ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <ThemedSelect
                value={documentFilters.category}
                onChange={(value) =>
                  onDocumentFiltersChange({ ...documentFilters, category: value })
                }
                options={DOCUMENT_CATEGORIES}
              />
              <ThemedSelect
                value={documentFilters.documentTypeId}
                onChange={(value) =>
                  onDocumentFiltersChange({
                    ...documentFilters,
                    documentTypeId: value,
                  })
                }
                options={[
                  { value: "all", label: "All document types" },
                  ...documentTypes.map((type) => ({
                    value: String(type.id),
                    label: type.name,
                  })),
                ]}
              />
              <ThemedSelect
                value={documentFilters.source}
                onChange={(value) =>
                  onDocumentFiltersChange({ ...documentFilters, source: value })
                }
                options={SOURCE_OPTIONS}
              />
              {departments.length > 0 ? (
                <ThemedSelect
                  value={documentFilters.departmentId}
                  onChange={(value) =>
                    onDocumentFiltersChange({
                      ...documentFilters,
                      departmentId: value,
                    })
                  }
                  options={[
                    { value: "all", label: "All departments" },
                    ...departments.map((dept) => ({ value: dept, label: dept })),
                  ]}
                />
              ) : null}
            </div>
          ) : null}
          {activeFilters.length > 0 || search.trim() ? (
            <div className="flex w-full flex-wrap items-center gap-2">
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
          ) : null}
          {typeof resultCount === "number" && typeof totalCount === "number" ? (
            <p className="text-xs text-slate-500">
              Showing {resultCount} of {totalCount} results
            </p>
          ) : null}
        </>
      }
    />
  );
}
