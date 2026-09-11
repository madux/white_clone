"use client";

import {
  Check,
  FilePlus2,
  FileText,
  FolderOpen,
  Grid2X2,
  List,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  useSettings,
  useWorkspaceActivity,
} from "../../../hooks/useDocuments";
import SectionTabs from "./SectionTabs";
import OrganizationalLibraryTree, {
  type AckPercentFilter,
} from "./OrganizationalLibraryTree";
import FolderExplorerAccordion from "./FolderExplorerAccordion";
import FolderApprovalFields, {
  approvalFlowLabel,
  type ApprovalFlow,
  validateFolderApproval,
} from "./FolderApprovalFields";
import OrganizationalAccessScopeFields, {
  validateOrganizationalScope,
} from "./OrganizationalAccessScopeFields";
import BulkFolderActions from "./BulkFolderActions";
import ThemedSelect from "./ThemedSelect";
import {
  prefillFromSearchParams,
  readCreateFolderIntent,
  type CreateFolderPrefill,
} from "../../../lib/createFolderIntent";
import { formatFieldLabel } from "../../../lib/formatLabel";

type PageKind = "employee" | "organization" | "organizational";
type ViewMode = "list" | "cards";
export default function DocumentListPage({ kind }: { kind: PageKind }) {
  const folders = useFolders();
  const documents = useDocuments();
  const complianceTargets = useComplianceTargets();
  const currentUser = useCurrentUser();
  const workspaceActivity = useWorkspaceActivity();
  const params = useSearchParams();
  const isOrganizationPage = kind === "organization";
  const guideTarget = params.get("guide");
  const createQuery = params.get("create");
  const departmentIdQuery = params.get("department_id");
  const employeeIdQuery = params.get("employee_id");
  const folderNameQuery = params.get("folder_name");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<number[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateFolderPrefill>({});
  const [showFilters, setShowFilters] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<"all" | "attention" | "complete">("all");
  const isEmployeePage = kind === "employee";
  const [ackPercentFilters, setAckPercentFilters] = useState<AckPercentFilter[]>(
    [],
  );
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

  const filteredRows = isEmployeePage
    ? rows
    : rows.filter(({ compliance }) =>
        complianceFilter === "all"
          ? true
          : complianceFilter === "complete"
            ? compliance === 100
            : compliance < 100,
      );
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
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap gap-2">
          {kind === "employee" && currentUser.data?.is_document_admin === true && (
            <Link
              href="/pages/compliance"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-pink hover:text-brand-pink"
            >
              <ShieldCheck className="h-4 w-4" />
              Compliance
            </Link>
          )}
          {currentUser.data?.is_document_manager === true && (
            <button
              type="button"
              onClick={() => setShowCreateFolder(true)}
              className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 transition hover:shadow-pink-300 ${guideTarget === "folders" ? "guide-emphasis" : ""}`}
            >
              <FilePlus2 className="h-4 w-4" />
              Create Folder
            </button>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                kind === "employee"
                  ? "Search employees, folders..."
                  : "Search folders, policies..."
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            {!isEmployeePage ? (
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls="folder-filters"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
            ) : null}
            <SectionTabs
              items={[
                { id: "list", label: "List", icon: List },
                { id: "cards", label: "Cards", icon: Grid2X2 },
              ]}
              value={viewMode}
              onChange={setViewMode}
              className="!w-auto"
              ariaLabel="Folder view mode"
            />
          </div>
        </div>
        {showFilters && !isEmployeePage && (
          <div
            id="folder-filters"
            className="space-y-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3"
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
          </div>
        )}
        <div className="px-4 pt-4">
          <BulkFolderActions
            selected={selected}
            onClear={() => setSelected([])}
          />
        </div>

        {(folders.error || documents.error) && (
          <p className="m-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            Unable to load this library.
          </p>
        )}
        {isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : viewMode === "list" ? (
          isOrganizationPage ? (
            workspaceActivity.isError ? (
              <p className="p-8 text-center text-sm text-red-600">
                Acknowledgement data could not be loaded.
              </p>
            ) : (
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
              />
            )
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
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(folder.id)}
                        onChange={() => toggleSelected(folder.id)}
                        aria-label={`Select ${folder.folder_name}`}
                        className="h-4 w-4 accent-pink-600"
                      />
                      <div className="rounded-xl bg-pink-50 p-3 text-brand-pink">
                        <FolderOpen className="h-5 w-5" />
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
          <div className="p-12 text-center">
            <Check className="mx-auto h-8 w-8 rounded-full bg-pink-50 p-1.5 text-brand-pink" />
            <p className="mt-3 font-semibold text-slate-700">
              No folders found
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Try a different search.
            </p>
          </div>
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
    </div>
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
  const documentTypes = useDocumentTypes();
  const targets = useComplianceTargets();
  const folders = useFolders();
  const settingsQuery = useSettings();
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessScope, setAccessScope] = useState("all_staff");
  const [retention, setRetention] = useState("7");
  const [requireUploadApproval, setRequireUploadApproval] = useState(false);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow>("any");
  const [approverIds, setApproverIds] = useState<number[]>([]);
  const [allowedTypes, setAllowedTypes] = useState<number[]>([]);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [gradeIds, setGradeIds] = useState<number[]>([]);
  const [scopeIds, setScopeIds] = useState<number[]>([]);
  const [scopeSearch, setScopeSearch] = useState("");
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
      setAccessScope(settings.default_access_scope || "all_staff");
      setRetention(settings.default_retention_period || "7");
    }
  }, [kind, settingsQuery.data?.settings]);

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

  const validateConfigure = () => {
    if (kind === "organizational") {
      const scopeValidation = validateOrganizationalScope(accessScope, scopeIds);
      if (scopeValidation) {
        window.alert(scopeValidation);
        return false;
      }
    }
    if (kind === "employee" && !canProceed) {
      window.alert(
        configureError || "Select at least one existing department.",
      );
      return false;
    }
    if (kind === "employee" && approvalError) {
      window.alert(approvalError);
      return false;
    }
    return true;
  };

  const goToReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateConfigure()) return;
    setStep("review");
  };

  const submit = async () => {
    const result = await create.mutateAsync({
      nameElm: name.trim(),
      descriptionElm: description.trim(),
      folder_type: kind,
      access_scope: accessScope,
      retention_period: retention,
      ...(kind === "employee"
        ? {
            require_upload_approval: requireUploadApproval,
            approval_flow: approvalFlow,
            approver_ids: approverIds,
          }
        : {}),
      allowed_document_type_ids: allowedTypes,
      department_ids:
        kind === "employee"
          ? departmentIds
          : accessScope === "department"
            ? scopeIds
            : [],
      grade_ids:
        kind === "employee"
          ? gradeIds
          : accessScope === "grade"
            ? scopeIds
            : [],
      employee_ids:
        kind === "organizational" && accessScope === "individual"
          ? scopeIds
          : [],
    });
    if (!result.success) {
      window.alert(result.message || "Unable to create folder.");
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

  return (
    <ModalDialog
      title={step === "configure" ? "Create folder" : "Review folder"}
      eyebrow={kind === "employee" ? "Employee folder" : "Organizational folder"}
      onClose={onClose}
      size="lg"
    >
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
                <span className="label">Folder name</span>
                <input
                  required
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {kind === "organizational" && (
              <>
                <div className="sm:col-span-2">
                  <OrganizationalAccessScopeFields
                    accessScope={accessScope}
                    onAccessScopeChange={setAccessScope}
                    scopeIds={scopeIds}
                    onScopeIdsChange={setScopeIds}
                    scopeSearch={scopeSearch}
                    onScopeSearchChange={setScopeSearch}
                    departments={departments}
                    grades={grades}
                    employees={employees}
                  />
                </div>
                <label className="sm:col-span-2">
                  <span className="label">Description</span>
                  <textarea
                    className="field min-h-24"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what belongs in this folder"
                  />
                </label>
                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <summary className="cursor-pointer text-sm font-bold text-slate-700">
                    Advanced configuration{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="label">Retention period</span>
                      <ThemedSelect value={retention} onChange={setRetention} options={[{ value: "1", label: "1 year" }, { value: "3", label: "3 years" }, { value: "5", label: "5 years" }, { value: "7", label: "7 years" }, { value: "10", label: "10 years" }, { value: "permanent", label: "Permanent" }]} />
                    </label>
                    <p className="sm:col-span-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
                      Admin uploads in organizational folders are published
                      immediately to the selected audience. Employees acknowledge
                      shared documents from their workspace when required.
                    </p>
                    {kind === "organizational" && (
                      <label className="sm:col-span-2">
                        <span className="label">
                          Allowed document types{" "}
                          <span className="font-normal text-slate-400">
                            (optional)
                          </span>
                        </span>
                        <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                          {(documentTypes.data ?? []).map((item: any) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={allowedTypes.includes(item.id)}
                                onChange={() =>
                                  setAllowedTypes(
                                    allowedTypes.includes(item.id)
                                      ? allowedTypes.filter(
                                          (id) => id !== item.id,
                                        )
                                      : [...allowedTypes, item.id],
                                  )
                                }
                                className="h-4 w-4 accent-pink-600"
                              />
                              {item.name}
                            </label>
                          ))}
                        </div>
                      </label>
                    )}
                  </div>
                </details>
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
              className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                  <dd className="text-slate-700">{formatFieldLabel(accessScope)}</dd>
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
    </ModalDialog>
  );
}
