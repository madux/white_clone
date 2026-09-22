import type { DocumentType } from "./types";

export function typeRequiresIssueDate(
  typeId: string,
  types: DocumentType[],
): boolean {
  const match = types.find((item) => String(item.id) === typeId);
  return match?.require_issue_date === true;
}

export function typeRequiresDescription(
  typeId: string,
  types: DocumentType[],
): boolean {
  const match = types.find((item) => String(item.id) === typeId);
  return match?.require_description === true;
}

export function typeRequiresExpiry(
  typeId: string,
  types: DocumentType[],
): boolean {
  const match = types.find((item) => String(item.id) === typeId);
  return match?.expiry_applicable === true;
}

export function missingUploadMetadata(
  typeIds: string[],
  expiryDates: string[],
  issueDates: string[],
  descriptions: string[],
  types: DocumentType[],
): boolean {
  return Boolean(firstUploadMetadataError(typeIds, expiryDates, issueDates, descriptions, types));
}

export function firstUploadMetadataError(
  typeIds: string[],
  expiryDates: string[],
  issueDates: string[],
  descriptions: string[],
  types: DocumentType[],
): string | null {
  for (let index = 0; index < typeIds.length; index += 1) {
    const typeId = typeIds[index];
    const type = types.find((item) => String(item.id) === typeId);
    if (!type) continue;
    if (type.expiry_applicable && !expiryDates[index]?.trim()) {
      return `Expiry date is required for ${type.name}.`;
    }
    if (type.require_issue_date && !issueDates[index]?.trim()) {
      return `Issue date is required for ${type.name}.`;
    }
    if (type.require_description && !descriptions[index]?.trim()) {
      return `Description is required for ${type.name}.`;
    }
  }
  return null;
}
