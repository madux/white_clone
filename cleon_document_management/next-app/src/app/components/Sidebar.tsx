"use client";
import {
  Brain,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Menu,
  ScrollText,
  ShieldCheck,
  Users,
  Settings,
  Briefcase,
  X,
  KeyRound,
  History,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  canAccessDmsSettings,
  canViewTemplatesModule,
  userIsSuperAdmin,
} from "../../../lib/dmsAccess";
import {
  canAccessEmployeeFilesAdmin,
  canApproveEmployeeDocuments,
} from "../../../lib/employeeFilesAccess";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";
import { canApproveOrgRequests } from "../../../lib/organizationalFilesAccess";
import { reviewQueueHref } from "../../../lib/reviewQueue";
import { isWorkspacePath, myWorkspaceHref } from "../../../lib/workspaceRoutes";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { useWorkspaceDelegationOptional } from "../../../lib/workspaceDelegation";

type NavLink = {
  name: string;
  link: string;
  icon: any;
  moduleKey?: string | null;
  badge?: number;
};
type NavGroup = { id: string; label: string; links: NavLink[] };

const NAV_MODULE_BY_NAME: Record<string, string | null> = {
  Home: "home",
  "My Workspace": "my_workspace",
  "Employee Files": "employee_files",
  "Organizational Files": "organizational_files",
  "Templates & Forms": "templates_forms",
  "Document Intelligence": "document_intelligence",
  "My Compliance": "self_service_compliance",
  "My Team": "self_service_team",
  Approvals: "self_service_approvals",
  "Scheduled reviews": "self_service_reviews",
  Settings: "settings",
  "Remote access": null,
};

export default function Sidebar() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const delegation = useWorkspaceDelegationOptional();
  const pendingInvites =
    currentUser.data?.workspace_access?.pending_invite_count ?? 0;
  const isSuperAdmin = userIsSuperAdmin(currentUser.data);
  const isAppAdmin =
    isSuperAdmin || currentUser.data?.is_admin === true;
  const canSettings = canAccessDmsSettings(currentUser.data);
  const canTemplates = canViewTemplatesModule(currentUser.data);
  const canEmployeeFiles = canAccessEmployeeFilesAdmin(currentUser.data);
  const canOrgFiles = canAccessOrgLibrary(currentUser.data);
  const [mobileOpen, setMobileOpen] = useState(false);
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";

  const groups: NavGroup[] = useMemo(() => {
    const showHome = canEmployeeFiles || (!canEmployeeFiles && !canOrgFiles);
    const myWorkspace: NavLink = {
      name: "My Workspace",
      link: "/pages/my-workspace",
      icon: Briefcase,
    };
    const beforeIntelligence: NavLink[] = [
      ...(showHome
        ? [{ name: "Home", link: "/pages/dashboard", icon: LayoutDashboard }]
        : []),
      ...(canEmployeeFiles
        ? [{ name: "Employee Files", link: "/pages/employee", icon: Users }]
        : []),
      ...(canOrgFiles
        ? [
            {
              name: "Organizational Files",
              link: "/pages/organization",
              icon: Building2,
            },
            ...(canTemplates
              ? [
                  {
                    name: "Templates & Forms",
                    link: "/pages/organization/templates-forms",
                    icon: ScrollText,
                  },
                ]
              : []),
          ]
        : []),
    ];
    const documentIntelligence: NavLink = {
      name: "Document Intelligence",
      link: "/pages/document-intelligence",
      icon: Brain,
    };
    const primary: NavLink[] = isAppAdmin
      ? [...beforeIntelligence, myWorkspace, documentIntelligence]
      : [myWorkspace, ...beforeIntelligence, documentIntelligence];
    const admin: NavLink[] = [
      ...(canSettings
        ? [{ name: "Settings", link: "/pages/settings", icon: Settings }]
        : []),
      ...(isAppAdmin
        ? [{ name: "Audit Trail", link: "/pages/audit-trail", icon: History }]
        : []),
    ];
    const user = currentUser.data;
    const showSelfService =
      !canEmployeeFiles || user?.is_document_manager !== true;
    const remoteAccess: NavLink = {
      name: "Remote access",
      link: "/pages/remote-access",
      icon: KeyRound,
      moduleKey: null,
      badge: pendingInvites > 0 ? pendingInvites : undefined,
    };
    const selfService: NavLink[] = showSelfService
      ? [
          remoteAccess,
          {
            name: "My Compliance",
            link: "/pages/my-compliance",
            icon: ShieldCheck,
            moduleKey: "self_service_compliance",
          },
          {
            name: "My Team",
            link: myWorkspaceHref("team"),
            icon: Users,
            moduleKey: "self_service_team",
          },
          ...(canApproveEmployeeDocuments(user) ||
          canApproveOrgRequests(user)
            ? [
                {
                  name: "Approvals",
                  link: reviewQueueHref("compliance"),
                  icon: ClipboardCheck,
                  moduleKey: "self_service_approvals",
                },
              ]
            : []),
          {
            name: "Scheduled reviews",
            link: myWorkspaceHref("reviews"),
            icon: ListChecks,
            moduleKey: "self_service_reviews",
          },
        ]
      : [remoteAccess];
    const filterRemote = (links: NavLink[]) => {
      if (!delegation?.isRemoteMode) return links;
      const allowed = new Set(delegation.moduleKeys);
      return links.filter((item) => {
        const key =
          item.moduleKey ?? NAV_MODULE_BY_NAME[item.name] ?? undefined;
        if (item.name === "Remote access") return false;
        if (key === null) return true;
        return key ? allowed.has(key) : false;
      });
    };
    return [
      { id: "primary", label: "Workspace", links: filterRemote(primary) },
      ...(selfService.length
        ? [
            {
              id: "self-service",
              label: "Self-Service",
              links: filterRemote(selfService),
            },
          ]
        : []),
      ...(admin.length
        ? [{ id: "admin", label: "Admin", links: filterRemote(admin) }]
        : []),
    ];
  }, [
    canEmployeeFiles,
    canOrgFiles,
    canTemplates,
    canSettings,
    isAppAdmin,
    currentUser.data,
    delegation?.isRemoteMode,
    delegation?.moduleKeys,
    pendingInvites,
  ]);

  const renderLink = (item: NavLink) => {
    const Icon = item.icon;
    const isActive =
      item.name === "Home"
        ? routePath.startsWith("/pages/dashboard") ||
          routePath.startsWith("/pages/activity")
        : item.name === "My Workspace"
          ? isWorkspacePath(routePath) &&
            !routePath.startsWith("/pages/my-compliance")
            : item.name === "Remote access"
              ? routePath.startsWith("/pages/remote-access")
              : item.name === "My Compliance"
            ? routePath.startsWith("/pages/my-compliance") ||
              (routePath.startsWith("/pages/my-workspace") &&
                routePath.includes("tab=compliance"))
            : item.name === "Employee Files"
            ? routePath.startsWith("/pages/employee") ||
              routePath.startsWith("/pages/compliance")
            : item.name === "Approval requests"
              ? routePath.startsWith("/pages/approvals") ||
                routePath.startsWith("/pages/organization/approvals")
              : item.name === "Organizational Files"
                ? routePath.startsWith("/pages/organization") &&
                  !routePath.includes("/templates-forms") &&
                  !routePath.includes("/approvals")
                : item.name === "Templates & Forms"
                  ? routePath.includes("/templates-forms")
                  : routePath.startsWith(item.link);
    return (
      <Link
        key={item.name}
        href={item.link}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
        className={`app-nav-link ${isActive ? "is-active" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex flex-1 items-center justify-between gap-2">
          <span>{item.name}</span>
          {item.badge ? (
            <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[10px] font-bold text-white">
              {item.badge}
            </span>
          ) : null}
        </span>
      </Link>
    );
  };

  return (
    <nav className="app-nav" aria-label="Application">
      <div className="app-nav-desktop">
        {groups.map((group, index) => (
          <div key={group.id} className="app-nav-cluster">
            {index > 0 ? <span className="app-nav-divider" aria-hidden /> : null}
            {group.links.map(renderLink)}
          </div>
        ))}
      </div>
      <div className="app-nav-mobile">
        <button
          type="button"
          className="app-nav-menu-btn"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Menu
        </button>
        {mobileOpen ? (
          <div className="app-nav-drawer">
            {groups.map((group) => (
              <div key={group.id} className="app-nav-drawer-group">
                <p>{group.label}</p>
                {group.links.map(renderLink)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
