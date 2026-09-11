import { api } from "./api";
import type { DocDocument, UploadDuplicateMatch } from "./types";

export async function findUploadDuplicates(
  employeeId: number,
  files: File[],
  typeIds: string[],
): Promise<UploadDuplicateMatch[]> {
  const items = files
    .map((file, index) => ({
      filename: file.name,
      document_type_id: Number(typeIds[index] || 0),
    }))
    .filter((item) => item.filename && item.document_type_id);

  if (!employeeId || !items.length) return [];

  const result = await api.checkUploadDuplicates({
    employee_id: employeeId,
    items,
  });

  return result.success ? result.matches ?? [] : [];
}

export function buildReplaceDocumentIds(
  files: File[],
  typeIds: string[],
  matches: UploadDuplicateMatch[],
): Array<number | null> {
  return files.map((file, index) => {
    const documentTypeId = Number(typeIds[index] || 0);
    const match = matches.find(
      (item) =>
        item.document_type_id === documentTypeId &&
        item.filename.toLowerCase() === file.name.toLowerCase(),
    );
    return match?.id ?? null;
  });
}

export function buildVersionChangeNotes(
  files: File[],
  typeIds: string[],
  matches: UploadDuplicateMatch[],
): string[] {
  return files.map((file, index) => {
    const documentTypeId = Number(typeIds[index] || 0);
    const match = matches.find(
      (item) =>
        item.document_type_id === documentTypeId &&
        item.filename.toLowerCase() === file.name.toLowerCase(),
    );
    return match ? "Uploaded new version" : "";
  });
}

export function findFolderUploadDuplicates(
  files: File[],
  typeIds: string[],
  existingDocuments: DocDocument[],
): UploadDuplicateMatch[] {
  const matches: UploadDuplicateMatch[] = [];

  files.forEach((file, index) => {
    const documentTypeId = Number(typeIds[index] || 0);
    if (!documentTypeId) return;

    existingDocuments
      .filter(
        (document) =>
          document.document_type_id === documentTypeId &&
          document.name.toLowerCase() === file.name.toLowerCase(),
      )
      .forEach((document) => {
        matches.push({
          filename: file.name,
          document_type_id: documentTypeId,
          id: document.id,
          name: document.name,
        });
      });
  });

  return matches;
}
