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
import {
  useApprovalInbox,
  useDocumentTypes,
  usePendingEmployeeUploads,
} from "../../../hooks/useDocuments";
import SectionTabs from "./SectionTabs";
import EmployeeFilesGroupExplorer from "./EmployeeFilesGroupExplorer";
import EmployeeFilesGroupCardGrid from "./EmployeeFilesGroupCardGrid";
import EmployeeFilesBrowseToolbar from "./EmployeeFilesBrowseToolbar";
import EmployeeFilesDocumentResults from "./EmployeeFilesDocumentResults";
import EmployeeFilesEmployeeResults from "./EmployeeFilesEmployeeResults";
import { employeeFileDimensionLabel } from "../../../lib/employeeFileDimensions";
import type { EmployeeFileGroup } from "../../../lib/types";
import EmployeeFilesIssuesPage from "./EmployeeFilesIssuesPage";
import EmployeeFilesPendingApprovalsPanel from "./EmployeeFilesPendingApprovalsPanel";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import {
  DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS,
  loadEmployeeFilesBrowsePreferences,
  saveEmployeeFilesBrowsePreferences,
  type EmployeeFilesBrowseFilters,
} from "../../../lib/employeeFilesBrowsePreferences";

type HomeView = "groups" | "employees" | "documents";
type WorkspaceTab = "browse" | "pending-approvals" | "issues";

const DOCUMENT_PAGE_SIZE = 25;

function workspaceTabFromParam(value: string | null): WorkspaceTab {
  if (value === "issues") return "issues";
  if (value === "pending-approvals" || value === "pending") return "pending-approvals";
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
  const workspaceTab = workspaceTabFromParam(searchParams.get("tab"));
  const config = useEmployeeFilesConfig();
  const stats = useEmployeeFilesHomeStats();
  const documentTypes = useDocumentTypes();
  const pendingUploads = usePendingEmployeeUploads(true);
  const approvalInbox = useApprovalInbox(true);

  const [browsePrefs, setBrowsePrefs] = useState(() =>
    loadEmployeeFilesBrowsePreferences(),
  );
  const [view, setView] = useState<HomeView>("groups");
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState("");
  const [documentFilters, setDocumentFilters] = useState<EmployeeFilesBrowseFilters>(
    DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS,
  );
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState("all");
  const [employeePage, setEmployeePage] = useState(1);
  const [documentPage, setDocumentPage] = useState(1);

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
  const pendingApprovalCount = useMemo(() => {
    const uploadItems = pendingUploads.data?.items ?? [];
    const inboxDocumentIds = new Set(
      (approvalInbox.data?.items ?? []).map((item) => item.document_id),
    );
    const rows = uploadItems.filter(
      (item) =>
        !inboxDocumentIds.has(item.id) || item.status !== "pending_review",
    );
    return rows.length + (approvalInbox.data?.count ?? 0);
  }, [
    pendingUploads.data?.items,
    approvalInbox.data?.items,
    approvalInbox.data?.count,
  ]);

  const dimensionTabs = useMemo(
    () =>
      (config.data?.organizing_dimensions ?? []).map((key) => ({
        id: key,
        label: `By ${employeeFileDimensionLabel(key)}`,
      })),
    [config.data?.organizing_dimensions],
  );

  const setWorkspaceTab = (tab: WorkspaceTab) => {
    if (tab === "browse") {
      router.push("/pages/employee");
      return;
    }
    router.push(`/pages/employee?tab=${tab}`);
  };

  useEffect(() => {
    setEmployeePage(1);
    setDocumentPage(1);
  }, [
    debouncedSearch,
    employeeDepartmentId,
    documentFilters,
    view,
  ]);

  const searchPlaceholder =
    view === "documents"
      ? "Search by document name, employee, or employee ID…"
      : view === "employees"
        ? "Search by employee name, ID, or department…"
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
    <div className="min-h-full mx-auto w-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <SectionTabs
        ariaLabel="Employee Files sections"
        value={workspaceTab}
        onChange={(value) => setWorkspaceTab(value as WorkspaceTab)}
        items={[
          { id: "browse", label: "Browse" },
          {
            id: "pending-approvals",
            label: "Pending approvals",
            count: pendingApprovalCount || undefined,
          },
          {
            id: "issues",
            label: "Issues",
            count: attention > 0 ? attention : undefined,
          },
        ]}
      />

      {workspaceTab === "issues" ? (
        <EmployeeFilesIssuesPage embedded />
      ) : null}

      {workspaceTab === "pending-approvals" ? (
        <EmployeeFilesPendingApprovalsPanel />
      ) : null}

      {workspaceTab === "browse" ? (
        <>
          {stats.data ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MiniStat label="EMS employees" value={stats.data.ems_employees} />
              <MiniStat label="Expected files" value={stats.data.expected_employee_files} />
              <MiniStat label="Initialized" value={stats.data.employee_files_initialized} />
              <MiniStat label="Synced" value={stats.data.successfully_synced} />
              <MiniStat label="Needs attention" value={stats.data.needs_attention} />
              <MiniStat label="Excluded" value={stats.data.excluded} />
            </div>
          ) : null}

          <SectionTabs
            ariaLabel="Employee Files views"
            value={view}
            onChange={(value) => setView(value as HomeView)}
            items={[
              { id: "groups", label: "Employee files" },
              { id: "employees", label: "Employees" },
              { id: "documents", label: "Documents" },
            ]}
          />

          <EmployeeFilesBrowseToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={searchPlaceholder}
            layoutMode={browsePrefs.layoutMode}
            onLayoutModeChange={(mode) => persistPrefs({ layoutMode: mode })}
            showDocumentFilters={view === "documents"}
            showEmployeeFilters={view === "employees"}
            documentFilters={documentFilters}
            onDocumentFiltersChange={setDocumentFilters}
            employeeDepartmentId={employeeDepartmentId}
            onEmployeeDepartmentChange={setEmployeeDepartmentId}
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
            <div className="space-y-4">
              {dimensionTabs.length > 1 ? (
                <SectionTabs
                  ariaLabel="Organizing dimension"
                  value={primaryDimension}
                  onChange={setDimension}
                  items={dimensionTabs}
                />
              ) : null}
              {browsePrefs.layoutMode === "card" ? (
                <EmployeeFilesGroupCardGrid
                  groups={homeGroups.data ?? []}
                  search={search}
                />
              ) : (
                <EmployeeFilesGroupExplorer
                  groups={homeGroups.data ?? []}
                  search={search}
                />
              )}
            </div>
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
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No employee files have been initialized yet.
              </p>
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
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
