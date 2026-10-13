import type { DocDocument } from "./types";

const IMPORTED_FROM_LABELS: Record<string, string> = {
  native: "Upload",
  google_drive: "Google Drive",
  onedrive: "OneDrive",
  sharepoint: "SharePoint",
  dropbox: "Dropbox",
  scan: "Scan",
};

/** Stable key for source filters (matches IMPORTED_FROM and special cases). */
export function orgDocumentSourceKey(document: DocDocument): string {
  if (document.is_shortcut) return "shortcut";
  if (document.source_url?.trim()) return "external_link";
  const imported = document.imported_from || "native";
  if (imported !== "native") return imported;
  if (document.is_template) return "template";
  if (document.editor_source && document.editor_source !== "none") return "policy_editor";
  if (document.linked_template_document_id) return "generated_template";
  return "upload";
}

export const ORG_DOCUMENT_SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "upload", label: "Upload" },
  { value: "external_link", label: "External link" },
  { value: "shortcut", label: "Shortcut" },
  { value: "template", label: "Template" },
  { value: "generated_template", label: "Generated from template" },
  { value: "policy_editor", label: "Policy editor" },
  { value: "google_drive", label: "Google Drive" },
  { value: "onedrive", label: "OneDrive" },
  { value: "sharepoint", label: "SharePoint" },
  { value: "dropbox", label: "Dropbox" },
  { value: "scan", label: "Scan" },
];

/** Human-readable origin for organizational library document rows. */
export function orgDocumentSourceLabel(document: DocDocument): string {
  if (document.is_shortcut) {
    const target = document.shortcut_of_name?.trim();
    return target ? `Shortcut · ${target}` : "Shortcut";
  }
  if (document.source_url?.trim()) {
    return "External link";
  }
  const imported = document.imported_from || "native";
  if (imported !== "native") {
    return IMPORTED_FROM_LABELS[imported] || imported.replace(/_/g, " ");
  }
  if (document.is_template) {
    return "Template";
  }
  if (document.editor_source && document.editor_source !== "none") {
    return "Policy editor";
  }
  if (document.linked_template_document_id) {
    return "Generated from template";
  }
  return "Upload";
}
