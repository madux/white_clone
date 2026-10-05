import type { DocDocument } from "./types";

export const DRAFT_POLICY_ACTION_HINT =
  "Activate the policy before performing this action on documents inside it.";

export function isDraftPolicyFolderContext(
  folderKind?: string | null,
  policyLifecycleStatus?: string | null | false,
): boolean {
  return folderKind === "policy" && policyLifecycleStatus === "draft";
}

export function documentInDraftPolicyFolder(document?: DocDocument | null): boolean {
  if (!document) return false;
  return isDraftPolicyFolderContext(
    document.folder_kind,
    document.organizational_policy_lifecycle_status,
  );
}
