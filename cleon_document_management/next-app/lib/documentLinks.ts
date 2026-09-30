import { myWorkspaceHref } from "./workspaceRoutes";

export type DocumentLinkTarget = {
  id: number;
  folder_id?: number | false;
  employee_id?: number | false | null;
  folder_type?: "employee" | "organizational" | string;
};

export function documentViewHref(
  doc: DocumentLinkTarget,
  isDocumentManager: boolean,
): string {
  if (doc.folder_type === "organizational" && doc.folder_id) {
    if (!isDocumentManager) {
      return acknowledgementViewHref(doc.id);
    }
    return `/pages/organization/folder/?folder=${doc.folder_id}&doc=${doc.id}`;
  }
  if (!isDocumentManager) {
    return myWorkspaceHref("documents", { doc: String(doc.id) });
  }
  if (doc.employee_id) {
    return `/pages/employee/profile/?employee=${doc.employee_id}&doc=${doc.id}`;
  }
  if (doc.folder_id) {
    return `/pages/organization/folder/?folder=${doc.folder_id}&doc=${doc.id}`;
  }
  return myWorkspaceHref("documents", { doc: String(doc.id) });
}

export function acknowledgementViewHref(documentId: number): string {
  return myWorkspaceHref("documents", { scope: "shared", doc: String(documentId) });
}

export function organizationalDocumentHref(
  folderId: number,
  documentId: number,
): string {
  return `/pages/organization/folder/?folder=${folderId}&doc=${documentId}`;
}

export function approvalInboxHref(
  item: Pick<
    DocumentLinkTarget,
    "id" | "folder_id" | "employee_id" | "folder_type"
  > & { document_id?: number },
): string {
  return documentViewHref(
    {
      id: item.document_id || item.id,
      folder_id: item.folder_id,
      employee_id: item.employee_id,
      folder_type: item.folder_type,
    },
    true,
  );
}
