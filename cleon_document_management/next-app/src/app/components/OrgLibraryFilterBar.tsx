"use client";

import type { ReactNode } from "react";
import { Filter, X } from "lucide-react";
import type { OrgLibraryKindFilter } from "../../../lib/orgLibraryStats";
import {
  INITIAL_ORG_DOCUMENT_TAB_FILTERS,
  INITIAL_ORG_FOLDER_FILTERS,
  INITIAL_ORG_POLICY_TAB_FILTERS,
  type OrgDocumentTabFilters,
  type OrgFolderFilters,
  type OrgPolicyTabFilters,
} from "../../../lib/orgLibraryFilters";
import { ORG_DOCUMENT_SOURCE_OPTIONS } from "../../../lib/orgDocumentSource";
import {
  FILE_FORMAT_OPTIONS,
  ORG_POLICY_LINK_OPTIONS,
  STATUS_OPTIONS,
  TIMEFRAME_OPTIONS,
} from "./DocumentFilterBar";
import ThemedSelect from "./ThemedSelect";
import { Button } from "@/components/ui/button";

const FOLDER_KIND_OPTIONS = [
  { value: "all", label: "All kinds" },
  { value: "folder", label: "Standard folders" },
  { value: "project", label: "Projects" },
  { value: "vendor", label: "Vendors" },
  { value: "policy", label: "Policy folders" },
];

const ACCESS_SCOPE_OPTIONS = [
  { value: "all", label: "All access scopes" },
  { value: "all_staff", label: "All staff" },
  { value: "department", label: "Departments" },
  { value: "grade", label: "Grades" },
  { value: "individual", label: "Individuals" },
  { value: "private", label: "Private" },
  { value: "company_owned", label: "Company owned" },
  { value: "admin_only", label: "Admin only" },
];

const LOCK_OPTIONS = [
  { value: "all", label: "Any lock state" },
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" },
];

const ARCHIVED_OPTIONS = [
  { value: "all", label: "Active & archived" },
  { value: "active", label: "Active only" },
  { value: "archived", label: "Archived only" },
];

const CONTENT_OPTIONS = [
  { value: "all", label: "Any content" },
  { value: "has_files", label: "Has documents" },
  { value: "empty", label: "Empty" },
];

const FOLDER_SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "modified_desc", label: "Recently modified" },
  { value: "documents_desc", label: "Most documents" },
];

const POLICY_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const VISIBILITY_OPTIONS = [
  { value: "all", label: "All visibility" },
  { value: "employees", label: "Employees" },
  { value: "hr_only", label: "HR only" },
];

const HAS_DOCUMENT_OPTIONS = [
  { value: "all", label: "Any document" },
  { value: "yes", label: "Has primary document" },
  { value: "no", label: "Missing document" },
];

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}

type OrgLibraryFilterBarProps = {
  kindFilter: OrgLibraryKindFilter;
  folderFilters?: OrgFolderFilters;
  onFolderFiltersChange?: (next: OrgFolderFilters) => void;
  documentFilters?: OrgDocumentTabFilters;
  onDocumentFiltersChange?: (next: OrgDocumentTabFilters) => void;
  policyFilters?: OrgPolicyTabFilters;
  onPolicyFiltersChange?: (next: OrgPolicyTabFilters) => void;
  documentTypes?: { id: number; name: string }[];
  policyCategories?: { value: string; label: string }[];
  folderOptions?: { value: string; label: string }[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  part: "trigger" | "panel";
};

function countPolicyActive(policyFilters: OrgPolicyTabFilters) {
  return [
    policyFilters.status !== "all",
    policyFilters.visibility !== "all",
    policyFilters.category !== "all",
    policyFilters.hasDocument !== "all",
  ].filter(Boolean).length;
}

function countDocumentActive(documentFilters: OrgDocumentTabFilters) {
  return [
    documentFilters.source !== "all",
    documentFilters.documentTypeId !== "all",
    documentFilters.status !== "all",
    documentFilters.policyLink !== "all",
    documentFilters.folderId !== "all",
    documentFilters.fileFormat !== "all",
    documentFilters.timeframe !== "all",
  ].filter(Boolean).length;
}

function countFolderActive(folderFilters: OrgFolderFilters, kindFilter: OrgLibraryKindFilter) {
  return [
    folderFilters.accessScope !== "all",
    folderFilters.lockState !== "all",
    folderFilters.archived !== "all",
    folderFilters.content !== "all",
    kindFilter === "all" && folderFilters.subKind !== "all",
    folderFilters.sort !== "name_asc",
  ].filter(Boolean).length;
}

export default function OrgLibraryFilterBar({
  kindFilter,
  folderFilters,
  onFolderFiltersChange,
  documentFilters,
  onDocumentFiltersChange,
  policyFilters,
  onPolicyFiltersChange,
  documentTypes = [],
  policyCategories = [],
  folderOptions = [],
  expanded,
  onExpandedChange,
  part,
}: OrgLibraryFilterBarProps) {
  if (part === "trigger") {
    let activeCount = 0;
    let onReset: (() => void) | undefined;

    if (kindFilter === "policy" && policyFilters && onPolicyFiltersChange) {
      activeCount = countPolicyActive(policyFilters);
      onReset = () => onPolicyFiltersChange(INITIAL_ORG_POLICY_TAB_FILTERS);
    } else if (kindFilter === "documents" && documentFilters && onDocumentFiltersChange) {
      activeCount = countDocumentActive(documentFilters);
      onReset = () => onDocumentFiltersChange(INITIAL_ORG_DOCUMENT_TAB_FILTERS);
    } else if (
      folderFilters &&
      onFolderFiltersChange &&
      kindFilter !== "policy" &&
      kindFilter !== "documents"
    ) {
      activeCount = countFolderActive(folderFilters, kindFilter);
      onReset = () =>
        onFolderFiltersChange({
          ...INITIAL_ORG_FOLDER_FILTERS,
          subKind:
            kindFilter === "project"
              ? "project"
              : kindFilter === "vendor"
                ? "vendor"
                : "all",
        });
    } else {
      return null;
    }

    return (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={() => onExpandedChange(!expanded)}
        >
          <Filter data-icon="inline-start" />
          Filters
          {activeCount > 0 ? <span className="text-xs">{activeCount}</span> : null}
        </Button>
        {activeCount > 0 && onReset ? (
          <Button type="button" variant="ghost" onClick={onReset}>
            <X data-icon="inline-start" />
            Reset
          </Button>
        ) : null}
      </>
    );
  }

  if (!expanded) return null;

  if (kindFilter === "policy" && policyFilters && onPolicyFiltersChange) {
    return (
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3">
        <FilterField label="Status">
          <ThemedSelect
            value={policyFilters.status}
            onChange={(value) => onPolicyFiltersChange({ ...policyFilters, status: value })}
            options={POLICY_STATUS_OPTIONS}
          />
        </FilterField>
        <FilterField label="Visibility">
          <ThemedSelect
            value={policyFilters.visibility}
            onChange={(value) =>
              onPolicyFiltersChange({ ...policyFilters, visibility: value })
            }
            options={VISIBILITY_OPTIONS}
          />
        </FilterField>
        <FilterField label="Category">
          <ThemedSelect
            value={policyFilters.category}
            onChange={(value) => onPolicyFiltersChange({ ...policyFilters, category: value })}
            options={policyCategories}
          />
        </FilterField>
        <FilterField label="Primary document">
          <ThemedSelect
            value={policyFilters.hasDocument}
            onChange={(value) =>
              onPolicyFiltersChange({
                ...policyFilters,
                hasDocument: value as OrgPolicyTabFilters["hasDocument"],
              })
            }
            options={HAS_DOCUMENT_OPTIONS}
          />
        </FilterField>
      </div>
    );
  }

  if (kindFilter === "documents" && documentFilters && onDocumentFiltersChange) {
    return (
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3">
        <FilterField label="Source">
          <ThemedSelect
            value={documentFilters.source}
            onChange={(value) => onDocumentFiltersChange({ ...documentFilters, source: value })}
            options={ORG_DOCUMENT_SOURCE_OPTIONS}
          />
        </FilterField>
        <FilterField label="Document type">
          <ThemedSelect
            value={documentFilters.documentTypeId}
            onChange={(value) =>
              onDocumentFiltersChange({ ...documentFilters, documentTypeId: value })
            }
            options={[
              { value: "all", label: "All types" },
              ...documentTypes.map((type) => ({
                value: String(type.id),
                label: type.name,
              })),
            ]}
          />
        </FilterField>
        <FilterField label="Status">
          <ThemedSelect
            value={documentFilters.status}
            onChange={(value) => onDocumentFiltersChange({ ...documentFilters, status: value })}
            options={STATUS_OPTIONS}
          />
        </FilterField>
        <FilterField label="Policy link">
          <ThemedSelect
            value={documentFilters.policyLink}
            onChange={(value) =>
              onDocumentFiltersChange({
                ...documentFilters,
                policyLink: value as OrgDocumentTabFilters["policyLink"],
              })
            }
            options={ORG_POLICY_LINK_OPTIONS}
          />
        </FilterField>
        <FilterField label="Folder">
          <ThemedSelect
            value={documentFilters.folderId}
            onChange={(value) => onDocumentFiltersChange({ ...documentFilters, folderId: value })}
            options={[{ value: "all", label: "All folders" }, ...folderOptions]}
          />
        </FilterField>
        <FilterField label="Format">
          <ThemedSelect
            value={documentFilters.fileFormat}
            onChange={(value) =>
              onDocumentFiltersChange({ ...documentFilters, fileFormat: value })
            }
            options={FILE_FORMAT_OPTIONS}
          />
        </FilterField>
        <FilterField label="Modified">
          <ThemedSelect
            value={documentFilters.timeframe}
            onChange={(value) =>
              onDocumentFiltersChange({ ...documentFilters, timeframe: value })
            }
            options={TIMEFRAME_OPTIONS}
          />
        </FilterField>
      </div>
    );
  }

  if (
    folderFilters &&
    onFolderFiltersChange &&
    kindFilter !== "policy" &&
    kindFilter !== "documents"
  ) {
    const showSubKind = kindFilter === "all";
    return (
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3">
        {showSubKind ? (
          <FilterField label="Kind">
            <ThemedSelect
              value={folderFilters.subKind}
              onChange={(value) =>
                onFolderFiltersChange({
                  ...folderFilters,
                  subKind: value as OrgFolderFilters["subKind"],
                })
              }
              options={FOLDER_KIND_OPTIONS}
            />
          </FilterField>
        ) : null}
        <FilterField label="Access">
          <ThemedSelect
            value={folderFilters.accessScope}
            onChange={(value) =>
              onFolderFiltersChange({ ...folderFilters, accessScope: value })
            }
            options={ACCESS_SCOPE_OPTIONS}
          />
        </FilterField>
        <FilterField label="Lock">
          <ThemedSelect
            value={folderFilters.lockState}
            onChange={(value) =>
              onFolderFiltersChange({
                ...folderFilters,
                lockState: value as OrgFolderFilters["lockState"],
              })
            }
            options={LOCK_OPTIONS}
          />
        </FilterField>
        <FilterField label="Archive">
          <ThemedSelect
            value={folderFilters.archived}
            onChange={(value) =>
              onFolderFiltersChange({
                ...folderFilters,
                archived: value as OrgFolderFilters["archived"],
              })
            }
            options={ARCHIVED_OPTIONS}
          />
        </FilterField>
        <FilterField label="Content">
          <ThemedSelect
            value={folderFilters.content}
            onChange={(value) =>
              onFolderFiltersChange({
                ...folderFilters,
                content: value as OrgFolderFilters["content"],
              })
            }
            options={CONTENT_OPTIONS}
          />
        </FilterField>
        <FilterField label="Sort">
          <ThemedSelect
            value={folderFilters.sort}
            onChange={(value) =>
              onFolderFiltersChange({
                ...folderFilters,
                sort: value as OrgFolderFilters["sort"],
              })
            }
            options={FOLDER_SORT_OPTIONS}
          />
        </FilterField>
      </div>
    );
  }

  return null;
}
