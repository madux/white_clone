const DOC_KEY = "policy.editor.document";
const HR_KEY = "policy.editor.hr";
const FOLDER_KEY = "policy.editor.folder";

export function rememberPolicyEditorSession(
  editorDocumentId: number,
  hrDocumentId: number,
  folderId: number,
) {
  if (typeof window === "undefined" || !editorDocumentId) return;
  sessionStorage.setItem(DOC_KEY, String(editorDocumentId));
  sessionStorage.setItem(HR_KEY, String(hrDocumentId));
  sessionStorage.setItem(FOLDER_KEY, String(folderId));
}

export function readPolicyEditorIds(search: URLSearchParams) {
  const documentId = Number(search.get("document") || 0);
  const hrDocumentId = Number(search.get("hr_document") || 0);
  const folderId = Number(search.get("folder") || 0);
  if (typeof window === "undefined") {
    return { documentId, hrDocumentId, folderId };
  }
  return {
    documentId:
      documentId ||
      Number(new URLSearchParams(window.location.search).get("document") || 0) ||
      Number(sessionStorage.getItem(DOC_KEY) || 0),
    hrDocumentId:
      hrDocumentId ||
      Number(new URLSearchParams(window.location.search).get("hr_document") || 0) ||
      Number(sessionStorage.getItem(HR_KEY) || 0),
    folderId:
      folderId ||
      Number(new URLSearchParams(window.location.search).get("folder") || 0) ||
      Number(sessionStorage.getItem(FOLDER_KEY) || 0),
  };
}

export function policyEditorPath(
  editorDocumentId: number,
  hrDocumentId: number,
  folderId: number,
) {
  const qs = new URLSearchParams({
    document: String(editorDocumentId),
    hr_document: String(hrDocumentId),
    folder: String(folderId),
  });
  return `/pages/organization/policy-editor?${qs.toString()}`;
}

export function openPolicyEditor(
  editorDocumentId: number,
  hrDocumentId: number,
  folderId: number,
) {
  rememberPolicyEditorSession(editorDocumentId, hrDocumentId, folderId);
  window.location.assign(policyEditorPath(editorDocumentId, hrDocumentId, folderId));
}
