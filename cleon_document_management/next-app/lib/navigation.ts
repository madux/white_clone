export type NavigationEntry = {
  href: string;
  label: string;
};

export const NAVIGATION_STACK_KEY = "cleon-doc-navigation-stack";

export function normalizeRoutePath(pathname: string | null): string {
  if (!pathname) return "/";
  const stripped = pathname.replace(/^\/document-management(?=\/|$)/, "") || "/";
  if (stripped.length > 1 && stripped.endsWith("/")) {
    return stripped.slice(0, -1);
  }
  return stripped;
}

export function buildRouteHref(path: string, search = ""): string {
  const normalized = normalizeRoutePath(path);
  return search ? `${normalized}?${search}` : normalized;
}

export function getNavigationLabel(
  path: string,
  searchParams?: URLSearchParams,
): string {
  const route = normalizeRoutePath(path);

  if (route.startsWith("/pages/employee/profile")) return "Employee profile";
  if (route.startsWith("/pages/employee/folder")) return "Employee folder";
  if (route.startsWith("/pages/employee/group")) return "Employee group";
  if (route === "/pages/employee") {
    const tab = searchParams?.get("tab");
    if (tab === "compliance") return "Compliance";
    if (tab === "issues") return "Issues";
    return "Employee Files";
  }
  if (route === "/pages/approvals") {
    const kind = searchParams?.get("kind");
    if (kind === "employee") return "Employee approvals";
    if (kind === "organizational") return "Organisational approvals";
    return "Approval requests";
  }
  if (route === "/pages/employee/issues") return "Issues";
  if (route === "/pages/employee/automation") return "Automation hub";
  if (route.startsWith("/pages/organization/folder")) return "Organizational folder";
  if (route.startsWith("/pages/organization/policy-editor")) return "Policy editor";
  if (route === "/pages/organization") return "Organizational Files";
  if (route === "/pages/organization/approvals") return "Approval requests";
  if (route === "/pages/organization/retention") return "Retention review";
  if (route === "/pages/organization/legal-holds") return "Legal holds";
  if (route === "/pages/organization/automation") return "Automation hub";
  if (route === "/pages/organization/policy-assignments") return "Policy assignments";
  if (route === "/pages/pending-uploads") return "Pending Uploads";
  if (route === "/pages/recycle-bin" || (route === "/pages/my-workspace" && searchParams?.get("tab") === "recycle")) return "Recycle Bin";
  if (route === "/pages/dashboard") {
    return searchParams?.get("tab") === "activity" ? "Activity" : "Home";
  }
  if (route === "/pages/activity") return "Activity";
  if (route === "/pages/my-documents" || (route === "/pages/my-workspace" && (searchParams?.get("tab") === "documents" || !searchParams?.get("tab")))) return "Documents";
  if (route === "/pages/my-workspace") {
    const tab = searchParams?.get("tab");
    if (tab === "archived") return "Archived";
    if (tab === "quick-access") return "Quick Access";
    if (tab === "compliance") return "My Compliance";
    return "My Workspace";
  }
  if (route === "/pages/quick-access") return "Quick Access";
  if (route === "/pages/archived") return "Archived Documents";
  if (route === "/pages/compliance") return "Compliance";
  if (route.startsWith("/pages/compliance/run")) return "Compliance run";
  if (route === "/pages/settings") return "Settings";
  if (route === "/pages/super-admin") return "Super Admin";
  if (route.startsWith("/pages/document-intelligence/datasets/new")) {
    return searchParams?.get("id") ? "Edit dataset" : "New dataset";
  }
  if (route.startsWith("/pages/document-intelligence/datasets")) return "Datasets";
  if (route.startsWith("/pages/document-intelligence/validate")) {
    return "Validation queue";
  }
  if (route.startsWith("/pages/document-intelligence/ask")) return "Ask & Insights";
  if (route.startsWith("/pages/document-intelligence/configuration/audit")) {
    return "Audit log";
  }
  if (route.startsWith("/pages/document-intelligence/configuration/profiles")) {
    return "Profiles";
  }
  if (route.startsWith("/pages/document-intelligence/configuration/types")) {
    return "Document types";
  }
  if (route.startsWith("/pages/document-intelligence/configuration/settings")) {
    return "Intelligence settings";
  }
  if (route.startsWith("/pages/document-intelligence/configuration")) {
    return "Configuration";
  }
  if (route.startsWith("/pages/document-intelligence")) return "Document Intelligence";
  if (route === "/pages/home" || route === "/") return "Home";

  return "Previous page";
}

export function readNavigationStack(): NavigationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(NAVIGATION_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NavigationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeNavigationStack(stack: NavigationEntry[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    NAVIGATION_STACK_KEY,
    JSON.stringify(stack.slice(-30)),
  );
}
