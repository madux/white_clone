import type { MyComplianceInboxTab } from "./types";

export const MY_WORKSPACE_PATH = "/pages/my-workspace";

export const COMPLIANCE_INBOX_TAB_IDS: MyComplianceInboxTab[] = [
  "todo",
  "waiting",
  "done",
  "coming_up",
  "exceptions",
];

export function resolveComplianceInboxTab(
  value: string | null | undefined,
): MyComplianceInboxTab {
  if (value && COMPLIANCE_INBOX_TAB_IDS.includes(value as MyComplianceInboxTab)) {
    return value as MyComplianceInboxTab;
  }
  return "todo";
}

/** My Workspace primary tabs */
export type WorkspaceTabId =
  | "todo"
  | "documents"
  | "policies"
  | "requests"
  | "activity"
  | "sharing";

/** Legacy tab ids mapped via redirects */
export type LegacyWorkspaceTabId =
  | "archived"
  | "recycle"
  | "quick-access"
  | "compliance"
  | "review-queue"
  | "approvals"
  | "reviews"
  | "scheduled-reviews"
  | "team"
  | "documents"
  | "sharing"
  | "remote-access";

export const WORKSPACE_SPEC_TAB_IDS: WorkspaceTabId[] = [
  "todo",
  "documents",
  "policies",
  "requests",
  "activity",
  "sharing",
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

export function resolveWorkspaceTab(
  tabParam: string | null,
  kindParam: string | null,
): WorkspaceTabId {
  if (kindParam === "approval") return "todo";
  switch (tabParam) {
    case "todo":
    case "to-do":
      return "todo";
    case "policies":
    case "compliance":
      return "policies";
    case "requests":
    case "my-requests":
      return "requests";
    case "activity":
      return "activity";
    case "sharing":
      return "sharing";
    case "review-queue":
    case "approvals":
    case "verifications":
    case "reviews":
    case "scheduled-reviews":
    case "team":
      return "todo";
    case "documents":
    case "archived":
    case "recycle":
    case "quick-access":
    default:
      return "documents";
  }
}

export function myWorkspaceHref(
  tab: WorkspaceTabId | LegacyWorkspaceTabId | "remote-access",
  extra?: Record<string, string | undefined | null>,
) {
  const params = new URLSearchParams();
  if (tab === "archived") {
    params.set("tab", "documents");
    params.set("lifecycle", "archived");
  } else if (tab === "recycle") {
    params.set("tab", "documents");
    params.set("lifecycle", "recycle");
  } else if (tab === "quick-access") {
    params.set("tab", "documents");
    params.set("scope", "quick-access");
  } else if (tab === "compliance") {
    params.set("tab", "policies");
  } else if (tab === "review-queue" || tab === "approvals") {
    params.set("tab", "todo");
    params.set("kind", "approval");
  } else if (tab === "reviews" || tab === "scheduled-reviews") {
    params.set("tab", "todo");
    params.set("kind", "review");
  } else if (tab === "team") {
    params.set("tab", "todo");
    params.set("kind", "team");
  } else if (tab === "sharing" || tab === "remote-access") {
    params.set("tab", "sharing");
  } else {
    params.set("tab", tab);
  }
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `${MY_WORKSPACE_PATH}/?${params.toString()}`;
}

export function mapLegacyDocumentsParams(search: URLSearchParams) {
  const next = new URLSearchParams();
  const tab = search.get("tab");
  if (tab === "compliance") {
    next.set("tab", "policies");
  } else if (tab === "review-queue" || tab === "approvals") {
    next.set("tab", "todo");
    next.set("kind", "approval");
  } else if (tab === "archived") {
    next.set("tab", "documents");
    next.set("lifecycle", "archived");
  } else if (tab === "recycle") {
    next.set("tab", "documents");
    next.set("lifecycle", "recycle");
  } else if (tab === "quick-access") {
    next.set("tab", "documents");
    next.set("scope", "quick-access");
  } else if (tab === "remote-access" || tab === "sharing") {
    next.set("tab", "sharing");
  } else if (tab === "needs_ack") {
    next.set("tab", "documents");
    next.set("scope", "shared");
    next.set("ack", "needs");
  } else if (tab === "outstanding" || search.get("scope") === "outstanding") {
    next.set("tab", "policies");
    next.set("inbox", "todo");
  } else if (tab === "shared" || tab === "files") {
    next.set("tab", "documents");
    next.set("scope", tab);
  } else if (search.get("scope") === "needs_ack") {
    next.set("tab", "documents");
    next.set("scope", "shared");
    next.set("ack", "needs");
  } else if (search.get("scope")) {
    next.set("tab", "documents");
    next.set("scope", search.get("scope") || "");
  } else if (tab) {
    next.set("tab", tab);
  }
  ["doc", "upload", "guide", "type", "lifecycle", "kind", "ack", "inbox"].forEach((key) => {
    const value = search.get(key);
    if (value) next.set(key, value);
  });
  return next;
}
