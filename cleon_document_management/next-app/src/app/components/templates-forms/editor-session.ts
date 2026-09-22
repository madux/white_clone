const DOC_KEY = "tf.editor.document";
const SUB_KEY = "tf.editor.submission";

export function rememberEditorDocument(documentId: number, submissionId?: number) {
  if (typeof window === "undefined" || !documentId) return;
  sessionStorage.setItem(DOC_KEY, String(documentId));
  if (submissionId) sessionStorage.setItem(SUB_KEY, String(submissionId));
  else sessionStorage.removeItem(SUB_KEY);
}

export function readStoredId(search: URLSearchParams, param: "document" | "submission") {
  const fromQuery = Number(search.get(param) || 0);
  if (fromQuery) return fromQuery;
  if (typeof window === "undefined") return 0;
  const fromWindow = Number(new URLSearchParams(window.location.search).get(param) || 0);
  if (fromWindow) return fromWindow;
  const key = param === "document" ? DOC_KEY : SUB_KEY;
  return Number(sessionStorage.getItem(key) || 0);
}

export function editorPath(documentId: number, submissionId?: number) {
  const qs = new URLSearchParams({ document: String(documentId) });
  if (submissionId) qs.set("submission", String(submissionId));
  return `/document-management/pages/organization/templates-forms/editor/?${qs.toString()}`;
}

export function openGeneratedEditor(documentId: number, submissionId?: number) {
  rememberEditorDocument(documentId, submissionId);
  window.location.assign(editorPath(documentId, submissionId));
}
