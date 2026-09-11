"use client";

import React from "react";
import { Search, Filter, X } from "lucide-react";
import ThemedSelect from "./ThemedSelect";

export interface FilterState {
  search: string;
  documentType: string;
  status: string;
  timeframe: string;
  dateField: "created_at" | "expiry_date" | "write_date";
  startDate?: string;
  endDate?: string;
  department: string;
  fileFormat: string;
  approvalStatus: string;
}

export const INITIAL_FILTER_STATE: FilterState = {
  search: "",
  documentType: "all",
  status: "all",
  timeframe: "all",
  dateField: "created_at",
  startDate: "",
  endDate: "",
  department: "all",
  fileFormat: "all",
  approvalStatus: "all",
};

interface DocumentFilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  availableTypes?: { id: number; name: string }[];
  availableDepartments?: string[];
  showDepartmentFilter?: boolean;
  showApprovalFilter?: boolean;
  totalCount?: number;
  filteredCount?: number;
}

export const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "expiring_30", label: "Expiring in 30 Days" },
  { value: "expiring_60", label: "Expiring in 60 Days" },
  { value: "inactive", label: "Inactive / Archived" },
];

export const TIMEFRAME_OPTIONS = [
  { value: "all", label: "Any Timeframe" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week (7 Days)" },
  { value: "this_month", label: "This Month (30 Days)" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Date Range" },
];

export const FILE_FORMAT_OPTIONS = [
  { value: "all", label: "All File Formats" },
  { value: "pdf", label: "PDF Documents (.pdf)" },
  { value: "image", label: "Images (.png, .jpg, .webp)" },
  { value: "word", label: "Word Documents (.doc, .docx)" },
  { value: "excel", label: "Spreadsheets (.xlsx, .csv)" },
  { value: "text", label: "Text / Markdown (.txt, .md)" },
];

export const DEFAULT_DEPARTMENTS = [
  "HR",
  "Engineering",
  "Finance & Accounting",
  "Operations",
  "Sales & Marketing",
  "Legal",
  "Executive",
];

export default function DocumentFilterBar({
  filters,
  onChange,
  availableTypes = [],
  availableDepartments = DEFAULT_DEPARTMENTS,
  showDepartmentFilter = true,
  showApprovalFilter = false,
  totalCount,
  filteredCount,
}: DocumentFilterBarProps) {
  const [expanded, setExpanded] = React.useState(false);

  const hasActiveFilters =
    filters.documentType !== "all" ||
    filters.status !== "all" ||
    filters.timeframe !== "all" ||
    filters.department !== "all" ||
    filters.fileFormat !== "all" ||
    filters.approvalStatus !== "all" ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const activeCount = [
    filters.documentType !== "all",
    filters.status !== "all",
    filters.timeframe !== "all",
    filters.department !== "all",
    filters.fileFormat !== "all",
    filters.approvalStatus !== "all",
    Boolean(filters.startDate),
    Boolean(filters.endDate),
  ].filter(Boolean).length;

  const updateFilter = (key: keyof FilterState, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onChange({ ...INITIAL_FILTER_STATE, search: filters.search });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Top Main Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search documents by name, type, department, or keyword..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilter("search", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Document Type Select */}
          <div className="w-48">
            <ThemedSelect
              value={filters.documentType}
              onChange={(val) => updateFilter("documentType", val)}
              placeholder="Document Type"
              options={[
                { value: "all", label: "All Document Types" },
                ...availableTypes.map((t) => ({ value: String(t.id), label: t.name })),
              ]}
            />
          </div>

          {/* Quick Status Select */}
          <div className="w-44">
            <ThemedSelect
              value={filters.status}
              onChange={(val) => updateFilter("status", val)}
              placeholder="Status"
              options={STATUS_OPTIONS}
            />
          </div>

          {/* Expand Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
              expanded || activeCount > 0
                ? "border-brand-pink/40 bg-pink-50 text-brand-pink"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-[10px] font-extrabold text-white">
                {activeCount}
              </span>
            )}
          </button>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Expanded Multi-Dimensional Filter Panel */}
      {expanded && (
        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Department Filter */}
          {showDepartmentFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Department
              </label>
              <ThemedSelect
                value={filters.department}
                onChange={(val) => updateFilter("department", val)}
                placeholder="All Departments"
                options={[
                  { value: "all", label: "All Departments" },
                  ...availableDepartments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>
          )}

          {/* File Format Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              File Format
            </label>
            <ThemedSelect
              value={filters.fileFormat}
              onChange={(val) => updateFilter("fileFormat", val)}
              placeholder="All Formats"
              options={FILE_FORMAT_OPTIONS}
            />
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Timeframe
            </label>
            <ThemedSelect
              value={filters.timeframe}
              onChange={(val) => updateFilter("timeframe", val)}
              placeholder="Any Timeframe"
              options={TIMEFRAME_OPTIONS}
            />
          </div>

          {/* Targeted Date Field */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Evaluate Date By
            </label>
            <ThemedSelect
              value={filters.dateField}
              onChange={(val) => updateFilter("dateField", val as any)}
              placeholder="Date Field"
              options={[
                { value: "created_at", label: "Upload Date" },
                { value: "expiry_date", label: "Expiration Date" },
                { value: "write_date", label: "Last Modified Date" },
              ]}
            />
          </div>

          {/* Custom Date Range Controls */}
          {filters.timeframe === "custom" && (
            <div className="col-span-full flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-600">Custom Date Range:</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                From:
                <input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) => updateFilter("startDate", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-pink"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                To:
                <input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) => updateFilter("endDate", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-pink"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Active Filter Pills Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active Filters:
          </span>
          {filters.documentType !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Type: {availableTypes.find((t) => String(t.id) === filters.documentType)?.name || filters.documentType}
              <button type="button" onClick={() => updateFilter("documentType", "all")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.status !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Status: {STATUS_OPTIONS.find((s) => s.value === filters.status)?.label}
              <button type="button" onClick={() => updateFilter("status", "all")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.timeframe !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Timeframe: {TIMEFRAME_OPTIONS.find((t) => t.value === filters.timeframe)?.label}
              <button type="button" onClick={() => updateFilter("timeframe", "all")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.department !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Dept: {filters.department}
              <button type="button" onClick={() => updateFilter("department", "all")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.fileFormat !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Format: {FILE_FORMAT_OPTIONS.find((f) => f.value === filters.fileFormat)?.label}
              <button type="button" onClick={() => updateFilter("fileFormat", "all")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {typeof filteredCount === "number" && typeof totalCount === "number" && (
            <span className="ml-auto text-xs font-medium text-slate-400">
              Showing {filteredCount} of {totalCount} documents
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Helper function to apply FilterState rules to a list of document objects */
export function applyDocumentFilters(documents: any[], filters: FilterState): any[] {
  return documents.filter((doc) => {
    // 1. Search Query
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const name = (doc.name || "").toLowerCase();
      const type = (doc.document_type || "").toLowerCase();
      const folder = (doc.folder_name || "").toLowerCase();
      const emp = (doc.employee_name || "").toLowerCase();
      if (!name.includes(q) && !type.includes(q) && !folder.includes(q) && !emp.includes(q)) {
        return false;
      }
    }

    // 2. Document Type
    if (filters.documentType !== "all") {
      if (String(doc.document_type_id) !== filters.documentType && String(doc.document_type) !== filters.documentType) {
        return false;
      }
    }

    // 3. Status
    if (filters.status !== "all") {
      const state = doc.state || (doc.active === false ? "inactive" : "active");
      const today = new Date();
      if (filters.status === "active" && (doc.active === false || doc.state === "archived")) return false;
      if (filters.status === "inactive" && doc.active !== false && doc.state !== "archived") return false;
      if (filters.status === "draft" && state !== "draft") return false;
      if (filters.status === "pending_approval" && doc.approval_state !== "pending") return false;
      if (filters.status === "approved" && doc.approval_state !== "approved" && state !== "approved") return false;
      if (filters.status === "rejected" && doc.approval_state !== "rejected" && state !== "rejected") return false;
      if (filters.status === "expired") {
        if (!doc.expiry_date) return false;
        if (new Date(doc.expiry_date) > today) return false;
      }
      if (filters.status === "expiring_30") {
        if (!doc.expiry_date) return false;
        const diff = (new Date(doc.expiry_date).getTime() - today.getTime()) / (1000 * 3600 * 24);
        if (diff < 0 || diff > 30) return false;
      }
      if (filters.status === "expiring_60") {
        if (!doc.expiry_date) return false;
        const diff = (new Date(doc.expiry_date).getTime() - today.getTime()) / (1000 * 3600 * 24);
        if (diff < 0 || diff > 60) return false;
      }
    }

    // 4. Timeframe Filter
    if (filters.timeframe !== "all") {
      const rawDate = doc[filters.dateField] || doc.created_at || doc.write_date;
      if (!rawDate) return false;
      const targetDate = new Date(rawDate);
      const now = new Date();

      if (filters.timeframe === "today") {
        if (targetDate.toDateString() !== now.toDateString()) return false;
      } else if (filters.timeframe === "this_week") {
        const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > 7) return false;
      } else if (filters.timeframe === "this_month") {
        const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > 30) return false;
      } else if (filters.timeframe === "this_year") {
        if (targetDate.getFullYear() !== now.getFullYear()) return false;
      } else if (filters.timeframe === "custom") {
        if (filters.startDate && targetDate < new Date(filters.startDate)) return false;
        if (filters.endDate && targetDate > new Date(filters.endDate + "T23:59:59")) return false;
      }
    }

    // 5. Department Filter
    if (filters.department !== "all") {
      const folderName = (doc.folder_name || "").toLowerCase();
      const empDept = (doc.department_name || "").toLowerCase();
      const targetDept = filters.department.toLowerCase();
      if (!folderName.includes(targetDept) && !empDept.includes(targetDept)) {
        return false;
      }
    }

    // 6. File Format
    if (filters.fileFormat !== "all") {
      const name = (doc.name || "").toLowerCase();
      const mime = (doc.mimetype || "").toLowerCase();
      if (filters.fileFormat === "pdf" && !name.endsWith(".pdf") && !mime.includes("pdf")) return false;
      if (filters.fileFormat === "image" && !/\.(png|jpe?g|webp|gif|svg)$/.test(name) && !mime.includes("image")) return false;
      if (filters.fileFormat === "word" && !/\.(docx?|doc)$/.test(name) && !mime.includes("word")) return false;
      if (filters.fileFormat === "excel" && !/\.(xlsx?|csv)$/.test(name) && !mime.includes("sheet") && !mime.includes("csv")) return false;
      if (filters.fileFormat === "text" && !/\.(txt|md|markdown)$/.test(name) && !mime.includes("text")) return false;
    }

    return true;
  });
}
