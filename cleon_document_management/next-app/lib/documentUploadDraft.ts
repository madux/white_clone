import {
  clearSessionFormDraft,
  readSessionFormDraft,
  writeSessionFormDraft,
} from "./sessionFormDraft";

export type DocumentUploadDraft = {
  files: File[];
  typeIds: string[];
  expiryDates: string[];
  issueDates: string[];
  descriptions: string[];
  bulkTypeId: string;
};

type PersistedDocumentUploadDraft = Omit<DocumentUploadDraft, "files">;

function storageId(key: string) {
  return `upload/${key}`;
}

export function readDocumentUploadDraft(key: string): DocumentUploadDraft | undefined {
  const saved = readSessionFormDraft<PersistedDocumentUploadDraft>(storageId(key));
  if (!saved) return undefined;
  return { ...saved, files: [] };
}

export function writeDocumentUploadDraft(key: string, draft: DocumentUploadDraft) {
  const { files: _files, ...persisted } = draft;
  writeSessionFormDraft(storageId(key), persisted);
}

export function clearDocumentUploadDraft(key: string) {
  clearSessionFormDraft(storageId(key));
}
