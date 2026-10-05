"use client";

import {
  FileText,
  FolderPlus,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ModalDialog from "./ModalDialog";
import DepartmentAutocomplete, {
  type DepartmentOption,
  type EmployeeOption,
} from "./DepartmentAutocomplete";
import {
  useCreateFolder,
  useCurrentUser,
  useDocumentTypes,
  useDocuments,
  useFolders,
  useComplianceTargets,
  useOrganizationalDefaults,
  useSettings,
  useWorkspaceActivity,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import ViewToggle from "./ViewToggle";
import OrganizationalLibraryTree, {
  type AckPercentFilter,
} from "./OrganizationalLibraryTree";
import FolderExplorerAccordion from "./FolderExplorerAccordion";
import FolderApprovalFields, {
  approvalFlowLabel,
  type ApprovalFlow,
  validateFolderApproval,
} from "./FolderApprovalFields";
import OrganizationalVisibilityFields, {
  validateOrganizationalVisibility,
  visibilityFromOrganizationalDefaults,
  visibilityToAccessScope,
  type OrgVisibilityMode,
} from "./OrganizationalVisibilityFields";
import {
  canCreateOrgFolder,
  canCreateOrgPolicy,
  canManageOrgDocuments,
  canManageOrgFolders,
  canUploadOrgDocuments,
} from "../../../lib/organizationalFilesAccess";
import BulkFolderActions from "./BulkFolderActions";
import FolderPickerDialog from "./FolderPickerDialog";
import { folderIdsWithDescendants } from "./FolderTreePicker";
import { api } from "../../../lib/api";
import AppToolbar from "./AppToolbar";
import EmptyState from "./EmptyState";
import NewMenu from "./NewMenu";
import OrganizationalNewMenu from "./OrganizationalNewMenu";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  prefillFromSearchParams,
  readCreateFolderIntent,
  type CreateFolderPrefill,
} from "../../../lib/createFolderIntent";
import { formatFieldLabel } from "../../../lib/formatLabel";
import { folderCardStyle, folderWellStyle } from "../../../lib/folderColor";
import FolderDescriptionAssist from "./FolderDescriptionAssist";
import OrgFolderIcon from "./OrgFolderIcon";
import SectionTabs from "./SectionTabs";
import OrganizationalPoliciesPanel from "./OrganizationalPoliciesPanel";
import OrganizationalStorageBar from "./OrganizationalStorageBar";
import { useToast } from "../../../hooks/useToast";
import {
  isPendingApprovalResponse,
  notifyPendingApproval,
} from "../../../lib/pendingApproval";

type PageKind = "employee" | "organization" | "organizational";
type ViewMode = "list" | "cards";
export default function DocumentListPage({ kind }: { kind: PageKind }) {
  const folders = useFolders();
  const documents = useDocuments();
  const complianceTargets = useComplianceTargets();
  const currentUser = useCurrentUser();
  const params = useSearchParams();
  const router = useRouter();
  const isOrganizationPage = kind === "organization";
  const orgSectionTab =
    isOrganizationPage && params.get("tab") === "policies" ? "policies" : "folders";
  const workspaceActivity = useWorkspaceActivity(isOrganizationPage);
  const guideTarget = params.get("guide");
  const createQuery = params.get("create");
  const departmentIdQuery = params.get("department_id");
  const employeeIdQuery = params.get("employee_id");
  const folderNameQuery = params.get("folder_name");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { showToast } = useToast();
  const libraryHome = useQuery({
    queryKey: ["organizational-library-home"],
    queryFn: () => api.getOrganizationalLibraryHome(),
    enabled: isOrganizationPage,
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [movingFolders, setMovingFolders] = useState(false);
  const [movingFoldersPending, setMovingFoldersPending] = useState(false);
  const { showAlert } = useAppDialog();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateFolderPrefill>({});
  const [showFilters, setShowFilters] = useState(false);
  const [librarySortKey, setLibrarySortKey] = useState("name asc");
  const [complianceFilter, setComplianceFilter] = useState<"all" | "attention" | "complete">("all");
  const isEmployeePage = kind === "employee";
  const canCreateFolder =
    kind === "organization"
      ? canCreateOrgFolder(currentUser.data)
      : currentUser.data?.is_document_manager === true;
  const canUploadOrg = canUploadOrgDocuments(currentUser.data);
  const [ackPercentFilters, setAckPercentFilters] = useState<AckPercentFilter[]>(
    [],
  );
  const [folderLockFilters, setFolderLockFilters] = useState<
    Array<"locked" | "unlocked" | "archived">
  >([]);
  useEffect(() => {
    const fromParams = prefillFromSearchParams(params);
    const fromStorage = readCreateFolderIntent();
    const shouldOpen = createQuery === "1" || Boolean(fromStorage);
    if (!shouldOpen) return;
    setCreatePrefill({
      departmentId: fromStorage?.departmentId ?? fromParams.departmentId,
      employeeId: fromStorage?.employeeId ?? fromParams.employeeId,
      folderName: fromStorage?.folderName ?? fromParams.folderName,
    });
    setShowCreateFolder(true);
  }, [createQuery, departmentIdQuery, employeeIdQuery, folderNameQuery, params]);

  const visibleFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (folders.data ?? [])
      .filter(
        (folder) =>
          folder.folder_type ===
          (kind === "employee" ? "employee" : "organizational"),
      )
      .filter(
        (folder) =>
          !query ||
          `${folder.folder_name} ${folder.description}`
            .toLowerCase()
            .includes(query),
      );
  }, [folders.data, kind, search]);

  const rows = useMemo(
    () =>
      visibleFolders.map((folder) => {
        const folderDocuments = (documents.data ?? []).filter(
          (document) => document.folder_id === folder.id,
        );
        const approved = folderDocuments.filter(
          (document) =>
            document.approval_state === "approved" ||
            document.approval_state === "not_required",
        ).length;
        return {
          folder,
          documents: folderDocuments,
          employees: folder.employee_ids?.length ?? 0,
          compliance: folderDocuments.length
            ? Math.round((approved / folderDocuments.length) * 100)
            : 0,
        };
      }),
    [documents.data, visibleFolders],
  );

  const filteredRows = (isEmployeePage
    ? rows
    : rows.filter(({ compliance }) =>
        complianceFilter === "all"
          ? true
          : complianceFilter === "complete"
            ? compliance === 100
            : compliance < 100,
      )
  ).filter(({ folder }) => {
    if (!folderLockFilters.length) return true;
    const locked = Boolean(folder.locked || folder.is_locked);
    const archived = Boolean(
      folder.active === false || folder.distribution_status === "archived",
    );
    const matchLocked =
      folderLockFilters.includes("locked") && locked && !archived;
    const matchUnlocked =
      folderLockFilters.includes("unlocked") && !locked && !archived;
    const matchArchived = folderLockFilters.includes("archived") && archived;
    return matchLocked || matchUnlocked || matchArchived;
  });
  const isLoading = folders.isLoading || documents.isLoading;
  const visibleIds = filteredRows.map(({ folder }) => folder.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  return (
    <>
    <div className="app-page space-y-6">
      {isOrganizationPage ? (
        <LibraryBreadcrumb items={[{ label: "Organizational Files" }]} />
      ) : null}
      {isOrganizationPage ? (
        <SectionTabs
          ariaLabel="Organizational library sections"
          value={orgSectionTab}
          onChange={(value) => {
            const nextParams = new URLSearchParams(params.toString());
            if (value === "folders") nextParams.delete("tab");
            else nextParams.set("tab", value);
            const query = nextParams.toString();
            router.replace(
              query ? `/pages/organization?${query}` : "/pages/organization",
            );
          }}
          items={[
            { id: "folders", label: "Folders" },
            { id: "policies", label: "Policies" },
          ]}
        />
      ) : null}
      <section className="app-table-well app-page-body">
        <AppToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            kind === "employee"
              ? "Search employees, departments, folders..."
              : "Search folders, policies..."
          }
          extras={
            !isEmployeePage ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={showFilters}
                  aria-controls="folder-filters"
                  onClick={() => setShowFilters((current) => !current)}
                >
                  <SlidersHorizontal data-icon="inline-start" />
                  Filters
                </Button>
              </>
            ) : null
          }
          toggle={
            <ViewToggle
              value={viewMode === "cards" ? "card" : "list"}
              onChange={(value) => setViewMode(value === "card" ? "cards" : "list")}
              ariaLabel="Folder view mode"
            />
          }
          actions={
            <>
              {kind === "employee" && currentUser.data?.is_document_admin === true ? (
                <Button
                  variant="outline"
                  render={<Link href="/pages/employee?tab=compliance" />}
                >
                  <ShieldCheck data-icon="inline-start" />
                  Compliance
                </Button>
              ) : null}
              {isOrganizationPage &&
              (canCreateFolder || canCreateOrgPolicy(currentUser.data)) ? (
                <OrganizationalNewMenu
                  canUpload={canUploadOrg}
                  canCreateFolder={canCreateFolder}
                  canCreatePolicy={canCreateOrgPolicy(currentUser.data)}
                  libraryTab={orgSectionTab}
                  onCreateRootFolder={() => setShowCreateFolder(true)}
                />
              ) : canCreateFolder ? (
                <NewMenu
                  items={[
                    {
                      label: "Folder",
                      icon: FolderPlus,
                      onSelect: () => setShowCreateFolder(true),
                    },
                  ]}
                />
              ) : null}
            </>
          }
          footer={
            showFilters && !isEmployeePage ? (
              <div
                id="folder-filters"
                className="w-full space-y-3"
                role="region"
                aria-label="Folder filters"
              >
            {isOrganizationPage ? (
              <section className="employee-filter-section !border-0 !p-0">
                <h3 className="employee-filter-section-title">Acknowledgement %</h3>
                <div className="employee-filter-options !max-h-none md:grid-cols-2">
                  {(
                    [
                      ["below100", "Below 100%"],
                      ["below90", "Below 90%"],
                      ["below80", "Below 80%"],
                      ["above80", "80% and above"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="employee-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={ackPercentFilters.includes(value)}
                        onChange={() =>
                          setAckPercentFilters((current) =>
                            current.includes(value)
                              ? current.filter((item) => item !== value)
                              : [...current, value],
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="employee-filter-section !border-0 !p-0">
              <h3 className="employee-filter-section-title">Folder status</h3>
              <div className="employee-filter-options !max-h-none">
                {([
                  ["all", "All folders"],
                  ["attention", "Needs attention"],
                  ["complete", "Complete"],
                ] as const).map(([value, label]) => (
                  <label key={value} className="employee-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={complianceFilter === value}
                      onChange={() => setComplianceFilter(value)}
                      className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>
            {isOrganizationPage ? (
              <section className="employee-filter-section !border-0 !p-0">
                <h3 className="employee-filter-section-title">Folder state</h3>
                <div className="employee-filter-options !max-h-none">
                  {([
                    ["locked", "Locked"],
                    ["unlocked", "Unlocked"],
                    ["archived", "Archived"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="employee-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={folderLockFilters.includes(value)}
                        onChange={() =>
                          setFolderLockFilters((current) =>
                            current.includes(value)
                              ? current.filter((item) => item !== value)
                              : [...current, value],
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
              </div>
            ) : null
          }
        />
        <div className="px-4 pt-4">
          <BulkFolderActions
            selected={selected}
            onClear={() => setSelected([])}
            organizational={isOrganizationPage}
            onMove={
              isOrganizationPage ? () => setMovingFolders(true) : undefined
            }
          />
        </div>

        {isOrganizationPage && orgSectionTab === "policies" ? (
          <OrganizationalPoliciesPanel
            search={search}
            canManageFolders={
              currentUser.data?.is_document_manager === true ||
              canManageOrgFolders(currentUser.data) ||
              canManageOrgDocuments(currentUser.data)
            }
          />
        ) : null}
        {(folders.error || documents.error) && (
          <p className="m-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            Unable to load this library.
          </p>
        )}
        {isOrganizationPage && orgSectionTab === "folders" ? (
          <div className="mb-2">
            <OrganizationalStorageBar storage={libraryHome.data?.storage} />
          </div>
        ) : null}
        {isOrganizationPage && orgSectionTab === "policies" ? null : isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : viewMode === "list" ? (
          isOrganizationPage ? (
            <>
              {workspaceActivity.isError && (
                <p className="mx-4 mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                  Acknowledgement percentages could not be loaded. Folders are still
                  available.
                </p>
              )}
              <OrganizationalLibraryTree
                rows={filteredRows}
                ackFolders={
                  workspaceActivity.data?.pending_acknowledgements_by_folder ?? []
                }
                selectedFolderIds={selected}
                onToggleFolderSelected={toggleSelected}
                isDocumentManager={
                  currentUser.data?.is_document_manager === true
                }
                guideTarget={guideTarget}
                search={search}
                percentFilters={ackPercentFilters}
                sortKey={librarySortKey}
                onSortChange={setLibrarySortKey}
              />
            </>
          ) : (
            <FolderExplorerAccordion
              kind="employee"
              rows={filteredRows}
              targets={complianceTargets.data}
              selected={selected}
              onToggleSelected={toggleSelected}
              isDocumentManager={currentUser.data?.is_document_manager === true}
              guideTarget={guideTarget}
            />
          )
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredRows.map(
              ({
                folder,
                documents: folderDocuments,
                employees,
              }) => (
                <article
                  key={folder.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-pink/30 hover:shadow-lg hover:shadow-pink-100"
                  style={folderCardStyle(folder.color_hex)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selected.includes(folder.id)}
                        onCheckedChange={() => toggleSelected(folder.id)}
                        aria-label={`Select ${folder.folder_name}`}
                      />
                      <div
                        className="rounded-xl bg-pink-50 p-3 text-brand-pink"
                        style={
                          isOrganizationPage
                            ? undefined
                            : folderWellStyle(folder.color_hex)
                        }
                      >
                        <OrgFolderIcon
                          className="h-10 w-10"
                          folderKind={
                            kind === "employee"
                              ? "employee"
                              : folder.folder_kind
                          }
                          hasContent={
                            folderDocuments.length > 0 ||
                            (kind === "employee" && employees > 0)
                          }
                          documents={folderDocuments}
                        />
                      </div>
                    </div>
                  </div>
                  <h2 className="mt-5 font-bold text-slate-900">
                    <Link
                      href={
                        kind === "employee"
                          ? `/pages/employee/folder?folder=${folder.id}`
                          : `/pages/organization/folder?folder=${folder.id}${guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""}`
                      }
                      className="hover:text-brand-pink"
                    >
                      {folder.folder_name}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                    {folder.description}
                  </p>
                  <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                    {kind === "employee" && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-brand-pink" />
                        {employees} employees
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-brand-pink" />
                      {folderDocuments.length} documents
                    </span>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
        {!isLoading && !filteredRows.length && (
          <EmptyState
            title={
              visibleFolders.length === 0
                ? isEmployeePage
                  ? "No employee folders yet"
                  : "No organizational folders yet"
                : "No folders match your filters"
            }
            description={
              visibleFolders.length === 0
                ? isEmployeePage
                  ? "Create a folder to group employee files and documents."
                  : "Create a folder to publish policies and shared documents."
                : search.trim()
                  ? "Try a different search term."
                  : "Clear filters to see all folders."
            }
            action={
              visibleFolders.length === 0 && canCreateFolder ? (
                isOrganizationPage ? (
                  <OrganizationalNewMenu
                    canUpload={canUploadOrg}
                    canCreateFolder={canCreateFolder}
                    canCreatePolicy={canCreateOrgPolicy(currentUser.data)}
                    libraryTab={orgSectionTab}
                    onCreateRootFolder={() => setShowCreateFolder(true)}
                  />
                ) : (
                <NewMenu
                  items={[
                    {
                      label: "Folder",
                      icon: FolderPlus,
                      onSelect: () => setShowCreateFolder(true),
                    },
                  ]}
                />
                )
              ) : search.trim() || complianceFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setComplianceFilter("all");
                    setAckPercentFilters([]);
                  }}
                  className="app-btn app-btn-secondary"
                >
                  Clear search and filters
                </button>
              ) : null
            }
          />
        )}
      </section>
      {showCreateFolder && (
        <FolderCreateModal
          kind={kind === "organization" ? "organizational" : kind}
          initialDepartmentId={createPrefill.departmentId}
          initialEmployeeId={createPrefill.employeeId}
          initialFolderName={createPrefill.folderName || ""}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
      {movingFolders ? (
        <FolderPickerDialog
          title="Move folders"
          folders={folders.data ?? []}
          excludeIds={folderIdsWithDescendants(folders.data ?? [], selected)}
          allowRoot
          confirmLabel="Move"
          pending={movingFoldersPending}
          onClose={() => setMovingFolders(false)}
          onPick={async (parentId) => {
            setMovingFoldersPending(true);
            try {
              for (const id of selected) {
                const result = await api.moveOrganizationalFolder({
                  folder_id: id,
                  parent_id: parentId || false,
                });
                if (!result.success) {
                  await showAlert(result.message || "Unable to move this folder.", {
                    title: "Move folders",
                  });
                  return;
                }
              }
              setMovingFolders(false);
              setSelected([]);
            } finally {
              setMovingFoldersPending(false);
            }
          }}
        />
      ) : null}
    </div>
    </>
  );
}

function FolderCreateModal({
  kind,
  onClose,
  initialDepartmentId,
  initialEmployeeId,
  initialFolderName = "",
}: {
  kind: PageKind;
  onClose: () => void;
  initialDepartmentId?: number;
  initialEmployeeId?: number;
  initialFolderName?: string;
}) {
  const create = useCreateFolder();
  const { showAlert } = useAppDialog();
  const { showToast } = useToast();
  const documentTypes = useDocumentTypes();
  const targets = useComplianceTargets();
  const folders = useFolders();
  const settingsQuery = useSettings();
  const orgDefaultsQuery = useOrganizationalDefaults(kind === "organizational");
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessScope] = useState("all_staff");
  const [retention, setRetention] = useState("7");
  const [requireUploadApproval, setRequireUploadApproval] = useState(false);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow>("any");
  const [approverIds, setApproverIds] = useState<number[]>([]);
  const [allowedTypes, setAllowedTypes] = useState<number[]>([]);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [gradeIds, setGradeIds] = useState<number[]>([]);
  const [scopeIds, setScopeIds] = useState<number[]>([]);
  const [scopeSearch, setScopeSearch] = useState("");
  const [visibilityMode, setVisibilityMode] =
    useState<OrgVisibilityMode>("private");
  const [restrictedScope, setRestrictedScope] = useState("department");
  const [advancedSearch, setAdvancedSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );

  const employees = targets.data?.employees ?? [];
  const departments = targets.data?.departments ?? [];
  const grades = targets.data?.grades ?? [];
  const approverOptions =
    settingsQuery.data?.approvers?.map((item: { id: number; name: string; email?: string }) => ({
      id: item.id,
      name: item.name,
      email: item.email,
    })) ?? [];

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) return;
    if (kind === "employee") {
      setRequireUploadApproval(Boolean(settings.default_require_upload_approval));
      setApprovalFlow((settings.default_approval_flow as ApprovalFlow) || "any");
      setApproverIds(
        Array.isArray(settings.default_approver_ids)
          ? settings.default_approver_ids.map(Number)
          : [],
      );
    }
    if (kind === "organizational") {
      setRetention(settings.default_retention_period || "7");
    }
  }, [kind, settingsQuery.data?.settings]);

  useEffect(() => {
    if (kind !== "organizational") return;
    const settings = settingsQuery.data?.settings;
    const orgDefaults = orgDefaultsQuery.data;
    const source = settings?.default_org_access_scope
      ? settings
      : orgDefaults || settings;
    if (!source) return;
    const initial = visibilityFromOrganizationalDefaults(source);
    setVisibilityMode(initial.mode);
    setRestrictedScope(initial.restrictedScope);
  }, [kind, settingsQuery.data?.settings, orgDefaultsQuery.data]);

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    return employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      department_id: employee.department_id,
      department_name: employee.department || "No department",
      job_title: employee.job_title,
    }));
  }, [employees]);

  const departmentOptions = useMemo<DepartmentOption[]>(() => {
    return departments.map((department) => ({
      id: department.id,
      name: department.name,
      employeeCount: employees.filter(
        (employee) => employee.department_id === department.id,
      ).length,
    }));
  }, [departments, employees]);

  useEffect(() => {
    if (kind !== "employee" || !targets.data) return;
    if (initialEmployeeId) {
      const employee = employees.find((item) => item.id === initialEmployeeId);
      if (employee?.department_id) {
        const department = departmentOptions.find(
          (item) => item.id === employee.department_id,
        );
        if (department) {
          setSelectedEmployeeId(employee.id);
          setName(department.name);
          setDepartmentIds([department.id]);
          return;
        }
      }
    }
    if (initialDepartmentId) {
      const department = departmentOptions.find(
        (item) => item.id === initialDepartmentId,
      );
      if (department) {
        setName(department.name);
        setDepartmentIds([department.id]);
        return;
      }
    }
    if (initialFolderName) {
      setName(initialFolderName);
      if (initialDepartmentId) setDepartmentIds([initialDepartmentId]);
    }
  }, [
    departmentOptions,
    employees,
    initialDepartmentId,
    initialEmployeeId,
    initialFolderName,
    kind,
    targets.data,
  ]);

  const existingFolderByDepartmentId = useMemo(() => {
    const map = new Map<number, string>();
    for (const folder of folders.data ?? []) {
      if (folder.folder_type !== "employee") continue;
      for (const departmentId of folder.department_ids ?? []) {
        map.set(departmentId, folder.folder_name);
      }
    }
    return map;
  }, [folders.data]);

  const primaryDepartmentId =
    departmentIds.length === 1 ? departmentIds[0] : null;

  const employeeCount = useMemo(() => {
    if (kind !== "employee" || !departmentIds.length) return 0;
    return employees.filter((employee) => {
      const inDepartment = departmentIds.includes(
        employee.department_id as number,
      );
      const inGrade =
        !gradeIds.length ||
        gradeIds.includes(employee.grade_id as number);
      return inDepartment && inGrade;
    }).length;
  }, [departmentIds, employees, gradeIds, kind]);

  const departmentLabels = useMemo(
    () =>
      departments
        .filter((item) => departmentIds.includes(item.id))
        .map((item) => item.name),
    [departmentIds, departments],
  );

  const gradeLabels = useMemo(
    () =>
      grades
        .filter((item) => gradeIds.includes(item.id))
        .map((item) => item.name),
    [gradeIds, grades],
  );

  const scopeLabels = useMemo(() => {
    if (kind === "employee") return departmentLabels;
    const source =
      accessScope === "department"
        ? departments
        : accessScope === "grade"
          ? grades
          : accessScope === "individual"
            ? employees
            : [];
    return (source ?? [])
      .filter((item: { id: number }) => scopeIds.includes(item.id))
      .map((item: { name: string }) => item.name);
  }, [accessScope, departmentLabels, departments, employees, grades, kind, scopeIds]);

  const departmentConflict = useMemo(() => {
    for (const departmentId of departmentIds) {
      const folderName = existingFolderByDepartmentId.get(departmentId);
      if (folderName) {
        const departmentName =
          departments.find((item) => item.id === departmentId)?.name ??
          "this department";
        return { departmentName, folderName };
      }
    }
    return null;
  }, [departmentIds, departments, existingFolderByDepartmentId]);

  const approvalError = useMemo(
    () =>
      kind === "employee"
        ? validateFolderApproval(
            requireUploadApproval,
            approvalFlow,
            approverIds,
          )
        : null,
    [approvalFlow, approverIds, kind, requireUploadApproval],
  );

  const configureError = useMemo(() => {
    if (kind !== "employee") return null;
    if (departmentConflict) {
      return `A folder already exists for ${departmentConflict.departmentName}.`;
    }
    if (name.trim() && !departmentIds.length) {
      return "Select an employee or department from the suggestions, or use Advanced configuration.";
    }
    return approvalError;
  }, [
    approvalError,
    departmentConflict,
    departmentIds.length,
    kind,
    name,
  ]);

  const canProceed =
    kind === "employee"
      ? departmentIds.length > 0 && !departmentConflict && !approvalError
      : true;

  const handleSelectDepartment = (department: DepartmentOption) => {
    setSelectedEmployeeId(null);
    setName(department.name);
    setDepartmentIds([department.id]);
  };

  const handleSelectEmployee = (employee: EmployeeOption) => {
    if (!employee.department_id) return;
    const department = departmentOptions.find(
      (item) => item.id === employee.department_id,
    );
    if (!department) return;
    setSelectedEmployeeId(employee.id);
    setName(department.name);
    setDepartmentIds([department.id]);
  };

  const clearDepartmentSelection = () => {
    setDepartmentIds([]);
    setSelectedEmployeeId(null);
  };

  const toggleDepartment = (departmentId: number) => {
    setSelectedEmployeeId(null);
    setDepartmentIds((current) => {
      const next = current.includes(departmentId)
        ? current.filter((id) => id !== departmentId)
        : [...current, departmentId];
      if (next.length >= 1) {
        const selected = departments.find((item) => item.id === next[0]);
        if (selected) setName(selected.name);
      } else {
        setName("");
      }
      return next;
    });
  };

  const toggleGrade = (gradeId: number) => {
    setGradeIds((current) =>
      current.includes(gradeId)
        ? current.filter((id) => id !== gradeId)
        : [...current, gradeId],
    );
  };

  const validateConfigure = async () => {
    if (kind === "organizational") {
      const scopeValidation = validateOrganizationalVisibility(
        visibilityMode,
        restrictedScope,
        scopeIds,
      );
      if (scopeValidation) {
        await showAlert(scopeValidation, { title: "Check folder details" });
        return false;
      }
      if (!name.trim()) {
        await showAlert("Folder name is required.", { title: "Check folder details" });
        return false;
      }
      if (name.trim().length > 100) {
        await showAlert("Folder name must be 100 characters or fewer.", {
          title: "Check folder details",
        });
        return false;
      }
      if (description.length > 500) {
        await showAlert("Description must be 500 characters or fewer.", {
          title: "Check folder details",
        });
        return false;
      }
    }
    if (kind === "employee" && !canProceed) {
      await showAlert(
        configureError || "Select at least one existing department.",
        { title: "Check folder details" },
      );
      return false;
    }
    if (kind === "employee" && approvalError) {
      await showAlert(approvalError, { title: "Check folder details" });
      return false;
    }
    return true;
  };

  const goToReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!(await validateConfigure())) return;
    setStep("review");
  };

  const resolvedOrgScope =
    kind === "organizational"
      ? visibilityToAccessScope(visibilityMode, restrictedScope)
      : accessScope;

  const submit = async () => {
    const result = await create.mutateAsync({
      nameElm: name.trim(),
      descriptionElm: description.trim(),
      folder_type: kind,
      access_scope: resolvedOrgScope,
      ...(kind === "employee"
        ? {
            retention_period: retention,
            require_upload_approval: requireUploadApproval,
            approval_flow: approvalFlow,
            approver_ids: approverIds,
            allowed_document_type_ids: allowedTypes,
          }
        : {}),
      department_ids:
        kind === "employee"
          ? departmentIds
          : resolvedOrgScope === "department"
            ? scopeIds
            : [],
      grade_ids:
        kind === "employee"
          ? gradeIds
          : resolvedOrgScope === "grade"
            ? scopeIds
            : [],
      employee_ids:
        kind === "organizational" && resolvedOrgScope === "individual"
          ? scopeIds
          : [],
    });
    if (isPendingApprovalResponse(result)) {
      notifyPendingApproval(result, showToast);
      onClose();
      return;
    }
    if (!result.success) {
      await showAlert(result.message || "Unable to create folder.", {
        title: "Unable to create folder",
      });
      return;
    }
    onClose();
  };

  const allowedTypeNames = (documentTypes.data ?? [])
    .filter((item: { id: number }) => allowedTypes.includes(item.id))
    .map((item: { name: string }) => item.name);

  const approverLabels = useMemo(
    () =>
      approverIds
        .map(
          (id) =>
            approverOptions.find((item) => item.id === id)?.name ?? `#${id}`,
        )
        .filter(Boolean),
    [approverIds, approverOptions],
  );

  const folderFormTitle = step === "configure" ? "Create folder" : "Review folder";
  const folderFormEyebrow =
    kind === "employee" ? "Employee folder" : "Organizational folder";
  const folderFormBody = (
    <>
      {step === "configure" ? (
        <form onSubmit={goToReview}>
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "employee" ? (
              <div className="sm:col-span-2">
                <span className="label">Employee or department</span>
                <div className="mt-2">
                  <DepartmentAutocomplete
                    value={name}
                    onChange={setName}
                    departments={departmentOptions}
                    employees={employeeOptions}
                    selectedDepartmentId={primaryDepartmentId}
                    selectedEmployeeId={selectedEmployeeId}
                    onSelectDepartment={handleSelectDepartment}
                    onSelectEmployee={handleSelectEmployee}
                    onClearSelection={clearDepartmentSelection}
                    existingFolderByDepartmentId={existingFolderByDepartmentId}
                    error={configureError ?? undefined}
                  />
                </div>
              </div>
            ) : (
              <label>
                <span className="label">
                  Folder name{" "}
                  <span className="font-normal text-slate-400">
                    ({name.trim().length}/100)
                  </span>
                </span>
                <input
                  required
                  maxLength={100}
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {kind === "organizational" && (
              <>
                <div className="sm:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="label mb-0">
                      Description{" "}
                      <span className="font-normal text-slate-400">
                        ({description.length}/500)
                      </span>
                    </span>
                    <FolderDescriptionAssist
                      name={name}
                      visibility={
                        visibilityMode === "public"
                          ? "Public, visible to all staff"
                          : visibilityMode === "private"
                            ? "Private"
                            : visibilityMode === "company_owned"
                              ? "Company owned"
                              : `Restricted (${formatFieldLabel(restrictedScope)})`
                      }
                      description={description}
                      onDescriptionChange={setDescription}
                    />
                  </div>
                  <textarea
                    maxLength={500}
                    className="field min-h-24"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what belongs in this folder, or suggest with AI"
                  />
                </div>
                <OrganizationalVisibilityFields
                  visibilityMode={visibilityMode}
                  onVisibilityModeChange={(mode) => {
                    setVisibilityMode(mode);
                    if (mode !== "restricted") setScopeIds([]);
                  }}
                  restrictedScope={restrictedScope}
                  onRestrictedScopeChange={(value) => {
                    setRestrictedScope(value);
                    setScopeIds([]);
                  }}
                  scopeIds={scopeIds}
                  onScopeIdsChange={setScopeIds}
                  scopeSearch={scopeSearch}
                  onScopeSearchChange={setScopeSearch}
                  departments={departments}
                  grades={grades}
                  employees={employees}
                />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Configuration summary
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    <li>
                      <span className="font-semibold">Visibility:</span>{" "}
                      {visibilityMode === "public"
                        ? "Public"
                        : visibilityMode === "private"
                          ? "Private"
                          : visibilityMode === "company_owned"
                            ? "Company owned"
                            : `Restricted (${formatFieldLabel(restrictedScope)})`}
                    </li>
                    <li>
                      <span className="font-semibold">Retention (inherited):</span>{" "}
                      {settingsQuery.data?.settings?.default_retention_period || retention}{" "}
                      years
                    </li>
                    <li>
                      <span className="font-semibold">Upload approval:</span> Not
                      required for organizational uploads
                    </li>
                  </ul>
                </div>
              </>
            )}
            {kind === "employee" && (
              <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">
                  Advanced configuration{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <span className="label">Departments</span>
                    <p className="mt-1 text-xs text-slate-500">
                      Select one or more departments. At least one is required.
                    </p>
                    <input
                      value={advancedSearch}
                      onChange={(event) => setAdvancedSearch(event.target.value)}
                      placeholder="Search departments..."
                      className="field mt-3"
                    />
                    <div className="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                      {departments
                        .filter((item) =>
                          item.name
                            .toLowerCase()
                            .includes(advancedSearch.toLowerCase()),
                        )
                        .map((item) => {
                          const taken = existingFolderByDepartmentId.get(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                                taken
                                  ? "cursor-not-allowed bg-amber-50 text-amber-900"
                                  : "bg-slate-50 hover:bg-pink-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={departmentIds.includes(item.id)}
                                disabled={Boolean(taken)}
                                onChange={() => toggleDepartment(item.id)}
                                className="h-4 w-4 accent-pink-600"
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {item.name}
                              </span>
                              {taken && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                  Exists
                                </span>
                              )}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <span className="label">Grades</span>
                    <p className="mt-1 text-xs text-slate-500">
                      Optional filter — only employees matching selected
                      departments and grades will be added.
                    </p>
                    <div className="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                      {grades.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-pink-50"
                        >
                          <input
                            type="checkbox"
                            checked={gradeIds.includes(item.id)}
                            onChange={() => toggleGrade(item.id)}
                            className="h-4 w-4 accent-pink-600"
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-pink-100 bg-pink-50/50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-semibold text-brand-text">
                      {employeeCount}
                    </span>{" "}
                    employee{employeeCount === 1 ? "" : "s"} will be added to
                    this folder.
                  </div>
                  <FolderApprovalFields
                    requireUploadApproval={requireUploadApproval}
                    onRequireUploadApprovalChange={setRequireUploadApproval}
                    approvalFlow={approvalFlow}
                    onApprovalFlowChange={setApprovalFlow}
                    approverIds={approverIds}
                    onApproverIdsChange={setApproverIds}
                    approvers={approverOptions}
                  />
                </div>
              </details>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
            >
              Cancel
            </button>
            <button
              disabled={!canProceed}
              className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review
            </button>
          </div>
        </form>
      ) : (
        <div>
          <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Folder name</dt>
              <dd className="font-bold text-slate-800">{name.trim()}</dd>
            </div>
            {description.trim() && (
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Description</dt>
                <dd className="text-right text-slate-700">{description.trim()}</dd>
              </div>
            )}
            {kind === "employee" && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Departments</dt>
                  <dd className="text-right text-slate-700">
                    {departmentLabels.join(", ") || "—"}
                  </dd>
                </div>
                {gradeLabels.length > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="font-semibold text-slate-500">Grade filter</dt>
                    <dd className="text-right text-slate-700">
                      {gradeLabels.join(", ")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Employees to add</dt>
                  <dd className="font-bold text-brand-text">{employeeCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Upload approval</dt>
                  <dd className="text-slate-700">
                    {requireUploadApproval ? "Required" : "Not required"}
                  </dd>
                </div>
                {requireUploadApproval && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Review mode</dt>
                      <dd className="text-slate-700">
                        {approvalFlowLabel(approvalFlow)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Approvers</dt>
                      <dd className="text-right text-slate-700">
                        {approverLabels.join(", ") || "—"}
                      </dd>
                    </div>
                  </>
                )}
              </>
            )}
            {kind === "organizational" && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Access scope</dt>
                  <dd className="text-slate-700">{formatFieldLabel(resolvedOrgScope)}</dd>
                </div>
                {scopeLabels.length > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="font-semibold text-slate-500">Selected scope</dt>
                    <dd className="text-right text-slate-700">{scopeLabels.join(", ")}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Retention</dt>
                  <dd className="text-slate-700">{retention === "permanent" ? "Permanent" : `${retention} years`}</dd>
                </div>
                {allowedTypeNames.length > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="font-semibold text-slate-500">Allowed types</dt>
                    <dd className="text-right text-slate-700">{allowedTypeNames.join(", ")}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep("configure")}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
            >
              Back
            </button>
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => void submit()}
              className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
            >
              {create.isPending ? "Creating..." : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <ModalDialog
      title={folderFormTitle}
      eyebrow={folderFormEyebrow}
      onClose={onClose}
      size="lg"
      closeDisabled={create.isPending}
    >
      {folderFormBody}
    </ModalDialog>
  );
}
