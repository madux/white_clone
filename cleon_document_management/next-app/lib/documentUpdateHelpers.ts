import type { DocDocument } from "./types";

export function canUpdateDocument(
  document: Pick<
    DocDocument,
    | "approval_state"
    | "has_pending_revision"
    | "active"
    | "deleted_at"
    | "document_type_enable_versioning"
  >,
): boolean {
  if (document.deleted_at) return false;
  if (document.active === false) return false;
  if (document.has_pending_revision) return false;
  if (document.approval_state === "pending") return false;
  if (document.document_type_enable_versioning === false) return false;
  return true;
}

export function updateBlockedMessage(
  document: Pick<
    DocDocument,
    | "approval_state"
    | "has_pending_revision"
    | "active"
    | "deleted_at"
    | "document_type_enable_versioning"
  >,
): string | null {
  if (canUpdateDocument(document)) return null;
  if (document.document_type_enable_versioning === false) {
    return "Versioning is disabled for this document type.";
  }
  if (document.has_pending_revision || document.approval_state === "pending") {
    return "An update is already pending approval.";
  }
  return "This document cannot be updated.";
}
