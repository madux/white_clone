"use client";

import React, { type ReactNode } from "react";
import { Filter, X } from "lucide-react";
import ThemedSelect from "./ThemedSelect";
import AppToolbar from "./AppToolbar";
import { Button } from "@/components/ui/button";
import { isOrgDocumentLinkedToPolicy } from "../../../lib/policyDocumentName";

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
  policyLink: "all" | "linked" | "not_linked";
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
  policyLink: "all",
};

export const ORG_POLICY_LINK_OPTIONS = [
  { value: "all", label: "All files" },
  { value: "linked", label: "Linked to policy" },
  { value: "not_linked", label: "Not linked to policy" },
];

interface DocumentFilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  availableTypes?: { id: number; name: string }[];
  availableDepartments?: string[];
  showDepartmentFilter?: boolean;
  showApprovalFilter?: boolean;
  showOrgPolicyFilter?: boolean;
  totalCount?: number;
  filteredCount?: number;
  actions?: ReactNode;
  leading?: ReactNode;
  extras?: ReactNode;
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
  showOrgPolicyFilter = false,
  totalCount,
  filteredCount,
  actions,
  leading,
  extras,
}: DocumentFilterBarProps) {
  const [expanded, setExpanded] = React.useState(false);

  const hasActiveFilters =
    filters.documentType !== "all" ||
    filters.status !== "all" ||
    filters.timeframe !== "all" ||
    filters.department !== "all" ||
    filters.fileFormat !== "all" ||
    filters.approvalStatus !== "all" ||
    filters.policyLink !== "all" ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const activeCount = [
    filters.documentType !== "all",
    filters.status !== "all",
    filters.timeframe !== "all",
    filters.department !== "all",
    filters.fileFormat !== "all",
    filters.approvalStatus !== "all",
    filters.policyLink !== "all",
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
    <AppToolbar
      search={filters.search}
      onSearchChange={(value) => updateFilter("search", value)}
      searchPlaceholder="Search documents by name, type, department, or keyword..."
      extras={
        <>
          <div className="w-48">
            <ThemedSelect
              value={filters.documentType}
              onChange={(val) => updateFilter("documentType", val)}
              placeholder="Document type"
              options={[
                { value: "all", label: "All document types" },
                ...availableTypes.map((t) => ({ value: String(t.id), label: t.name })),
              ]}
            />
          </div>
          <div className="w-40">
            <ThemedSelect
              value={filters.status}
              onChange={(val) => updateFilter("status", val)}
              placeholder="Status"
              options={STATUS_OPTIONS}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
          >
            <Filter data-icon="inline-start" />
            Filters
            {activeCount > 0 ? (
              <span className="text-xs">{activeCount}</span>
            ) : null}
          </Button>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X data-icon="inline-start" />
              Reset
            </Button>
          ) : null}
          {extras}
        </>
      }
      actions={
        actions || leading ? (
          <>
            {actions}
            {leading}
          </>
        ) : null
      }
      footer={
        <>
          {expanded ? (
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {showDepartmentFilter ? (
                <ThemedSelect
                  value={filters.department}
                  onChange={(val) => updateFilter("department", val)}
                  placeholder="All departments"
                  options={[
                    { value: "all", label: "All departments" },
                    ...availableDepartments.map((d) => ({ value: d, label: d })),
                  ]}
                />
              ) : null}
              <ThemedSelect
                value={filters.fileFormat}
                onChange={(val) => updateFilter("fileFormat", val)}
                placeholder="All formats"
                options={FILE_FORMAT_OPTIONS}
              />
              <ThemedSelect
                value={filters.timeframe}
                onChange={(val) => updateFilter("timeframe", val)}
                placeholder="Any timeframe"
                options={TIMEFRAME_OPTIONS}
              />
              <ThemedSelect
                value={filters.dateField}
                onChange={(val) => updateFilter("dateField", val as FilterState["dateField"])}
                placeholder="Date field"
                options={[
                  { value: "created_at", label: "Upload date" },
                  { value: "expiry_date", label: "Expiration date" },
                  { value: "write_date", label: "Last modified date" },
                ]}
              />
              {filters.timeframe === "custom" ? (
                <div className="col-span-full flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    From
                    <input
                      type="date"
                      value={filters.startDate || ""}
                      onChange={(e) => updateFilter("startDate", e.target.value)}
                      className="field"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    To
                    <input
                      type="date"
                      value={filters.endDate || ""}
                      onChange={(e) => updateFilter("endDate", e.target.value)}
                      className="field"
                    />
                  </label>
                </div>
              ) : null}
              {showOrgPolicyFilter ? (
                <div className="col-span-full border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Other
                  </p>
                  <div className="max-w-xs">
                    <ThemedSelect
                      value={filters.policyLink}
                      onChange={(val) =>
                        updateFilter(
                          "policyLink",
                          val as FilterState["policyLink"],
                        )
                      }
                      placeholder="Policy link"
                      options={ORG_POLICY_LINK_OPTIONS}
                      ariaLabel="Policy link filter"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {hasActiveFilters && typeof filteredCount === "number" && typeof totalCount === "number" ? (
            <p className="text-xs text-slate-500">
              Showing {filteredCount} of {totalCount} documents
            </p>
          ) : null}
        </>
      }
    />
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

    // 6. Organizational policy link
    if (filters.policyLink !== "all") {
      const linked = isOrgDocumentLinkedToPolicy(doc);
      if (filters.policyLink === "linked" && !linked) return false;
      if (filters.policyLink === "not_linked" && linked) return false;
    }

    // 7. File Format
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
