"use client";

import {
  Check,
  ChevronRight,
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
} from "../../../hooks/useDocuments";
import FolderApprovalFields, {
  approvalFlowLabel,
  type ApprovalFlow,
  validateFolderApproval,
} from "./FolderApprovalFields";
import OrganizationalAccessScopeFields, {
  validateOrganizationalScope,
} from "./OrganizationalAccessScopeFields";
import FolderActions from "./FolderActions";
import BulkFolderActions from "./BulkFolderActions";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";

type PageKind = "employee" | "organization" | "organizational";
type ViewMode = "list" | "cards";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.replace(" ", "T")));

export default function DocumentListPage({ kind }: { kind: PageKind }) {
  const folders = useFolders();
  const documents = useDocuments();
  const currentUser = useCurrentUser();
  const params = useSearchParams();
  const guideTarget = params.get("guide");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<number[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<"all" | "attention" | "complete">("all");

  useEffect(() => {
    if (params.get("create") === "1") setShowCreateFolder(true);
  }, [params]);

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

  const filteredRows = rows.filter(({ compliance }) =>
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
          {kind === "employee" && (
            <Link
              href="/pages/compliance"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-pink hover:text-brand-pink"
            >
              <ShieldCheck className="h-4 w-4" />
              Compliance
            </Link>
          )}
          {currentUser.data?.is_document_manager !== false && (
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
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${viewMode === "list" ? "bg-white text-brand-pink shadow-sm" : "text-slate-400"}`}
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${viewMode === "cards" ? "bg-white text-brand-pink shadow-sm" : "text-slate-400"}`}
              >
                <Grid2X2 className="h-4 w-4" />
                Cards
              </button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div id="folder-filters" className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3" role="region" aria-label="Folder filters">
            <span className="mr-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Show</span>
            {([["all", "All folders"], ["attention", "Needs attention"], ["complete", "Complete"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setComplianceFilter(value)} aria-pressed={complianceFilter === value} className={`!rounded-lg px-3 py-2 text-xs font-bold transition ${complianceFilter === value ? "bg-white text-brand-text shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}>{label}</button>
            ))}
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
          <div className="overflow-x-auto">
            <SortableTable className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="w-12 px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : visibleIds)
                      }
                      aria-label="Select all folders"
                      className="h-4 w-4 accent-pink-600"
                    />
                  </th>
                  <th className="px-5 py-4 font-bold">Folder</th>
                  {kind === "employee" && (
                    <th className="px-5 py-4 font-bold">Employees</th>
                  )}
                  <th className="px-5 py-4 font-bold">Documents</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(
                  ({
                    folder,
                    documents: folderDocuments,
                    employees,
                  }) => {
                    const row = (
                      <>
                        <td className="w-12 px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selected.includes(folder.id)}
                            onChange={() => toggleSelected(folder.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Select ${folder.folder_name}`}
                            className="h-4 w-4 accent-pink-600"
                          />
                        </td>
                        <td className="px-5 py-4">
                          {kind === "employee" ? (
                            <Link
                              href={`/pages/employee/folder?folder=${folder.id}`}
                              className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-pink/20"
                            >
                              <div className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                                <FolderOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  {folder.folder_name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Updated {formatDate(folder.last_modified)}
                                </p>
                              </div>
                            </Link>
                          ) : (
                            <Link
                              href={`/pages/organization/folder?folder=${folder.id}${guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""}`}
                              className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-pink/20"
                            >
                              <div className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                                <FolderOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  {folder.folder_name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Updated {formatDate(folder.last_modified)}
                                </p>
                              </div>
                            </Link>
                          )}
                        </td>
                        {kind === "employee" && (
                          <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              {employees}
                            </span>
                          </td>
                        )}
                        <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            {folderDocuments.length}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <FolderActions
                              folderId={folder.id}
                              folderName={folder.folder_name}
                              description={folder.description}
                              locked={folder.locked}
                              folderType={folder.folder_type}
                              {...(kind === "employee"
                                ? {
                                    requireUploadApproval:
                                      folder.require_upload_approval,
                                    approvalFlow: folder.approval_flow,
                                    approverIds: folder.approver_ids,
                                  }
                                : {
                                    accessScope: folder.access_scope,
                                    departmentIds: folder.department_ids,
                                    gradeIds: folder.grade_ids,
                                    employeeIds: folder.employee_ids,
                                  })}
                            />
                            {kind === "employee" ? (
                              <Link
                                href={`/pages/employee/folder?folder=${folder.id}`}
                                aria-label={`Open ${folder.folder_name}`}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-pink-50 hover:text-brand-pink"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Link>
                            ) : (
                              <Link
                                href={`/pages/organization/folder?folder=${folder.id}${guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""}`}
                                aria-label={`Open ${folder.folder_name}`}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-pink-50 hover:text-brand-pink"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </>
                    );
                    return (
                      <tr
                        key={folder.id}
                        className="group transition hover:bg-pink-50/30"
                      >
                        {row}
                      </tr>
                    );
                  },
                )}
              </tbody>
            </SortableTable>
          </div>
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
          onClose={() => setShowCreateFolder(false)}
        />
      )}
    </div>
  );
}

function FolderCreateModal({
  kind,
  onClose,
}: {
  kind: PageKind;
  onClose: () => void;
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
    if (kind !== "employee") return;
    const settings = settingsQuery.data?.settings;
    if (!settings) return;
    setRequireUploadApproval(Boolean(settings.default_require_upload_approval));
    setApprovalFlow((settings.default_approval_flow as ApprovalFlow) || "any");
    setApproverIds(
      Array.isArray(settings.default_approver_ids)
        ? settings.default_approver_ids.map(Number)
        : [],
    );
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
                  <dd className="capitalize text-slate-700">{accessScope.replace("_", " ")}</dd>
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
