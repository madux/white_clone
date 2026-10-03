import type { DocDocument } from "./types";

/** Display/file name for an org policy document (e.g. "Code of Conduct.pdf"). */
export function policyDocumentFileName(policyName: string): string {
  const base = policyName.trim();
  if (!base) return "Policy.pdf";
  if (/\.[a-z0-9]{2,8}$/i.test(base)) return base;
  return `${base}.pdf`;
}

/** Documents that can be registered via Import as policy (not already a policy record). */
type OrgPolicyDocumentFields = Pick<
  DocDocument,
  "is_policy" | "linked_policy_id" | "organizational_policy_id"
>;

export function canImportDocumentAsPolicy(document: OrgPolicyDocumentFields): boolean {
  if (document.organizational_policy_id) return false;
  if (document.is_policy) return false;
  return true;
}

export function importPolicyBlockReason(document: OrgPolicyDocumentFields): string | null {
  if (document.organizational_policy_id) {
    return "Already registered as an organizational policy";
  }
  if (document.is_policy) return "Already marked as an organizational policy document";
  return null;
}

export function isOrgDocumentLinkedToPolicy(document: OrgPolicyDocumentFields): boolean {
  return (
    Boolean(document.organizational_policy_id) ||
    Boolean(document.is_policy)
  );
}
