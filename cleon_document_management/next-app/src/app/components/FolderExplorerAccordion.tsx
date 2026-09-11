"use client";

import { ChevronDown, FileText, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ComplianceTargets, DocDocument, DocFolder } from "../../../lib/types";
import { documentViewHref } from "../../../lib/documentLinks";
import FolderActions from "./FolderActions";

type FolderRow = {
  folder: DocFolder;
  documents: DocDocument[];
  employees: number;
};

type PageKind = "employee" | "organizational";

function groupEmployeesInFolder(
  folder: DocFolder,
  documents: DocDocument[],
  targets?: ComplianceTargets,
) {
  const targetById = new Map(
    (targets?.employees ?? []).map((employee) => [employee.id, employee]),
  );
  const grouped = new Map<
    number,
    { id: number; name: string; department: string; documents: DocDocument[] }
  >();

  (folder.employee_ids ?? []).forEach((employeeId) => {
    const target = targetById.get(employeeId);
    grouped.set(employeeId, {
      id: employeeId,
      name: target?.name ?? "Unknown employee",
      department: target?.department || "Unassigned",
      documents: [],
    });
  });

  documents.forEach((document) => {
    if (!document.employee_id) return;
    const target = targetById.get(document.employee_id);
    const current = grouped.get(document.employee_id) ?? {
      id: document.employee_id,
      name: target?.name ?? document.employee_name,
      department: target?.department || "Unassigned",
      documents: [],
    };
    current.documents = [...current.documents, document];
    grouped.set(document.employee_id, current);
  });

  return [...grouped.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function employeeInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FileRow({
  document,
  isDocumentManager,
}: {
  document: DocDocument;
  isDocumentManager: boolean;
}) {
  return (
    <Link
      href={documentViewHref(document, isDocumentManager)}
      className="folder-accordion-file"
    >
      <FileText size={14} />
      <span className="min-w-0 flex-1 truncate">{document.name}</span>
      <small className="truncate text-slate-400">{document.document_type}</small>
    </Link>
  );
}

export default function FolderExplorerAccordion({
  kind,
  rows,
  targets,
  selected,
  onToggleSelected,
  isDocumentManager,
  guideTarget,
}: {
  kind: PageKind;
  rows: FolderRow[];
  targets?: ComplianceTargets;
  selected: number[];
  onToggleSelected: (id: number) => void;
  isDocumentManager: boolean;
  guideTarget?: string | null;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>(
    {},
  );
  const [expandedEmployees, setExpandedEmployees] = useState<
    Record<string, boolean>
  >({});

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

  return (
    <div className="folder-accordion p-4">
      {rows.map(({ folder, documents: folderDocuments, employees }) => {
        const folderExpanded = expandedFolders[folder.id] ?? false;
        const employeeGroups =
          kind === "employee"
            ? groupEmployeesInFolder(folder, folderDocuments, targets)
            : [];

        return (
          <div className="folder-accordion-block" key={folder.id}>
            <div className="folder-accordion-header-row">
              <input
                type="checkbox"
                checked={selected.includes(folder.id)}
                onChange={() => onToggleSelected(folder.id)}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Select ${folder.folder_name}`}
                className="h-4 w-4 shrink-0 accent-pink-600"
              />
              <button
                type="button"
                className="folder-accordion-header"
                onClick={() => toggleFolder(folder.id)}
              >
                <FolderOpen size={15} />
                <span>{folder.folder_name}</span>
                <small>
                  {kind === "employee"
                    ? `${employees} employees · ${folderDocuments.length} files`
                    : `${folderDocuments.length} files`}
                </small>
                <ChevronDown
                  size={15}
                  className={folderExpanded ? "folder-accordion-chevron expanded" : "folder-accordion-chevron"}
                />
              </button>
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
              <Link
                href={
                  kind === "employee"
                    ? `/pages/employee/folder?folder=${folder.id}`
                    : `/pages/organization/folder?folder=${folder.id}${guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""}`
                }
                className="folder-accordion-open"
                aria-label={`Open ${folder.folder_name}`}
              >
                Open
              </Link>
            </div>

            {folderExpanded && (
              <div className="folder-accordion-body">
                {kind === "employee" ? (
                  employeeGroups.length ? (
                    employeeGroups.map((employee) => {
                      const employeeKey = `${folder.id}-${employee.id}`;
                      const employeeExpanded =
                        expandedEmployees[employeeKey] ?? false;
                      return (
                        <div
                          className="folder-accordion-block nested"
                          key={employeeKey}
                        >
                          <div className="folder-accordion-header-row employee">
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
                                </span>
                              </span>
                            </Link>
                            <button
                              type="button"
                              className="folder-accordion-toggle"
                              onClick={() =>
                                toggleEmployee(folder.id, employee.id)
                              }
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
                          </div>
                          {employeeExpanded && (
                            <div className="folder-accordion-file-list">
                              {employee.documents.length ? (
                                employee.documents.map((document) => (
                                  <FileRow
                                    key={document.id}
                                    document={document}
                                    isDocumentManager={isDocumentManager}
                                  />
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
                      No employees in this folder yet.
                    </p>
                  )
                ) : folderDocuments.length ? (
                  <div className="folder-accordion-file-list">
                    {folderDocuments.map((document) => (
                      <FileRow
                        key={document.id}
                        document={document}
                        isDocumentManager={isDocumentManager}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="folder-accordion-empty">
                    No documents in this folder yet.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
