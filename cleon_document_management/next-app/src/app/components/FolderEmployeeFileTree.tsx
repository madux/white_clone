"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderInput,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  useDeleteDocumentVersion,
  useDocumentAction,
} from "../../../hooks/useDocuments";
import type { FolderEmployeeGroup } from "../../../lib/groupEmployeesInFolder";
import { groupEmployeeDocuments } from "../../../lib/groupEmployeeDocuments";
import { documentViewHref } from "../../../lib/documentLinks";
import type { DocDocument, DocFolder } from "../../../lib/types";
import type { EmployeeLifecycleStatus } from "../../../lib/types";
import FolderActions from "./FolderActions";
import FolderDocumentTreeGroup from "./FolderDocumentTreeGroup";

export type FolderTreeRow = {
  folder: DocFolder;
  documents: DocDocument[];
  employees: FolderEmployeeGroup[];
};

const LIFECYCLE_LABELS: Record<EmployeeLifecycleStatus, string> = {
  active: "Active",
  probation: "Probation",
  on_leave: "On Leave",
  suspended: "Suspended",
};

function employeeInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function lifecycleClass(status: EmployeeLifecycleStatus) {
  switch (status) {
    case "active":
      return "employee-tree-badge active";
    case "probation":
      return "employee-tree-badge probation";
    case "on_leave":
      return "employee-tree-badge on-leave";
    case "suspended":
      return "employee-tree-badge suspended";
    default:
      return "employee-tree-badge";
  }
}

function FileTreeRow({
  document,
  isDocumentManager,
  depth,
  onDocumentOpen,
}: {
  document: DocDocument;
  isDocumentManager: boolean;
  depth: number;
  onDocumentOpen?: (document: DocDocument) => void;
}) {
  const rowClass = "employee-tree-row employee-tree-row-file";
  const style = { paddingLeft: `${depth * 20 + 16}px` };
  const content = (
    <>
      <span className="employee-tree-spacer" aria-hidden />
      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
        {document.name}
      </span>
      <small className="truncate text-slate-400">{document.document_type}</small>
    </>
  );

  if (onDocumentOpen) {
    return (
      <button
        type="button"
        onClick={() => onDocumentOpen(document)}
        className={`${rowClass} w-full text-left`}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={documentViewHref(document, isDocumentManager)} className={rowClass} style={style}>
      {content}
    </Link>
  );
}

export default function FolderEmployeeFileTree({
  kind,
  rows,
  selectedFolderIds = [],
  selectedEmployeeIds = [],
  onToggleFolderSelected,
  onToggleEmployeeSelected,
  onMoveEmployee,
  isDocumentManager,
  singleFolderExpanded = true,
  showFolderOpenLink = true,
  guideTarget,
  onDocumentOpen,
  emptyMessage = "No employees found. Try adjusting your filters.",
}: {
  kind: "employee" | "organizational";
  rows: FolderTreeRow[];
  selectedFolderIds?: number[];
  selectedEmployeeIds?: number[];
  onToggleFolderSelected?: (folderId: number) => void;
  onToggleEmployeeSelected?: (employeeId: number) => void;
  onMoveEmployee?: (employeeId: number) => void;
  isDocumentManager: boolean;
  singleFolderExpanded?: boolean;
  showFolderOpenLink?: boolean;
  guideTarget?: string | null;
  onDocumentOpen?: (document: DocDocument) => void;
  emptyMessage?: string;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>(
    {},
  );
  const [expandedEmployees, setExpandedEmployees] = useState<
    Record<string, boolean>
  >({});
  const [expandedDocuments, setExpandedDocuments] = useState<
    Record<string, boolean>
  >({});
  const documentAction = useDocumentAction();
  const deleteVersion = useDeleteDocumentVersion();

  const handleDeleteVersion = async (versionId: number, versionNumber: number) => {
    if (
      !window.confirm(
        `Delete version ${versionNumber}? This only removes that archived version.`,
      )
    ) {
      return;
    }
    await deleteVersion.mutateAsync(versionId);
  };

  const handleDeleteRelatedDocument = async (document: DocDocument) => {
    if (!window.confirm(`Delete this earlier copy of "${document.name}"?`)) {
      return;
    }
    await documentAction.mutateAsync({ id: document.id, action: "delete" });
  };

  useEffect(() => {
    const nextFolders: Record<number, boolean> = {};
    const nextEmployees: Record<string, boolean> = {};
    const nextDocuments: Record<string, boolean> = {};
    rows.forEach(({ folder, documents: folderDocuments, employees }) => {
      nextFolders[folder.id] = singleFolderExpanded || employees.some(
        (employee) => employee.documents.length > 0,
      );
      if (kind === "organizational") {
        groupEmployeeDocuments(folderDocuments).forEach((group) => {
          const docKey = `${folder.id}-0-${group.primary.id}`;
          if (group.historyCount > 0) {
            nextDocuments[docKey] = true;
          }
        });
      }
      employees.forEach((employee) => {
        const key = `${folder.id}-${employee.id}`;
        if (employee.documents.length > 0) {
          nextEmployees[key] = true;
        }
        groupEmployeeDocuments(employee.documents).forEach((group) => {
          const docKey = `${folder.id}-${employee.id}-${group.primary.id}`;
          if (group.historyCount > 0) {
            nextDocuments[docKey] = true;
          }
        });
      });
    });
    setExpandedFolders((current) => ({ ...nextFolders, ...current }));
    setExpandedEmployees((current) => ({ ...nextEmployees, ...current }));
    setExpandedDocuments((current) => ({ ...nextDocuments, ...current }));
  }, [kind, rows, singleFolderExpanded]);

  const toggleFolder = (folderId: number) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !(current[folderId] ?? false),
    }));
  };

  const toggleEmployee = (folderId: number, employeeId: number) => {
    const key = `${folderId}-${employeeId}`;
    setExpandedEmployees((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));
  };

  const toggleDocument = (
    folderId: number,
    employeeId: number,
    documentId: number,
  ) => {
    const key = `${folderId}-${employeeId}-${documentId}`;
    setExpandedDocuments((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));
  };

  if (!rows.length) {
    return (
      <p className="employee-tree-empty px-5 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="employee-file-tree p-4">
      {rows.map(({ folder, documents: folderDocuments, employees }) => {
        const folderExpanded = expandedFolders[folder.id] ?? singleFolderExpanded;
        const employeeCount =
          kind === "employee" ? employees.length : folder.employee_ids?.length ?? 0;

        return (
          <div className="employee-tree-folder" key={folder.id}>
            <div className="employee-tree-row employee-tree-row-folder">
              {onToggleFolderSelected ? (
                <input
                  type="checkbox"
                  checked={selectedFolderIds.includes(folder.id)}
                  onChange={() => onToggleFolderSelected(folder.id)}
                  aria-label={`Select ${folder.folder_name}`}
                  className="h-4 w-4 shrink-0 accent-pink-600"
                />
              ) : null}
              <button
                type="button"
                className="employee-tree-toggle"
                onClick={() => toggleFolder(folder.id)}
                aria-expanded={folderExpanded}
                aria-label={`${folderExpanded ? "Collapse" : "Expand"} ${folder.folder_name}`}
              >
                {folderExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <FolderOpen className="h-4 w-4 shrink-0 text-brand-pink" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800">{folder.folder_name}</div>
                <div className="text-xs text-slate-500">
                  {kind === "employee"
                    ? `${employeeCount} employees · ${folderDocuments.length} files`
                    : `${folderDocuments.length} files`}
                </div>
              </div>
              <FolderActions
                folderId={folder.id}
                folderName={folder.folder_name}
                description={folder.description}
                locked={folder.locked}
                folderType={folder.folder_type}
                {...(kind === "employee"
                  ? {
                      requireUploadApproval: folder.require_upload_approval,
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
              {showFolderOpenLink ? (
                kind === "employee" ? (
                  <Link
                    href={`/pages/employee/folder?folder=${folder.id}`}
                    className="employee-tree-open-link"
                    aria-label={`Open ${folder.folder_name}`}
                  >
                    Open
                  </Link>
                ) : (
                  <Link
                    href={`/pages/organization/folder?folder=${folder.id}${guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""}`}
                    className="employee-tree-open-link"
                    aria-label={`Open ${folder.folder_name}`}
                  >
                    Open
                  </Link>
                )
              ) : null}
            </div>

            {folderExpanded ? (
              <div className="employee-tree-children">
                {kind === "employee" ? (
                  employees.length ? (
                    employees.map((employee) => {
                      const employeeKey = `${folder.id}-${employee.id}`;
                      const employeeExpanded =
                        expandedEmployees[employeeKey] ?? false;
                      return (
                        <div key={employeeKey} className="employee-tree-employee-block">
                          <div
                            className="employee-tree-row employee-tree-row-employee"
                            style={{ paddingLeft: "36px" }}
                          >
                            {onToggleEmployeeSelected ? (
                              <input
                                type="checkbox"
                                checked={selectedEmployeeIds.includes(employee.id)}
                                onChange={() =>
                                  onToggleEmployeeSelected(employee.id)
                                }
                                aria-label={`Select ${employee.name}`}
                                className="h-4 w-4 shrink-0 accent-pink-600"
                              />
                            ) : null}
                            <button
                              type="button"
                              className="employee-tree-toggle"
                              onClick={() => toggleEmployee(folder.id, employee.id)}
                              aria-expanded={employeeExpanded}
                              aria-label={`${employeeExpanded ? "Collapse" : "Expand"} files for ${employee.name}`}
                            >
                              {employeeExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <Link
                              href={`/pages/employee/profile?employee=${employee.id}`}
                              className="employee-tree-employee-link"
                            >
                              <span className="employee-tree-avatar">
                                {employeeInitials(employee.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-800">
                                    {employee.name}
                                  </span>
                                  <span
                                    className={lifecycleClass(
                                      employee.lifecycle_status,
                                    )}
                                  >
                                    {LIFECYCLE_LABELS[employee.lifecycle_status]}
                                  </span>
                                  {employee.has_pending_documents ? (
                                    <span className="employee-tree-badge pending">
                                      Pending
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {employee.documents.length} files ·{" "}
                                  {employee.department}
                                  {employee.work_location
                                    ? ` · ${employee.work_location}`
                                    : ""}
                                  {employee.job_title
                                    ? ` · ${employee.job_title}`
                                    : ""}
                                </span>
                              </span>
                            </Link>
                            {onMoveEmployee ? (
                              <button
                                type="button"
                                onClick={() => onMoveEmployee(employee.id)}
                                className="employee-tree-action"
                                aria-label={`Move ${employee.name} to another folder`}
                              >
                                <FolderInput className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          {employeeExpanded ? (
                            <div className="employee-tree-file-group">
                              {employee.documents.length ? (
                                groupEmployeeDocuments(employee.documents).map(
                                  (group) => {
                                    const docKey = `${folder.id}-${employee.id}-${group.primary.id}`;
                                    return (
                                      <FolderDocumentTreeGroup
                                        key={group.primary.id}
                                        group={group}
                                        expanded={expandedDocuments[docKey] ?? false}
                                        onToggleExpand={() =>
                                          toggleDocument(
                                            folder.id,
                                            employee.id,
                                            group.primary.id,
                                          )
                                        }
                                        isDocumentManager={isDocumentManager}
                                        onDocumentOpen={onDocumentOpen}
                                        onDeleteVersion={
                                          isDocumentManager ? handleDeleteVersion : undefined
                                        }
                                        onDeleteRelatedDocument={
                                          isDocumentManager
                                            ? handleDeleteRelatedDocument
                                            : undefined
                                        }
                                        depth={3}
                                      />
                                    );
                                  },
                                )
                              ) : (
                                <p
                                  className="employee-tree-empty"
                                  style={{ paddingLeft: "76px" }}
                                >
                                  No files for this employee yet.
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="employee-tree-empty" style={{ paddingLeft: "36px" }}>
                      {emptyMessage}
                    </p>
                  )
                ) : folderDocuments.length ? (
                  groupEmployeeDocuments(folderDocuments).map((group) => {
                    const docKey = `${folder.id}-0-${group.primary.id}`;
                    if (group.historyCount > 0) {
                      return (
                        <FolderDocumentTreeGroup
                          key={group.primary.id}
                          group={group}
                          expanded={expandedDocuments[docKey] ?? false}
                          onToggleExpand={() =>
                            toggleDocument(folder.id, 0, group.primary.id)
                          }
                          isDocumentManager={isDocumentManager}
                          onDocumentOpen={onDocumentOpen}
                          onDeleteVersion={
                            isDocumentManager ? handleDeleteVersion : undefined
                          }
                          onDeleteRelatedDocument={
                            isDocumentManager ? handleDeleteRelatedDocument : undefined
                          }
                          depth={2}
                        />
                      );
                    }
                    return (
                      <FileTreeRow
                        key={group.primary.id}
                        document={group.primary}
                        isDocumentManager={isDocumentManager}
                        depth={2}
                        onDocumentOpen={onDocumentOpen}
                      />
                    );
                  })
                ) : (
                  <p className="employee-tree-empty" style={{ paddingLeft: "36px" }}>
                    No documents in this folder yet.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
