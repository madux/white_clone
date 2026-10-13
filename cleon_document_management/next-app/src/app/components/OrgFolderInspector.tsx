"use client";

import FolderDetailsPanel from "./FolderDetailsPanel";
import OrgFolderIcon from "./OrgFolderIcon";
import FolderActions from "./FolderActions";
import type { DocDocument, DocFolder } from "../../../lib/types";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import { folderKindLabel } from "../../../lib/organizationalFolderDetails";

export default function OrgFolderInspector({
  folder,
  folderDocuments,
}: {
  folder: DocFolder;
  folderDocuments?: DocDocument[];
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-start gap-3">
          <OrgFolderIcon
            className="h-12 w-12 shrink-0"
            folderKind={folder.folder_kind}
            hasContent={(folder.document_count ?? 0) > 0}
            documents={folderDocuments ?? []}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">
              {folder.folder_name}
            </p>
            <p className="text-xs text-slate-500">
              {folderKindLabel(folder.folder_kind)} ·{" "}
              {formatDocumentDate(folder.last_modified)}
            </p>
          </div>
          <FolderActions
            folderId={folder.id}
            folderName={folder.folder_name}
            description={folder.description}
            locked={folder.locked}
            folderType={folder.folder_type}
            accessScope={folder.access_scope}
            departmentIds={folder.department_ids}
            gradeIds={folder.grade_ids}
            employeeIds={folder.employee_ids}
            colorHex={folder.color_hex}
            folderKind={folder.folder_kind}
            organizeBy={folder.organize_by}
            requireUploadApproval={folder.require_upload_approval}
            approvalFlow={folder.approval_flow}
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FolderDetailsPanel
          variant="inline"
          folderId={folder.id}
          folderName={folder.folder_name}
          folderType="organizational"
          description={folder.description}
          locked={folder.locked}
          accessScope={folder.access_scope}
          collectionCode={folder.collection_code}
          folderKind={folder.folder_kind}
          organizeBy={folder.organize_by}
          ownerName={folder.owner_name}
          lastModified={folder.last_modified}
          requireUploadApproval={folder.require_upload_approval}
          approvalFlow={folder.approval_flow}
          retentionPeriod={folder.retention_period}
        />
      </div>
    </aside>
  );
}
