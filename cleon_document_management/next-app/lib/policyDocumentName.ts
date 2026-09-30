import type { DocDocument } from "./types";

/** Display/file name for an org policy document (e.g. "Code of Conduct.pdf"). */
export function policyDocumentFileName(policyName: string): string {
  const base = policyName.trim();
  if (!base) return "Policy.pdf";
  if (/\.[a-z0-9]{2,8}$/i.test(base)) return base;
  return `${base}.pdf`;
}

/** Documents that can be registered via Import as policy (not already a policy record). */
export function canImportDocumentAsPolicy(document: Pick<
  DocDocument,
  "is_policy" | "linked_policy_id"
>): boolean {
  if (document.linked_policy_id) return false;
  if (document.is_policy) return false;
  return true;
}

export function importPolicyBlockReason(
  document: Pick<DocDocument, "is_policy" | "linked_policy_id">,
): string | null {
  if (document.linked_policy_id) return "Already linked to a compliance policy";
  if (document.is_policy) return "Already marked as a policy document";
  return null;
}

export function isOrgDocumentLinkedToPolicy(
  document: Pick<DocDocument, "is_policy" | "linked_policy_id">,
): boolean {
  return Boolean(document.linked_policy_id) || Boolean(document.is_policy);
}
