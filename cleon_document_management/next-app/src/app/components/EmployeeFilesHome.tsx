"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useEmployeeFileGroups,
  useEmployeeFilesConfig,
  useEmployeeFilesDocumentSearch,
  useEmployeeFilesHomeStats,
  useEmployeeFileSummaries,
} from "../../../hooks/useEmployeeFiles";
import { useCurrentUser, useDocumentTypes } from "../../../hooks/useDocuments";
import CompliancePage from "./CompliancePage";
import SectionTabs from "./SectionTabs";
import EmployeeFilesGroupExplorer from "./EmployeeFilesGroupExplorer";
import EmployeeFilesBrowseToolbar from "./EmployeeFilesBrowseToolbar";
import EmployeeFilesDocumentResults from "./EmployeeFilesDocumentResults";
import EmployeeFilesEmployeeResults from "./EmployeeFilesEmployeeResults";
import { employeeFileDimensionLabel } from "../../../lib/employeeFileDimensions";
import type { EmployeeFileGroup } from "../../../lib/types";
import EmptyState from "./EmptyState";
import EmployeeFilesIssuesPage from "./EmployeeFilesIssuesPage";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import {
  DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS,
  loadEmployeeFilesBrowsePreferences,
  saveEmployeeFilesBrowsePreferences,
  type EmployeeFilesBrowseFilters,
} from "../../../lib/employeeFilesBrowsePreferences";
import type { DocDocument } from "../../../lib/types";
import { documentPreviewUrl } from "../../../lib/documentPreviewUrls";
import DocumentViewerDialog from "./DocumentViewerDialog";
import EmployeeFilesAutomationAdminLink from "./EmployeeFilesAutomationAdminLink";

type HomeView = "groups" | "employees" | "documents";
type WorkspaceTab = "browse" | "issues" | "compliance";

const DOCUMENT_PAGE_SIZE = 25;

function workspaceTabFromParam(value: string | null): WorkspaceTab {
  if (value === "issues") return "issues";
  if (value === "compliance") return "compliance";
  return "browse";
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function EmployeeFilesHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const canManageCompliance = currentUser.data?.is_document_admin === true;
  const rawTab = searchParams.get("tab");
  const workspaceTab =
    rawTab === "compliance" && !canManageCompliance
      ? "browse"
      : workspaceTabFromParam(rawTab);
  const config = useEmployeeFilesConfig();
  const stats = useEmployeeFilesHomeStats();
  const documentTypes = useDocumentTypes();
  const [browsePrefs, setBrowsePrefs] = useState(() =>
    loadEmployeeFilesBrowsePreferences(),
  );
  const [view, setView] = useState<HomeView>(() => {
    const value = searchParams.get("view");
    if (value === "employees" || value === "documents") return value;
    return "groups";
  });
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [dimension, setDimension] = useState("");
  const [documentFilters, setDocumentFilters] = useState<EmployeeFilesBrowseFilters>(
    DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS,
  );
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState("all");
  const [employeeAttentionFilter, setEmployeeAttentionFilter] = useState(() => {
    const value = searchParams.get("attention");
    return value === "needs_attention" || value === "ok" ? value : "all";
  });
  const [employeePage, setEmployeePage] = useState(1);
  const [documentPage, setDocumentPage] = useState(1);
  const [viewingDocument, setViewingDocument] = useState<DocDocument | null>(null);

  const debouncedSearch = useDebouncedValue(search, 350);

  const persistPrefs = useCallback(
    (patch: Partial<typeof browsePrefs>) => {
      setBrowsePrefs((prev) => {
        const next = { ...prev, ...patch };
        saveEmployeeFilesBrowsePreferences(next);
        return next;
      });
    },
    [],
  );

  const primaryDimension =
    dimension ||
    config.data?.primary_organizing_dimension ||
    config.data?.organizing_dimensions?.[0] ||
    "department";

  const homeGroups = useEmployeeFileGroups({
    for_home: true,
    dimension: primaryDimension,
    search: view === "groups" ? debouncedSearch : undefined,
  });

  const departmentGroups = useEmployeeFileGroups({
    for_home: false,
    dimension: "department",
  });

  const departments = useMemo(() => {
    const names = new Set<string>();
    (departmentGroups.data ?? []).forEach((group) => {
      if (group.name?.trim()) names.add(group.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [departmentGroups.data]);

  const employeeList = useEmployeeFileSummaries({
    search: debouncedSearch.trim() || undefined,
    page: employeePage,
    pageSize: EMPLOYEE_FILE_LIST_PAGE_SIZE,
    departmentId: employeeDepartmentId,
    order: browsePrefs.employeeSort,
    attentionFilter: employeeAttentionFilter,
    enabled: view === "employees" && !!stats.data?.employee_files_initialized,
  });

  const documentSearch = useEmployeeFilesDocumentSearch({
    query: debouncedSearch.trim() || undefined,
    category: documentFilters.category,
    documentTypeId: documentFilters.documentTypeId,
    departmentId: documentFilters.departmentId,
    source: documentFilters.source,
    status: documentFilters.status,
    page: documentPage,
    pageSize: DOCUMENT_PAGE_SIZE,
    order: browsePrefs.documentSort,
    enabled: view === "documents",
  });

  const attention = stats.data?.needs_attention ?? 0;

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "pending-approvals" || tab === "pending") {
      router.replace("/pages/my-workspace?tab=review-queue&section=employee");
    }
  }, [searchParams, router]);

  const dimensionTabs = useMemo(() => {
    const keys = [...(config.data?.organizing_dimensions ?? [])];
    const primary =
      config.data?.primary_organizing_dimension || keys[0] || "";
    const sub = config.data?.sub_organizing_dimension;
    const adHoc = keys.filter((key) => key && key !== primary);
    if (sub && sub !== "none" && sub !== primary && !adHoc.includes(sub)) {
      adHoc.push(sub);
    }
    if (!primary) return [];
    return [
      {
        id: primary,
        label: employeeFileDimensionLabel(primary),
      },
      ...adHoc.map((key) => ({
        id: key,
        label: employeeFileDimensionLabel(key),
      })),
    ];
  }, [
    config.data?.organizing_dimensions,
    config.data?.primary_organizing_dimension,
    config.data?.sub_organizing_dimension,
  ]);

  const setWorkspaceTab = (tab: WorkspaceTab) => {
    if (tab === "compliance" && !canManageCompliance) return;
    if (tab === "browse") {
      router.push("/pages/employee");
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    if (tab !== "compliance") {
      params.delete("rule");
      params.delete("policy");
    }
    const query = params.toString();
    router.push(query ? `/pages/employee?${query}` : "/pages/employee");
  };

  useEffect(() => {
    if (rawTab === "compliance" && !canManageCompliance && !currentUser.isPending) {
      router.replace("/pages/employee");
    }
  }, [canManageCompliance, currentUser.isPending, rawTab, router]);

  useEffect(() => {
    const value = searchParams.get("view");
    if (value === "employees" || value === "documents") {
      setView(value);
    } else if (!value) {
      setView("groups");
    }
  }, [searchParams]);

  useEffect(() => {
    setEmployeePage(1);
    setDocumentPage(1);
  }, [
    debouncedSearch,
    employeeDepartmentId,
    employeeAttentionFilter,
    documentFilters,
    view,
  ]);

  const searchPlaceholder =
    view === "documents"
      ? "Search by document name, employee, or employee ID…"
      : view === "employees"
        ? "Search by employee name, ID, department, grade, or location…"
        : "Search groups…";

  const typeOptions = useMemo(
    () =>
      (documentTypes.data ?? []).map((type) => ({
        id: type.id,
        name: type.name,
      })),
    [documentTypes.data],
  );

  return (
    <div className="app-page space-y-6">
      <SectionTabs
        ariaLabel="Employee Files sections"
        level="page"
        value={workspaceTab}
        onChange={(value) => setWorkspaceTab(value as WorkspaceTab)}
        items={[
          { id: "browse", label: "Browse" },
          {
            id: "issues",
            label: "Issues",
            count: attention > 0 ? attention : undefined,
          },
          ...(canManageCompliance
            ? [{ id: "compliance" as const, label: "Compliance" }]
            : []),
        ]}
      />

      {workspaceTab === "compliance" ? <CompliancePage embedded /> : null}

      {workspaceTab === "issues" ? (
        <EmployeeFilesIssuesPage embedded />
      ) : null}

      {workspaceTab === "browse" ? (
        <>
          <EmployeeFilesAutomationAdminLink />
          {stats.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  label: "EMS employees",
                  value: stats.data.ems_employees,
                  context: "Source headcount",
                },
                {
                  label: "Expected files",
                  value: stats.data.expected_employee_files,
                  context: `${stats.data.expected_employee_files} of ${stats.data.ems_employees}`,
                },
                {
                  label: "Initialized",
                  value: stats.data.employee_files_initialized,
                  context: `${stats.data.employee_files_initialized} of ${stats.data.expected_employee_files}`,
                },
                {
                  label: "Synced",
                  value: stats.data.successfully_synced,
                  context: "Initialized minus open issues",
                },
                {
                  label: "Needs attention",
                  value: stats.data.needs_attention,
                  context: "Open issues only",
                  href: "/pages/employee?tab=issues",
                },
                {
                  label: "Excluded",
                  value: stats.data.excluded,
                  context: "Not in Employee Files",
                  href: "/pages/employee?tab=issues&category=excluded",
                },
              ].map((card) => {
                const className =
                  "rounded-lg border border-border bg-background p-3 text-left";
                if (!card.href) {
                  return (
                    <div key={card.label} className={className}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {card.label}
                      </span>
                      <strong className="mt-1 block text-2xl">{card.value}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {card.context}
                      </span>
                    </div>
                  );
                }
                return (
                  <button
                    key={card.label}
                    type="button"
                    onClick={() => router.push(card.href!)}
                    className={`${className} transition-colors hover:bg-muted/40`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </span>
                    <strong className="mt-1 block text-2xl">{card.value}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {card.context}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <SectionTabs
            level="nested"
            ariaLabel="Browse view"
            value={view}
            onChange={(value) => {
              const next = value as HomeView;
              setView(next);
              const params = new URLSearchParams(searchParams.toString());
              if (next === "groups") params.delete("view");
              else params.set("view", next);
              const query = params.toString();
              router.replace(query ? `/pages/employee?${query}` : "/pages/employee");
            }}
            items={[
              { id: "groups", label: "Employee files" },
              { id: "employees", label: "Employees" },
              { id: "documents", label: "Documents" },
            ]}
          />
          <div className="app-table-well app-page-body">
            <EmployeeFilesBrowseToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={searchPlaceholder}
              layoutMode={browsePrefs.layoutMode}
              onLayoutModeChange={(mode) => persistPrefs({ layoutMode: mode })}
              showLayoutToggle={view !== "groups"}
              showDocumentFilters={view === "documents"}
              showEmployeeFilters={view === "employees"}
              groupByOptions={view === "groups" ? dimensionTabs : undefined}
              groupByValue={primaryDimension}
              onGroupByChange={setDimension}
              documentFilters={documentFilters}
              onDocumentFiltersChange={setDocumentFilters}
              employeeDepartmentId={employeeDepartmentId}
              onEmployeeDepartmentChange={setEmployeeDepartmentId}
              employeeAttentionFilter={employeeAttentionFilter}
              onEmployeeAttentionFilterChange={setEmployeeAttentionFilter}
              documentTypes={typeOptions}
              departments={departments}
              documentColumns={browsePrefs.documentColumns}
              onDocumentColumnsChange={(cols) =>
                persistPrefs({ documentColumns: cols })
              }
              employeeColumns={browsePrefs.employeeColumns}
              onEmployeeColumnsChange={(cols) =>
                persistPrefs({ employeeColumns: cols })
              }
              resultCount={
                view === "documents"
                  ? documentSearch.data?.items.length
                  : view === "employees"
                    ? employeeList.data?.items.length
                    : undefined
              }
              totalCount={
                view === "documents"
                  ? documentSearch.data?.total
                  : view === "employees"
                    ? employeeList.data?.total
                    : undefined
              }
            />

            {view === "groups" ? (
              <EmployeeFilesGroupExplorer
                groups={homeGroups.data ?? []}
                search={search}
                memberSort={browsePrefs.employeeSort}
                onMemberSortChange={(order) => persistPrefs({ employeeSort: order })}
                groupSort={browsePrefs.groupSort}
                onGroupSortChange={(order) => persistPrefs({ groupSort: order })}
                memberAttentionFilter={employeeAttentionFilter}
              />
            ) : null}

            {view === "employees" ? (
              stats.data?.employee_files_initialized ? (
                <EmployeeFilesEmployeeResults
                  items={employeeList.data?.items ?? []}
                  total={employeeList.data?.total ?? 0}
                  page={employeePage}
                  pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
                  onPageChange={setEmployeePage}
                  layoutMode={browsePrefs.layoutMode}
                  visibleColumns={browsePrefs.employeeColumns}
                  sortKey={browsePrefs.employeeSort}
                  onSortChange={(order) => persistPrefs({ employeeSort: order })}
                  isLoading={employeeList.isLoading}
                />
              ) : !stats.isLoading ? (
                <EmptyState
                  title="No employee files yet"
                  description="Initialize employee files from Settings to start browsing records."
                />
              ) : null
            ) : null}

            {view === "documents" ? (
              <EmployeeFilesDocumentResults
                items={documentSearch.data?.items ?? []}
                total={documentSearch.data?.total ?? 0}
                page={documentPage}
                pageSize={DOCUMENT_PAGE_SIZE}
                onPageChange={setDocumentPage}
                layoutMode={browsePrefs.layoutMode}
                visibleColumns={browsePrefs.documentColumns}
                sortKey={browsePrefs.documentSort}
                onSortChange={(order) => persistPrefs({ documentSort: order })}
                isLoading={documentSearch.isLoading}
                onOpenDocument={setViewingDocument}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {viewingDocument ? (
        <DocumentViewerDialog
          title={viewingDocument.name}
          eyebrow="Employee files"
          description={[
            viewingDocument.document_type,
            viewingDocument.employee_name,
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={() => setViewingDocument(null)}
          documentId={viewingDocument.id}
          currentVersionNumber={viewingDocument.current_version_number}
          previewUrl={documentPreviewUrl(viewingDocument.id)}
        />
      ) : null}
    </div>
  );
}
