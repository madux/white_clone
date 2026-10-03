export type DocumentUploadDraft = {
  files: File[];
  typeIds: string[];
  expiryDates: string[];
  issueDates: string[];
  descriptions: string[];
  bulkTypeId: string;
};

const drafts = new Map<string, DocumentUploadDraft>();

export function readDocumentUploadDraft(key: string): DocumentUploadDraft | undefined {
  return drafts.get(key);
}

export function writeDocumentUploadDraft(key: string, draft: DocumentUploadDraft) {
  drafts.set(key, draft);
}

export function clearDocumentUploadDraft(key: string) {
  drafts.delete(key);
}
