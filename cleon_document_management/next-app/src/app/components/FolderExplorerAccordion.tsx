"use client";

import { useMemo } from "react";
import type { EmployeeFileFilterState } from "../../../lib/employeeFileFilters";
import { groupEmployeesInFolder } from "../../../lib/groupEmployeesInFolder";
import type { ComplianceTargets, DocDocument, DocFolder } from "../../../lib/types";
import FolderEmployeeFileTree, {
  type FolderTreeRow,
} from "./FolderEmployeeFileTree";

type FolderRow = {
  folder: DocFolder;
  documents: DocDocument[];
  employees: number;
};

type PageKind = "employee" | "organizational";

export default function FolderExplorerAccordion({
  kind,
  rows,
  targets,
  selected,
  onToggleSelected,
  isDocumentManager,
  guideTarget,
  employeeFilters,
  onDocumentOpen,
}: {
  kind: PageKind;
  rows: FolderRow[];
  targets?: ComplianceTargets;
  selected: number[];
  onToggleSelected: (id: number) => void;
  isDocumentManager: boolean;
  guideTarget?: string | null;
  employeeFilters?: EmployeeFileFilterState;
  onDocumentOpen?: (document: DocDocument) => void;
}) {
  const treeRows = useMemo<FolderTreeRow[]>(
    () =>
      rows.map(({ folder, documents }) => ({
        folder,
        documents,
        employees:
          kind === "employee"
            ? groupEmployeesInFolder(
                folder,
                documents,
                targets,
                employeeFilters,
              )
            : [],
      })),
    [employeeFilters, kind, rows, targets],
  );

  const visibleRows =
    kind === "employee" && employeeFilters
      ? treeRows.filter(({ employees }) => employees.length > 0)
      : treeRows;

  return (
    <FolderEmployeeFileTree
      kind={kind}
      rows={visibleRows}
      selectedFolderIds={selected}
      onToggleFolderSelected={onToggleSelected}
      isDocumentManager={isDocumentManager}
      guideTarget={guideTarget}
      onDocumentOpen={onDocumentOpen}
      emptyMessage={
        kind === "employee"
          ? "No employees match the current filters."
          : "No folders found."
      }
    />
  );
}
