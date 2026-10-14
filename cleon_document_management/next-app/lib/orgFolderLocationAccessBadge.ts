import type { DocFolder } from "./types";
import { formatFieldLabel } from "./formatLabel";

export type OrgFolderLocationAccessBadge =
  | { tone: "confidential"; label: string }
  | { tone: "restricted"; label: string; detail?: string }
  | null;

/** Badges for folder location picker rows (not company-wide / unrestricted). */
export function orgFolderLocationAccessBadge(
  folder: Pick<DocFolder, "access_scope">,
): OrgFolderLocationAccessBadge {
  const scope = folder.access_scope || "all_staff";
  if (scope === "all_staff") return null;
  if (scope === "private" || scope === "company_owned" || scope === "admin_only") {
    const label =
      scope === "company_owned"
        ? "Company owned"
        : scope === "admin_only"
          ? "Admin only"
          : "Confidential";
    return { tone: "confidential", label };
  }
  if (scope === "department" || scope === "grade" || scope === "individual") {
    return {
      tone: "restricted",
      label: "Restricted",
      detail: formatFieldLabel(scope),
    };
  }
  return {
    tone: "restricted",
    label: "Restricted",
    detail: formatFieldLabel(scope),
  };
}
