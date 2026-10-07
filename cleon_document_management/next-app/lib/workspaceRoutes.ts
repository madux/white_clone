export const MY_WORKSPACE_PATH = "/pages/my-workspace";

export type WorkspaceTabId =
  | "documents"
  | "archived"
  | "recycle"
  | "quick-access"
  | "compliance"
  | "review-queue"
  | "reviews"
  | "team";

export const WORKSPACE_TAB_IDS: WorkspaceTabId[] = [
  "documents",
  "archived",
  "recycle",
  "quick-access",
  "compliance",
  "review-queue",
  "reviews",
  "team",
];

export function isWorkspacePath(path: string) {
  return (
    path.startsWith("/pages/my-workspace") ||
    path.startsWith("/pages/my-documents") ||
    path.startsWith("/pages/archived") ||
    path.startsWith("/pages/recycle-bin") ||
    path.startsWith("/pages/quick-access") ||
    path.startsWith("/pages/my-compliance") ||
    path.startsWith("/pages/my-verifications") ||
    path.startsWith("/pages/my-reviews") ||
    path.startsWith("/pages/my-team")
  );
}

export function myWorkspaceHref(
  tab: WorkspaceTabId,
  extra?: Record<string, string | undefined | null>,
) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `${MY_WORKSPACE_PATH}/?${params.toString()}`;
}

export function mapLegacyDocumentsParams(search: URLSearchParams) {
  const next = new URLSearchParams();
  const tab = search.get("tab");
  if (tab === "shared" || tab === "files" || tab === "outstanding" || tab === "needs_ack") {
    next.set("scope", tab);
  } else if (search.get("scope")) next.set("scope", search.get("scope") || "");
  ["doc", "upload", "guide", "type"].forEach((key) => {
    const value = search.get(key);
    if (value) next.set(key, value);
  });
  return next;
}
