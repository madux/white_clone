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
  if (!isDocumentManager) {
    return `/pages/my-documents/?doc=${doc.id}`;
  }
  if (doc.employee_id) {
    return `/pages/employee/profile/?employee=${doc.employee_id}&doc=${doc.id}`;
  }
  if (doc.folder_id) {
    return `/pages/organization/folder/?folder=${doc.folder_id}&doc=${doc.id}`;
  }
  return `/pages/my-documents/?doc=${doc.id}`;
}
