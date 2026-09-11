"use client";

import { FolderInput, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  useAddEmployeesToFolder,
  useComplianceTargets,
  useCurrentUser,
  useDocuments,
  useFolders,
  useMoveEmployeesBetweenFolders,
  useRemoveEmployeesFromFolder,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { INITIAL_EMPLOYEE_FILE_FILTERS } from "../../../lib/employeeFileFilters";
import { groupEmployeesInFolder } from "../../../lib/groupEmployeesInFolder";
import type { ComplianceTargets, DocFolder } from "../../../lib/types";
import MoveEmployeesDialog from "./MoveEmployeesDialog";
import ModalDialog from "./ModalDialog";
import BackButton from "./BackButton";
import EmployeeFilterPanel from "./EmployeeFilterPanel";
import FolderEmployeeFileTree from "./FolderEmployeeFileTree";
import ListPagination from "./ListPagination";

const EMPLOYEE_PAGE_SIZE = 10;

type EmployeeConflict = {
  employee_id: number;
  employee_name: string;
  folder_id: number;
  folder_name: string;
};

export default function EmployeeFolderPage() {
  const params = useSearchParams();
  const folderId = Number(params.get("folder"));
  const folders = useFolders();
  const documents = useDocuments(folderId || undefined);
  const targets = useComplianceTargets();
  const [employeeFilters, setEmployeeFilters] = useState(
    INITIAL_EMPLOYEE_FILE_FILTERS,
  );
  const [employeePage, setEmployeePage] = useState(1);
  const [showAddEmployees, setShowAddEmployees] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [movingEmployeeIds, setMovingEmployeeIds] = useState<number[] | null>(
    null,
  );
  const currentUser = useCurrentUser();
  const folder = folders.data?.find((item) => item.id === folderId);

  const employees = useMemo(() => {
    if (!folder) return [];
    return groupEmployeesInFolder(
      folder,
      documents.data ?? [],
      targets.data,
      employeeFilters,
    );
  }, [documents.data, employeeFilters, folder, targets.data]);

  useEffect(() => {
    setEmployeePage(1);
  }, [employeeFilters, folderId]);

  const paginatedEmployees = useMemo(() => {
    const start = (employeePage - 1) * EMPLOYEE_PAGE_SIZE;
    return employees.slice(start, start + EMPLOYEE_PAGE_SIZE);
  }, [employeePage, employees]);

  const treeRows = useMemo(
    () =>
      folder
        ? [
            {
              folder,
              documents: documents.data ?? [],
              employees: paginatedEmployees,
            },
          ]
        : [],
    [documents.data, folder, paginatedEmployees],
  );

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
        {folder ? (
          <button
            type="button"
            onClick={() => setShowAddEmployees(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
          >
            <Plus className="h-4 w-4" />
            Add employee
          </button>
        ) : null}
      </div>

      <EmployeeFilterPanel
        filters={employeeFilters}
        onChange={setEmployeeFilters}
        targets={targets.data}
      />

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
          <FolderEmployeeFileTree
            kind="employee"
            rows={treeRows}
            selectedEmployeeIds={selectedEmployees}
            onToggleEmployeeSelected={(employeeId) =>
              setSelectedEmployees((current) =>
                current.includes(employeeId)
                  ? current.filter((id) => id !== employeeId)
                  : [...current, employeeId],
              )
            }
            onMoveEmployee={(employeeId) => setMovingEmployeeIds([employeeId])}
            isDocumentManager={currentUser.data?.is_document_manager === true}
            singleFolderExpanded
            showFolderOpenLink={false}
            emptyMessage="No employees match the current filters."
          />
        ) : null}
        {folder && employees.length > EMPLOYEE_PAGE_SIZE ? (
          <div className="border-t border-slate-100 px-5 py-4">
            <ListPagination
              page={employeePage}
              pageSize={EMPLOYEE_PAGE_SIZE}
              total={employees.length}
              onPageChange={setEmployeePage}
            />
          </div>
        ) : null}
      </section>

      {showAddEmployees && folder && targets.data && (
        <AddEmployeesModal
          folder={folder}
          targets={targets.data}
          onClose={() => setShowAddEmployees(false)}
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
  folder,
  targets,
  onClose,
}: {
  folder: DocFolder;
  targets: ComplianceTargets;
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

  const currentEmployeeIds = folder.employee_ids ?? [];
  const currentEmployeeIdSet = useMemo(
    () => new Set(currentEmployeeIds),
    [currentEmployeeIds],
  );
  const departmentIds = useMemo(
    () => new Set(folder.department_ids ?? []),
    [folder.department_ids],
  );

  const departmentLabel = useMemo(() => {
    if (!departmentIds.size) return "";
    return targets.departments
      .filter((department) => departmentIds.has(department.id))
      .map((department) => department.name)
      .join(", ");
  }, [departmentIds, targets.departments]);

  const scopedEmployees = useMemo(
    () =>
      targets.employees
        .filter((employee) => {
          if (!departmentIds.size) return false;
          const deptId = Number(employee.department_id);
          return deptId && departmentIds.has(deptId);
        })
        .filter((employee) =>
          [employee.name, employee.job_title, employee.department, employee.grade]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [departmentIds, query, targets.employees],
  );

  const addableEmployees = useMemo(
    () =>
      scopedEmployees.filter(
        (employee) => !currentEmployeeIdSet.has(employee.id),
      ),
    [currentEmployeeIdSet, scopedEmployees],
  );

  const toggle = (id: number) => {
    if (currentEmployeeIdSet.has(id)) return;
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const finishAdd = async (employeeIds: number[]) => {
    if (!employeeIds.length) return;
    await add.mutateAsync({ id: folder.id, employee_ids: employeeIds });
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
        destination_folder_id: folder.id,
      });
    }
    if (directIds.length) {
      await finishAdd(directIds);
      return;
    }
    onClose();
  };

  const confirm = async () => {
    const employeeIds = selected.filter((id) => !currentEmployeeIdSet.has(id));
    if (!employeeIds.length) return;

    setInfoMessage("");
    setIsChecking(true);
    try {
      const result = await api.checkEmployeeConflicts({
        folderId: folder.id,
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

  const allAddableSelected =
    addableEmployees.length > 0 &&
    addableEmployees.every((employee) => selected.includes(employee.id));

  return (
    <>
      <ModalDialog
        title="Add employees"
        eyebrow="Employee folder"
        description={
          departmentLabel
            ? `Select employees from ${departmentLabel}. Employees already in this folder cannot be added again.`
            : "This folder is not linked to a department yet."
        }
        onClose={onClose}
        size="lg"
      >
        {!departmentIds.size ? (
          <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Link this folder to a department before adding employees.
          </p>
        ) : (
          <>
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
          <span>
            {addableEmployees.length} available · {scopedEmployees.length - addableEmployees.length} already in folder
          </span>
          <button
            type="button"
            onClick={() =>
              setSelected(
                allAddableSelected
                  ? selected.filter(
                      (id) => !addableEmployees.some((employee) => employee.id === id),
                    )
                  : [...new Set([...selected, ...addableEmployees.map((employee) => employee.id)])],
              )
            }
            disabled={!addableEmployees.length}
            className="rounded-lg bg-white px-3 py-1.5 text-brand-text hover:text-brand-pink disabled:opacity-50"
          >
            {allAddableSelected ? "Clear visible" : "Select visible"}
          </button>
        </div>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {scopedEmployees.map((employee) => {
            const alreadyInFolder = currentEmployeeIdSet.has(employee.id);
            return (
              <label
                key={employee.id}
                className={`employee-add-row flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold shadow-sm ${
                  alreadyInFolder
                    ? "employee-add-row-exists cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    : "cursor-pointer bg-white text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(employee.id)}
                  onChange={() => toggle(employee.id)}
                  disabled={alreadyInFolder}
                  className="h-4 w-4 accent-pink-600 disabled:opacity-40"
                />
                <span className="min-w-0 flex-1">
                  <strong className={`block truncate ${alreadyInFolder ? "blur-[0.4px]" : ""}`}>
                    {employee.name}
                  </strong>
                  <span className="block truncate text-xs font-normal text-slate-400">
                    {[employee.job_title, employee.grade, employee.department]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {alreadyInFolder ? (
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Already exists in folder
                  </span>
                ) : null}
              </label>
            );
          })}
          {!scopedEmployees.length && (
            <p className="p-5 text-center text-sm text-slate-400">
              No employees match this department search.
            </p>
          )}
        </div>
          </>
        )}
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
            disabled={
              !departmentIds.size ||
              !selected.some((id) => !currentEmployeeIdSet.has(id)) ||
              add.isPending ||
              move.isPending ||
              isChecking
            }
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white disabled:opacity-50"
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
