import type { DocumentType, RetentionSettingRule } from "./types";

/** One row per document type id (API/cache may return duplicates). */
export function dedupeDocumentTypesById<T extends { id: number | string }>(
  types: T[],
): T[] {
  const byId = new Map<number, T>();
  for (const type of types) {
    const id = Number(type.id);
    if (!Number.isFinite(id)) continue;
    if (!byId.has(id)) {
      byId.set(id, type);
    }
  }
  return Array.from(byId.values());
}

export function dedupeDocumentTypeIds(ids: number[]): number[] {
  return [...new Set(ids.map((id) => Number(id)).filter(Number.isFinite))];
}

/** Collapse legacy + catalog rows that share the same display name. */
export function dedupeDocumentTypesByName<T extends { id: number | string; name: string }>(
  types: T[],
): T[] {
  const byName = new Map<string, T>();
  for (const type of dedupeDocumentTypesById(types)) {
    const key = (type.name || "").trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, type);
      continue;
    }
    if (Number(type.id) < Number(existing.id)) {
      byName.set(key, type);
    }
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** Types list for compliance pickers (unique id + unique name). */
export function documentTypesForPicker<T extends { id: number | string; name: string }>(
  types: T[],
): T[] {
  return dedupeDocumentTypesByName(types);
}

export function documentTypeExpiryApplicable(
  type: Pick<DocumentType, "expiry_applicable">,
): boolean {
  return type.expiry_applicable === true;
}

/** Document types that renewable-document rules may reference. */
export function filterExpiryApplicableDocumentTypes<T extends DocumentType>(
  types: T[],
): T[] {
  return documentTypesForPicker(types).filter(documentTypeExpiryApplicable);
}

/** Document types that have complete retention rules in Settings → Retention. */
export function documentTypesWithRetentionSettings(
  types: DocumentType[],
  retentionRules: RetentionSettingRule[] | undefined,
): DocumentType[] {
  const unique = documentTypesForPicker(types);
  if (!retentionRules?.length) {
    return [];
  }
  const configured = new Set(
    retentionRules
      .filter((rule) => rule.active && rule.compliance_complete)
      .map((rule) => Number(rule.document_type_id)),
  );
  return unique.filter((type) => configured.has(Number(type.id)));
}

/** Document types selectable for a compliance rule/policy of the given type. */
export function documentTypesForCompliancePolicy(
  typeCode: string,
  types: DocumentType[],
  retentionRules?: RetentionSettingRule[],
): DocumentType[] {
  const unique = documentTypesForPicker(types);
  if (typeCode === "renewable_document") {
    return filterExpiryApplicableDocumentTypes(unique);
  }
  if (typeCode === "retention") {
    return documentTypesWithRetentionSettings(unique, retentionRules);
  }
  return unique;
}

export function pruneDocumentTypeIdsForPolicy(
  typeCode: string,
  ids: number[],
  types: DocumentType[],
  retentionRules?: RetentionSettingRule[],
): number[] {
  const allowed = new Set(
    documentTypesForCompliancePolicy(typeCode, types, retentionRules).map(
      (item) => item.id,
    ),
  );
  return ids.filter((id) => allowed.has(id));
}
