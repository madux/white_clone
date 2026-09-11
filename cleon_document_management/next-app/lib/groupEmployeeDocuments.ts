import type { DocDocument } from "./types";

export type EmployeeDocumentGroup = {
  primary: DocDocument;
  relatedDocuments: DocDocument[];
  historyCount: number;
};

function documentGroupKey(document: DocDocument) {
  return `${document.document_type_id}:${document.name.trim().toLowerCase()}`;
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
