import type { DocumentType } from "../../../lib/types";

export function typeRequiresExpiry(
  typeId: string,
  types: DocumentType[],
): boolean {
  const match = types.find((item) => String(item.id) === typeId);
  return match?.expiry_applicable === true;
}

export function missingExpiryDates(
  typeIds: string[],
  expiryDates: string[],
  types: DocumentType[],
): boolean {
  return typeIds.some(
    (typeId, index) =>
      typeRequiresExpiry(typeId, types) && !expiryDates[index]?.trim(),
  );
}
