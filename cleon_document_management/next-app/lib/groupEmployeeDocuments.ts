import type { DocDocument } from "./types";

export type EmployeeDocumentGroup = {
  primary: DocDocument;
  relatedDocuments: DocDocument[];
  historyCount: number;
};

function documentGroupKey(document: DocDocument) {
  return `${document.document_type_id}:${document.name.trim().toLowerCase()}`;
}

export function getGroupMemberIds(group: EmployeeDocumentGroup): number[] {
  return [group.primary.id, ...group.relatedDocuments.map((document) => document.id)];
}

export function expandDeleteDocumentIds(
  selected: number[],
  groups: EmployeeDocumentGroup[],
): number[] {
  const expanded = new Set<number>();
  for (const group of groups) {
    const memberIds = getGroupMemberIds(group);
    if (memberIds.some((id) => selected.includes(id))) {
      memberIds.forEach((id) => expanded.add(id));
    }
  }
  selected.forEach((id) => expanded.add(id));
  return [...expanded];
}

export function groupForDocumentId(
  groups: EmployeeDocumentGroup[],
  documentId: number,
): EmployeeDocumentGroup | undefined {
  return groups.find((group) => getGroupMemberIds(group).includes(documentId));
}

export function groupEmployeeDocuments(documents: DocDocument[]): EmployeeDocumentGroup[] {
  const groups = new Map<string, DocDocument[]>();

  for (const document of documents) {
    const key = documentGroupKey(document);
    const list = groups.get(key) ?? [];
    list.push(document);
    groups.set(key, list);
  }

  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((left, right) =>
      right.write_date.localeCompare(left.write_date),
    );
    const primary = sorted[0];
    const relatedDocuments = sorted.slice(1);
    const archivedVersions = primary.version_count ?? 0;

    return {
      primary,
      relatedDocuments,
      historyCount: archivedVersions + relatedDocuments.length,
    };
  });
}
