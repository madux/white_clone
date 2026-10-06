import type { DocumentType } from "./types";

export function documentTypeExpiryApplicable(
  type: Pick<DocumentType, "expiry_applicable">,
): boolean {
  return type.expiry_applicable === true;
}

/** Document types selectable for a compliance rule/policy of the given type. */
export function documentTypesForCompliancePolicy(
  typeCode: string,
  types: DocumentType[],
): DocumentType[] {
  if (typeCode === "renewable_document") {
    return types.filter(documentTypeExpiryApplicable);
  }
  return types;
}

export function pruneDocumentTypeIdsForPolicy(
  typeCode: string,
  ids: number[],
  types: DocumentType[],
): number[] {
  const allowed = new Set(
    documentTypesForCompliancePolicy(typeCode, types).map((item) => item.id),
  );
  return ids.filter((id) => allowed.has(id));
}
