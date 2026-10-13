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
  History,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  canAccessDmsSettings,
  canViewComplianceModule,
  canViewTemplatesModule,
} from "../../../lib/dmsAccess";
import {
  canAccessEmployeeFilesAdmin,
  canApproveEmployeeDocuments,
} from "../../../lib/employeeFilesAccess";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";
import { canApproveOrgRequests } from "../../../lib/organizationalFilesAccess";
import { reviewQueueHref } from "../../../lib/reviewQueue";
import { isWorkspacePath, myWorkspaceHref } from "../../../lib/workspaceRoutes";
import { canViewAuditTrail } from "../../../lib/dmsAccess";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { useTenantModules } from "../../../hooks/useTenantModules";
import {
  isNavModuleEnabled,
  isTenantModuleEnabled,
} from "../../../lib/tenantModuleCatalog";
import { useWorkspaceDelegationOptional } from "../../../lib/workspaceDelegation";

type NavLink = {
  name: string;
  link: string;
  icon: any;
  moduleKey?: string | null;
  badge?: number;
  iconOnly?: boolean;
};
type NavGroup = { id: string; label: string; links: NavLink[] };

const NAV_MODULE_BY_NAME: Record<string, string | null> = {
  Home: "home",
  "My Workspace": "my_workspace",
  "Employee Files": "employee_files",
  "Organizational Files": "organizational_files",
  "Templates & Forms": "templates_forms",
  "Document Intelligence": "document_intelligence",
  Compliance: "compliance_admin",
  "My Compliance": "self_service_compliance",
  "My Team": "self_service_team",
  Approvals: "self_service_approvals",
  "Scheduled reviews": "self_service_reviews",
  Settings: "settings",
};

export default function Sidebar() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const delegation = useWorkspaceDelegationOptional();
  const pendingInvites =
    currentUser.data?.workspace_access?.pending_invite_count ?? 0;
  const canSettings = canAccessDmsSettings(currentUser.data);
  const canCompliance = canViewComplianceModule(currentUser.data);
  const canTemplates = canViewTemplatesModule(currentUser.data);
  const canEmployeeFiles = canAccessEmployeeFilesAdmin(currentUser.data);
  const canOrgFiles = canAccessOrgLibrary(currentUser.data);
  const canAuditTrail = canViewAuditTrail(currentUser.data);
  const { modules: tenantModules } = useTenantModules();
  const [mobileOpen, setMobileOpen] = useState(false);
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";

  const groups: NavGroup[] = useMemo(() => {
    const showHome = canEmployeeFiles || (!canEmployeeFiles && !canOrgFiles);
    const myWorkspace: NavLink = {
      name: "My Workspace",
      link: "/pages/my-workspace",
      icon: Briefcase,
      badge: pendingInvites > 0 ? pendingInvites : undefined,
    };
    const documentIntelligence: NavLink = {
      name: "Document Intelligence",
      link: "/pages/document-intelligence",
      icon: Brain,
      moduleKey: "document_intelligence",
    };
    const primary: NavLink[] = [
      ...(showHome
        ? [{ name: "Home", link: "/pages/dashboard", icon: LayoutDashboard }]
        : []),
      myWorkspace,
      ...(canEmployeeFiles && isTenantModuleEnabled(tenantModules, "employee_files")
        ? [{ name: "Employee Files", link: "/pages/employee", icon: Users }]
        : []),
      ...(canOrgFiles && isTenantModuleEnabled(tenantModules, "organizational_files")
        ? [
            {
              name: "Organizational Files",
              link: "/pages/organization",
              icon: Building2,
            },
            ...(canTemplates &&
            isTenantModuleEnabled(tenantModules, "templates_forms")
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
      ...(canCompliance && isTenantModuleEnabled(tenantModules, "compliance")
        ? [
            {
              name: "Compliance",
              link: "/pages/compliance",
              icon: ShieldCheck,
              moduleKey: "compliance_admin",
            },
          ]
        : []),
      ...(isTenantModuleEnabled(tenantModules, "document_intelligence")
        ? [documentIntelligence]
        : []),
    ];
    const admin: NavLink[] = [
      ...(canSettings
        ? [
            {
              name: "Settings",
              link: "/pages/settings",
              icon: Settings,
              iconOnly: true,
            },
          ]
        : []),
      ...(canAuditTrail && isTenantModuleEnabled(tenantModules, "audit_trail")
        ? [
            {
              name: "Audit Trail",
              link: "/pages/audit-trail",
              icon: History,
              moduleKey: "audit_trail",
            },
          ]
        : []),
    ];
    const user = currentUser.data;
    const showSelfService =
      !canEmployeeFiles || user?.is_document_manager !== true;
    const selfService: NavLink[] = showSelfService
      ? [
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
          ...(isTenantModuleEnabled(tenantModules, "approval_workflow") &&
          (canApproveEmployeeDocuments(user) || canApproveOrgRequests(user))
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
      : [];
    const filterNavLinks = (links: NavLink[]) => {
      const tenantFiltered = links.filter((item) => {
        const key =
          item.moduleKey ?? NAV_MODULE_BY_NAME[item.name] ?? undefined;
        if (key === null || key === undefined) return true;
        return isNavModuleEnabled(tenantModules, key);
      });
      if (!delegation?.isRemoteMode) return tenantFiltered;
      const allowed = new Set(delegation.moduleKeys);
      return tenantFiltered.filter((item) => {
        const key =
          item.moduleKey ?? NAV_MODULE_BY_NAME[item.name] ?? undefined;
        if (key === null) return true;
        return key ? allowed.has(key) : false;
      });
    };
    return [
      { id: "primary", label: "Workspace", links: filterNavLinks(primary) },
      ...(selfService.length
        ? [
            {
              id: "self-service",
              label: "Self-Service",
              links: filterNavLinks(selfService),
            },
          ]
        : []),
      ...(admin.length
        ? [{ id: "admin", label: "Admin", links: filterNavLinks(admin) }]
        : []),
    ];
  }, [
    canEmployeeFiles,
    canOrgFiles,
    canTemplates,
    canSettings,
    canCompliance,
    canAuditTrail,
    currentUser.data,
    delegation?.isRemoteMode,
    delegation?.moduleKeys,
    pendingInvites,
    tenantModules,
  ]);

  const renderLink = (item: NavLink, options?: { showLabel?: boolean }) => {
    const Icon = item.icon;
    const showLabel = options?.showLabel ?? !item.iconOnly;
    const isActive =
      item.name === "Home"
        ? routePath.startsWith("/pages/dashboard") ||
          routePath.startsWith("/pages/activity")
        : item.name === "My Workspace"
          ? isWorkspacePath(routePath) &&
            !routePath.startsWith("/pages/my-compliance")
          : item.name === "Compliance"
            ? routePath.startsWith("/pages/compliance")
            : item.name === "My Compliance"
            ? routePath.startsWith("/pages/my-compliance") ||
              (routePath.startsWith("/pages/my-workspace") &&
                routePath.includes("tab=compliance"))
            : item.name === "Employee Files"
            ? routePath.startsWith("/pages/employee")
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
        aria-label={!showLabel ? item.name : undefined}
        title={!showLabel ? item.name : undefined}
        onClick={() => setMobileOpen(false)}
        className={`app-nav-link ${item.iconOnly && !showLabel ? "is-icon-only" : ""} ${isActive ? "is-active" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {showLabel ? (
          <span className="flex flex-1 items-center justify-between gap-2">
            <span>{item.name}</span>
            {item.badge ? (
              <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav className="app-nav" aria-label="Application">
      <div className="app-nav-desktop">
        {groups.map((group, index) => (
          <div key={group.id} className="app-nav-cluster">
            {index > 0 ? <span className="app-nav-divider" aria-hidden /> : null}
            {group.links.map((item) => renderLink(item))}
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
                {group.links.map((item) => renderLink(item, { showLabel: true }))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
