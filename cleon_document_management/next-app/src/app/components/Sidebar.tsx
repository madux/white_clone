"use client";
import {
  Brain,
  Building2,
  FileStack,
  LayoutDashboard,
  Menu,
  Users,
  Settings,
  Briefcase,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { canAccessEmployeeFilesAdmin } from "../../../lib/employeeFilesAccess";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";
import { isWorkspacePath } from "../../../lib/workspaceRoutes";
import { useCurrentUser } from "../../../hooks/useDocuments";

type NavLink = { name: string; link: string; icon: any };
type NavGroup = { id: string; label: string; links: NavLink[] };

export default function Sidebar() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const isDocAdmin = currentUser.data?.is_document_admin === true;
  const isAppAdmin =
    isDocAdmin || currentUser.data?.is_admin === true;
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
            {
              name: "Templates & Forms",
              link: "/pages/organization/templates-forms",
              icon: FileStack,
            },
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
    const admin: NavLink[] = isDocAdmin
      ? [{ name: "Settings", link: "/pages/settings", icon: Settings }]
      : [];
    return [
      { id: "primary", label: "Workspace", links: primary },
      ...(admin.length ? [{ id: "admin", label: "Admin", links: admin }] : []),
    ];
  }, [canEmployeeFiles, canOrgFiles, isAppAdmin, isDocAdmin]);

  const renderLink = (item: NavLink) => {
    const Icon = item.icon;
    const isActive =
      item.name === "Home"
        ? routePath.startsWith("/pages/dashboard") ||
          routePath.startsWith("/pages/activity")
        : item.name === "My Workspace"
          ? isWorkspacePath(routePath)
        : item.name === "Employee Files"
          ? routePath.startsWith("/pages/employee") ||
            routePath.startsWith("/pages/compliance")
          : item.name === "Organizational Files"
            ? routePath.startsWith("/pages/organization") &&
              !routePath.includes("/templates-forms")
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
        <span>{item.name}</span>
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
