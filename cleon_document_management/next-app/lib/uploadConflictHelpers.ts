import { api } from "./api";
import type { UploadConflict } from "./types";

export async function findUploadConflictsByFileIndex(
  employeeId: number,
  typeIds: string[],
): Promise<Array<UploadConflict | null>> {
  const uniqueTypeIds = [
    ...new Set(
      typeIds.map((id) => Number(id || 0)).filter((id) => id > 0),
    ),
  ];
  if (!employeeId || !uniqueTypeIds.length) {
    return typeIds.map(() => null);
  }

  const result = await api.checkUploadConflicts({
    employee_id: employeeId,
    items: uniqueTypeIds.map((document_type_id) => ({ document_type_id })),
  });

  if (!result.success) return typeIds.map(() => null);

  const byType = new Map(
    (result.conflicts ?? []).map((conflict) => [
      conflict.document_type_id,
      conflict,
    ]),
  );

  return typeIds.map((typeId) => byType.get(Number(typeId || 0)) ?? null);
}

export function buildReplaceDocumentIdsFromConflicts(
  perFileConflicts: Array<UploadConflict | null>,
): Array<number | null> {
  return perFileConflicts.map((conflict) =>
    conflict ? conflict.existing_document_id : null,
  );
}

export function buildAllowSeparateDuplicates(
  perFileConflicts: Array<UploadConflict | null>,
): boolean[] {
  return perFileConflicts.map((conflict) => Boolean(conflict));
}

export function buildVersionChangeNotesFromConflicts(
  perFileConflicts: Array<UploadConflict | null>,
): string[] {
  return perFileConflicts.map((conflict) =>
    conflict ? "Uploaded new version" : "",
  );
}

export function preventConflictMessage(
  perFileConflicts: Array<UploadConflict | null>,
): string | null {
  const blocked = perFileConflicts.find(
    (conflict) => conflict?.policy === "prevent",
  );
  if (!blocked) return null;
  return `An active ${blocked.document_type_name} document already exists for this employee. Use Update on the existing document.`;
}

export function hasResolvableConflicts(
  perFileConflicts: Array<UploadConflict | null>,
): boolean {
  return perFileConflicts.some((conflict) => conflict && conflict.policy !== "prevent");
}
