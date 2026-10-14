/** Policy-level compliance verification document type selection. */

/** Tooltip for “Documents to verify” in policy / rule forms. */
export const DOCUMENTS_TO_VERIFY_HELP =
  "Optional. Check each required document type that must be reviewed and approved after upload. The verifier you set below handles those uploads. Types you leave unchecked still count toward the rule when the file is on record and valid—no separate approval step.";

export function pruneVerificationDocumentTypeIds(
  requiredIds: number[],
  verificationIds: number[],
): number[] {
  const allowed = new Set(requiredIds);
  return verificationIds.filter((id) => allowed.has(id));
}

export function toggleVerificationDocumentTypeId(
  verificationIds: number[],
  typeId: number,
  enabled: boolean,
): number[] {
  const set = new Set(verificationIds);
  if (enabled) {
    set.add(typeId);
  } else {
    set.delete(typeId);
  }
  return Array.from(set);
}
