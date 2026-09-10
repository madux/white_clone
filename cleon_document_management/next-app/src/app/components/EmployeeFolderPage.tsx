"use client";

import {
  ChevronDown,
  FileText,
  FolderInput,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useAddEmployeesToFolder,
  useComplianceTargets,
  useCurrentUser,
  useDocuments,
  useEvaluations,
  useFolders,
  useMoveEmployeesBetweenFolders,
  useRemoveEmployeesFromFolder,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { documentViewHref } from "../../../lib/documentLinks";
import type {
  ComplianceEvaluation,
  ComplianceTargets,
  DocDocument,
} from "../../../lib/types";
import MoveEmployeesDialog from "./MoveEmployeesDialog";
import ModalDialog from "./ModalDialog";
import BackButton from "./BackButton";

type ComplianceFilter =
  | "all"
  | "compliant"
  | "non_compliant"
  | "partial"
  | "not_evaluated";

type FolderEmployee = {
  id: number;
  name: string;
  department: string;
  department_id: number | false;
  grade: string;
  job_title: string;
  documents: DocDocument[];
  complianceStatus: Exclude<ComplianceFilter, "all">;
};

type EmployeeConflict = {
  employee_id: number;
  employee_name: string;
  folder_id: number;
  folder_name: string;
};

const COMPLIANCE_CHIPS: { value: ComplianceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "compliant", label: "Compliant" },
  { value: "non_compliant", label: "Non-compliant" },
  { value: "partial", label: "Partial" },
  { value: "not_evaluated", label: "Not evaluated" },
];

function getEmployeeComplianceStatus(
  employeeId: number,
  evaluations: ComplianceEvaluation[] | undefined,
): Exclude<ComplianceFilter, "all"> {
  const rows = (evaluations ?? []).filter(
    (item) => item.employee_id === employeeId && item.policy_active !== false,
  );
  if (!rows.length) return "not_evaluated";
  if (rows.some((item) => item.status === "non_compliant")) return "non_compliant";
  if (rows.some((item) => item.status === "partial" || item.status === "grace")) {
    return "partial";
  }
  return "compliant";
}

function employeeInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function matchesEmployeeSearch(
  employee: ComplianceTargets["employees"][number],
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [employee.name, employee.department, employee.grade, employee.job_title].some(
    (field) => field?.toLowerCase().includes(normalized),
  );
}

export default function EmployeeFolderPage() {
  const params = useSearchParams();
  const folderId = Number(params.get("folder"));
  const folders = useFolders();
  const documents = useDocuments(folderId || undefined);
  const evaluations = useEvaluations();
  const targets = useComplianceTargets();
  const [search, setSearch] = useState("");
  const [complianceFilter, setComplianceFilter] =
    useState<ComplianceFilter>("all");
  const [showAddEmployees, setShowAddEmployees] = useState(false);
  const [departmentModal, setDepartmentModal] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [movingEmployeeIds, setMovingEmployeeIds] = useState<number[] | null>(
    null,
  );
  const [folderExpanded, setFolderExpanded] = useState(true);
  const [expandedEmployees, setExpandedEmployees] = useState<
    Record<number, boolean>
  >({});
  const currentUser = useCurrentUser();
  const folder = folders.data?.find((item) => item.id === folderId);

  const toggleEmployeeExpanded = (employeeId: number) => {
    setExpandedEmployees((current) => ({
      ...current,
      [employeeId]: !(current[employeeId] ?? false),
    }));
  };

  const employees = useMemo(() => {
    const targetById = new Map(
      (targets.data?.employees ?? []).map((employee) => [employee.id, employee]),
    );
    const grouped = new Map<number, FolderEmployee>();

    (folder?.employee_ids ?? []).forEach((employeeId) => {
      const target = targetById.get(employeeId);
      grouped.set(employeeId, {
        id: employeeId,
        name: target?.name ?? "Unknown employee",
        department: target?.department || "Unassigned",
        department_id: target?.department_id ?? false,
        grade: target?.grade ?? "",
        job_title: target?.job_title ?? "",
        documents: [],
        complianceStatus: getEmployeeComplianceStatus(
          employeeId,
          evaluations.data,
        ),
      });
    });

    (documents.data ?? []).forEach((document) => {
      if (!document.employee_id) return;
      const target = targetById.get(document.employee_id);
      const current = grouped.get(document.employee_id) ?? {
        id: document.employee_id,
        name: target?.name ?? document.employee_name,
        department: target?.department || "Unassigned",
        department_id: target?.department_id ?? false,
        grade: target?.grade ?? "",
        job_title: target?.job_title ?? "",
        documents: [],
        complianceStatus: getEmployeeComplianceStatus(
          document.employee_id,
          evaluations.data,
        ),
      };
      current.documents = [...(current.documents ?? []), document];
      grouped.set(document.employee_id, current);
    });

    return [...grouped.values()]
      .filter((employee) => {
        const target = targetById.get(employee.id);
        if (target && !matchesEmployeeSearch(target, search)) return false;
        if (!target && !employee.name.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        if (
          complianceFilter !== "all" &&
          employee.complianceStatus !== complianceFilter
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [
    complianceFilter,
    documents.data,
    evaluations.data,
    folder?.employee_ids,
    search,
    targets.data,
  ]);

  const allSelected =
    employees.length > 0 &&
    employees.every((employee) => selectedEmployees.includes(employee.id));
  const removeEmployees = useRemoveEmployeesFromFolder();
  const deleteSelectedEmployees = async () => {
    if (!selectedEmployees.length || !folderId) return;
    if (
      !window.confirm(
        `Remove ${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} and delete their files from this folder?`,
      )
    ) {
      return;
    }
    await removeEmployees.mutateAsync({ id: folderId, employee_ids: selectedEmployees });
    setSelectedEmployees([]);
  };

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <BackButton variant="page" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {folder?.folder_name ? (
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {folder.folder_name}
            </h1>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <label className="relative block sm:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
              placeholder="Search name, department, grade, title..."
            />
          </label>
          {folder && (
            <button
              type="button"
              onClick={() => setShowAddEmployees(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
            >
              <Plus className="h-4 w-4" />
              Add employee
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {COMPLIANCE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setComplianceFilter(chip.value)}
            className={`rounded-full px-3 py-2 text-xs font-bold transition ${
              complianceFilter === chip.value
                ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-pink-200"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {selectedEmployees.length > 0 && (
          <div className="flex items-center gap-2 border-b border-pink-100 bg-pink-50 px-5 py-3">
            <span className="text-sm font-bold text-brand-text">
              {selectedEmployees.length} selected
            </span>
            <button
              type="button"
              onClick={() => setMovingEmployeeIds(selectedEmployees)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-text"
            >
              <FolderInput className="h-3.5 w-3.5" />
              Move to folder
            </button>
            <button
              type="button"
              onClick={deleteSelectedEmployees}
              disabled={removeEmployees.isPending}
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600"
            >
              {removeEmployees.isPending ? "Removing..." : "Remove and delete files"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedEmployees([])}
              className="ml-auto rounded-lg px-3 py-2 text-xs font-bold text-slate-500"
            >
              Clear
            </button>
          </div>
        )}
        {documents.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : folder ? (
          <div className="folder-accordion p-4">
            <div className="folder-accordion-block">
              <div className="folder-accordion-header-row">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelectedEmployees(
                      allSelected ? [] : employees.map((employee) => employee.id),
                    )
                  }
                  aria-label="Select all employees"
                  className="h-4 w-4 shrink-0 accent-pink-600"
                />
                <button
                  type="button"
                  className="folder-accordion-header"
                  onClick={() => setFolderExpanded((current) => !current)}
                >
                  <FolderOpen size={15} />
                  <span>{folder.folder_name}</span>
                  <small>
                    {employees.length} employees ·{" "}
                    {(documents.data ?? []).length} files
                  </small>
                  <ChevronDown
                    size={15}
                    className={
                      folderExpanded
                        ? "folder-accordion-chevron expanded"
                        : "folder-accordion-chevron"
                    }
                  />
                </button>
              </div>
              {folderExpanded && (
                <div className="folder-accordion-body">
                  {employees.length ? (
                    employees.map((employee) => {
                      const employeeExpanded =
                        expandedEmployees[employee.id] ?? false;
                      return (
                        <div
                          className="folder-accordion-block nested"
                          key={employee.id}
                        >
                          <div className="folder-accordion-header-row employee">
                            <input
                              type="checkbox"
                              checked={selectedEmployees.includes(employee.id)}
                              onChange={() =>
                                setSelectedEmployees((current) =>
                                  current.includes(employee.id)
                                    ? current.filter((id) => id !== employee.id)
                                    : [...current, employee.id],
                                )
                              }
                              aria-label={`Select ${employee.name}`}
                              className="h-4 w-4 shrink-0 accent-pink-600"
                            />
                            <Link
                              href={`/pages/employee/profile?employee=${employee.id}`}
                              className="folder-accordion-employee-link"
                            >
                              <span className="folder-accordion-avatar">
                                {employeeInitials(employee.name)}
                              </span>
                              <span className="folder-accordion-employee-copy">
                                <span className="folder-accordion-employee-name">
                                  {employee.name}
                                </span>
                                <span className="folder-accordion-employee-meta">
                                  {employee.documents.length} files ·{" "}
                                  {employee.department}
                                  {employee.job_title
                                    ? ` · ${employee.job_title}`
                                    : ""}
                                </span>
                              </span>
                            </Link>
                            <button
                              type="button"
                              className="folder-accordion-toggle"
                              onClick={() => toggleEmployeeExpanded(employee.id)}
                              aria-label={`${employeeExpanded ? "Collapse" : "Expand"} files for ${employee.name}`}
                              aria-expanded={employeeExpanded}
                            >
                              <ChevronDown
                                size={16}
                                className={
                                  employeeExpanded
                                    ? "folder-accordion-chevron expanded"
                                    : "folder-accordion-chevron"
                                }
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => setMovingEmployeeIds([employee.id])}
                              className="rounded-lg p-2 text-brand-pink hover:bg-pink-50"
                              aria-label={`Move ${employee.name} to another folder`}
                            >
                              <FolderInput className="h-4 w-4" />
                            </button>
                          </div>
                          {employeeExpanded && (
                            <div className="folder-accordion-file-list">
                              {employee.documents.length ? (
                                employee.documents.map((document) => (
                                  <Link
                                    key={document.id}
                                    href={documentViewHref(
                                      document,
                                      currentUser.data?.is_document_manager !== false,
                                    )}
                                    className="folder-accordion-file"
                                  >
                                    <FileText size={14} />
                                    <span className="min-w-0 flex-1 truncate">
                                      {document.name}
                                    </span>
                                    <small className="truncate text-slate-400">
                                      {document.document_type}
                                    </small>
                                  </Link>
                                ))
                              ) : (
                                <p className="folder-accordion-empty">
                                  No files for this employee yet.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="folder-accordion-empty">
                      No employees found. Try another search or compliance filter.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {showAddEmployees && folder && targets.data && (
        <AddEmployeesModal
          folderId={folder.id}
          targets={targets.data}
          onClose={() => setShowAddEmployees(false)}
        />
      )}
      {departmentModal && folder && targets.data && (
        <DepartmentSearchModal
          folderId={folder.id}
          departmentId={departmentModal.id}
          departmentName={departmentModal.name}
          targets={targets.data}
          currentEmployeeIds={folder.employee_ids ?? []}
          onClose={() => setDepartmentModal(null)}
        />
      )}
      {movingEmployeeIds && folder && (
        <MoveEmployeesDialog
          employeeIds={movingEmployeeIds}
          sourceFolderId={folder.id}
          folders={folders.data ?? []}
          onClose={() => setMovingEmployeeIds(null)}
          onMoved={() => {
            setMovingEmployeeIds(null);
            setSelectedEmployees([]);
          }}
        />
      )}
    </div>
  );
}

function AddEmployeesModal({
  folderId,
  targets,
  onClose,
}: {
  folderId: number;
  targets: ComplianceTargets;
  onClose: () => void;
}) {
  const add = useAddEmployeesToFolder();
  const move = useMoveEmployeesBetweenFolders();
  const [mode, setMode] = useState<"employee" | "department" | "grade">(
    "employee",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [infoMessage, setInfoMessage] = useState("");
  const [conflicts, setConflicts] = useState<EmployeeConflict[] | null>(null);
  const [pendingDirectIds, setPendingDirectIds] = useState<number[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const groups =
    mode === "department"
      ? targets.departments
      : mode === "grade"
        ? targets.grades
        : targets.employees;
  const visible = groups.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );
  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const resolveEmployeeIds = () => {
    if (mode === "employee") return selected;
    return targets.employees
      .filter((employee) =>
        selected.includes(
          mode === "department"
            ? Number(employee.department_id)
            : Number(employee.grade_id),
        ),
      )
      .map((employee) => employee.id);
  };

  const finishAdd = async (employeeIds: number[]) => {
    if (!employeeIds.length) return;
    await add.mutateAsync({ id: folderId, employee_ids: employeeIds });
    onClose();
  };

  const moveConflictsAndAdd = async (
    conflictRows: EmployeeConflict[],
    directIds: number[],
  ) => {
    for (const conflict of conflictRows) {
      await move.mutateAsync({
        id: conflict.folder_id,
        employee_ids: [conflict.employee_id],
        destination_folder_id: folderId,
      });
    }
    if (directIds.length) {
      await finishAdd(directIds);
      return;
    }
    onClose();
  };

  const confirm = async () => {
    const employeeIds = resolveEmployeeIds();
    if (!employeeIds.length) return;

    setInfoMessage("");
    setIsChecking(true);
    try {
      const result = await api.checkEmployeeConflicts({
        folderId,
        employeeIds,
      });
      if (!result.success) {
        throw new Error(result.message || "Unable to check employee conflicts.");
      }

      const alreadyIds = new Set(
        (result.already_in_folder ?? []).map((item) => item.employee_id),
      );
      const conflictRows = result.conflicts ?? [];
      const directIds = employeeIds.filter(
        (id) =>
          !alreadyIds.has(id) &&
          !conflictRows.some((item) => item.employee_id === id),
      );

      if (result.already_in_folder?.length) {
        const names = result.already_in_folder.map((item) => item.employee_name);
        setInfoMessage(
          `${names.length} employee${names.length === 1 ? " is" : "s are"} already in this folder and will be skipped: ${names.join(", ")}.`,
        );
      }

      if (conflictRows.length) {
        setPendingDirectIds(directIds);
        setConflicts(conflictRows);
        return;
      }

      if (!directIds.length) return;
      await finishAdd(directIds);
    } catch (error: any) {
      setInfoMessage(error?.message || "Unable to add employees.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      <ModalDialog
        title="Add employees"
        eyebrow="Employee folder"
        description="Add individual employees or everyone in a department or grade."
        onClose={onClose}
        size="lg"
      >
        <div className="flex gap-1 rounded-xl bg-slate-50 p-1">
          {(
            [
              ["employee", "Employees"],
              ["department", "Departments"],
              ["grade", "Grade levels"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setSelected([]);
                setQuery("");
                setInfoMessage("");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === value
                  ? "bg-white text-brand-pink shadow-sm"
                  : "text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative mt-4 block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${mode}s...`}
            className="field pl-10"
          />
        </label>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {visible.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 accent-pink-600"
              />
              {item.name}
            </label>
          ))}
          {!visible.length && (
            <p className="p-5 text-center text-sm text-slate-400">
              No matches found.
            </p>
          )}
        </div>
        {infoMessage && (
          <p className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {infoMessage}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selected.length || add.isPending || move.isPending || isChecking}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
          >
            {isChecking || add.isPending || move.isPending
              ? "Adding..."
              : "Add to folder"}
          </button>
        </div>
      </ModalDialog>

      {conflicts && (
        <ModalDialog
          title="Employees already assigned elsewhere"
          eyebrow="Add employees"
          description="These employees belong to another employee folder. Move them here to continue."
          onClose={() => setConflicts(null)}
          size="md"
          zIndex={120}
          titleClassName="text-xl"
        >
          <ul className="space-y-2">
            {conflicts.map((conflict) => (
              <li
                key={conflict.employee_id}
                className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <strong>{conflict.employee_name}</strong>
                <span className="block text-xs text-amber-700">
                  Currently in {conflict.folder_name}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConflicts(null)}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await moveConflictsAndAdd(conflicts, pendingDirectIds);
                } catch (error: any) {
                  setInfoMessage(error?.message || "Unable to move employees.");
                  setConflicts(null);
                }
              }}
              disabled={move.isPending || add.isPending}
              className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
            >
              {move.isPending || add.isPending ? "Moving..." : "Move to this folder"}
            </button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}

function DepartmentSearchModal({
  folderId,
  departmentId,
  departmentName,
  targets,
  currentEmployeeIds,
  onClose,
}: {
  folderId: number;
  departmentId: number;
  departmentName: string;
  targets: ComplianceTargets;
  currentEmployeeIds: number[];
  onClose: () => void;
}) {
  const add = useAddEmployeesToFolder();
  const move = useMoveEmployeesBetweenFolders();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [infoMessage, setInfoMessage] = useState("");
  const [conflicts, setConflicts] = useState<EmployeeConflict[] | null>(null);
  const [pendingDirectIds, setPendingDirectIds] = useState<number[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const departmentEmployees = useMemo(
    () =>
      targets.employees
        .filter((employee) => Number(employee.department_id) === departmentId)
        .filter((employee) =>
          [employee.name, employee.job_title, employee.grade]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [departmentId, query, targets.employees],
  );

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const finishAdd = async (employeeIds: number[]) => {
    if (!employeeIds.length) return;
    await add.mutateAsync({ id: folderId, employee_ids: employeeIds });
    onClose();
  };

  const moveConflictsAndAdd = async (
    conflictRows: EmployeeConflict[],
    directIds: number[],
  ) => {
    for (const conflict of conflictRows) {
      await move.mutateAsync({
        id: conflict.folder_id,
        employee_ids: [conflict.employee_id],
        destination_folder_id: folderId,
      });
    }
    if (directIds.length) {
      await finishAdd(directIds);
      return;
    }
    onClose();
  };

  const confirm = async () => {
    if (!selected.length) return;
    setInfoMessage("");
    setIsChecking(true);
    try {
      const result = await api.checkEmployeeConflicts({
        folderId,
        employeeIds: selected,
      });
      if (!result.success) {
        throw new Error(result.message || "Unable to check employee conflicts.");
      }

      const alreadyIds = new Set(
        (result.already_in_folder ?? []).map((item) => item.employee_id),
      );
      const conflictRows = result.conflicts ?? [];
      const directIds = selected.filter(
        (id) =>
          !alreadyIds.has(id) &&
          !conflictRows.some((item) => item.employee_id === id),
      );

      if (result.already_in_folder?.length) {
        const names = result.already_in_folder.map((item) => item.employee_name);
        setInfoMessage(
          `${names.length} employee${names.length === 1 ? " is" : "s are"} already in this folder and will be skipped: ${names.join(", ")}.`,
        );
      }

      if (conflictRows.length) {
        setPendingDirectIds(directIds);
        setConflicts(conflictRows);
        return;
      }

      if (!directIds.length) return;
      await finishAdd(directIds);
    } catch (error: any) {
      setInfoMessage(error?.message || "Unable to add employees.");
    } finally {
      setIsChecking(false);
    }
  };

  const allVisibleSelected =
    departmentEmployees.length > 0 &&
    departmentEmployees.every((employee) => selected.includes(employee.id));

  return (
    <>
      <ModalDialog
        title={departmentName}
        eyebrow="Department employees"
        description="Select employees from this department to add to the folder."
        onClose={onClose}
        size="lg"
        zIndex={110}
      >
        <label className="relative block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees in this department..."
            className="field pl-10"
          />
        </label>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>{departmentEmployees.length} employees</span>
          <button
            type="button"
            onClick={() =>
              setSelected(
                allVisibleSelected
                  ? selected.filter(
                      (id) => !departmentEmployees.some((employee) => employee.id === id),
                    )
                  : [
                      ...new Set([
                        ...selected,
                        ...departmentEmployees.map((employee) => employee.id),
                      ]),
                    ],
              )
            }
            className="rounded-lg bg-white px-3 py-1.5 text-brand-text hover:text-brand-pink"
          >
            {allVisibleSelected ? "Clear visible" : "Select visible"}
          </button>
        </div>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {departmentEmployees.map((employee) => {
            const alreadyInFolder = currentEmployeeIds.includes(employee.id);
            return (
              <label
                key={employee.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold shadow-sm ${
                  alreadyInFolder
                    ? "border border-emerald-100 bg-emerald-50 text-emerald-800"
                    : "bg-white text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(employee.id)}
                  onChange={() => toggle(employee.id)}
                  className="h-4 w-4 accent-pink-600"
                />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{employee.name}</strong>
                  <span className="block truncate text-xs font-normal text-slate-400">
                    {[employee.job_title, employee.grade].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {alreadyInFolder && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    In folder
                  </span>
                )}
              </label>
            );
          })}
          {!departmentEmployees.length && (
            <p className="p-5 text-center text-sm text-slate-400">
              No employees match this department search.
            </p>
          )}
        </div>
        {infoMessage && (
          <p className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {infoMessage}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selected.length || add.isPending || move.isPending || isChecking}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
          >
            {isChecking || add.isPending || move.isPending
              ? "Adding..."
              : "Add to folder"}
          </button>
        </div>
      </ModalDialog>

      {conflicts && (
        <ModalDialog
          title="Employees already assigned elsewhere"
          eyebrow="Department employees"
          description="These employees belong to another employee folder. Move them here to continue."
          onClose={() => setConflicts(null)}
          size="md"
          zIndex={130}
          titleClassName="text-xl"
        >
          <ul className="space-y-2">
            {conflicts.map((conflict) => (
              <li
                key={conflict.employee_id}
                className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <strong>{conflict.employee_name}</strong>
                <span className="block text-xs text-amber-700">
                  Currently in {conflict.folder_name}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConflicts(null)}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await moveConflictsAndAdd(conflicts, pendingDirectIds);
                } catch (error: any) {
                  setInfoMessage(error?.message || "Unable to move employees.");
                  setConflicts(null);
                }
              }}
              disabled={move.isPending || add.isPending}
              className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
            >
              {move.isPending || add.isPending ? "Moving..." : "Move to this folder"}
            </button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
