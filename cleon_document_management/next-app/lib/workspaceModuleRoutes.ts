/** Map app routes to workspace module keys for remote-mode guards and sidebar filtering. */
export const ROUTE_MODULE_PREFIXES: { prefix: string; moduleKey: string }[] = [
  { prefix: "/pages/dashboard", moduleKey: "home" },
  { prefix: "/pages/activity", moduleKey: "home" },
  { prefix: "/pages/my-workspace", moduleKey: "my_workspace" },
  { prefix: "/pages/my-documents", moduleKey: "my_workspace" },
  { prefix: "/pages/my-compliance", moduleKey: "self_service_compliance" },
  { prefix: "/pages/my-team", moduleKey: "self_service_team" },
  { prefix: "/pages/my-reviews", moduleKey: "self_service_reviews" },
  { prefix: "/pages/pending-uploads", moduleKey: "self_service_approvals" },
  { prefix: "/pages/approvals", moduleKey: "self_service_approvals" },
  { prefix: "/pages/employee", moduleKey: "employee_files" },
  { prefix: "/pages/compliance", moduleKey: "compliance_admin" },
  { prefix: "/pages/organization/templates-forms", moduleKey: "templates_forms" },
  { prefix: "/pages/organization", moduleKey: "organizational_files" },
  { prefix: "/pages/document-intelligence", moduleKey: "document_intelligence" },
  { prefix: "/pages/settings", moduleKey: "settings" },
  { prefix: "/pages/super-admin", moduleKey: "super_admin" },
];

export function moduleKeyForPath(pathname: string): string | null {
  const path =
    pathname.replace(/^\/document-management(?=\/|$)/, "") || "/";
  if (path.startsWith("/pages/remote-access")) return null;
  for (const entry of ROUTE_MODULE_PREFIXES) {
    if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
      return entry.moduleKey;
    }
  }
  if (path.startsWith("/pages/my-workspace")) {
    const tab = path.includes("tab=compliance")
      ? "self_service_compliance"
      : path.includes("tab=team")
        ? "self_service_team"
        : path.includes("tab=reviews") || path.includes("tab=scheduled-reviews")
          ? "self_service_reviews"
          : path.includes("tab=review-queue") ||
              path.includes("tab=approvals") ||
              path.includes("tab=verifications")
            ? "self_service_approvals"
            : "my_workspace";
    return tab;
  }
  return null;
}
