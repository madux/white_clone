"use client";
import {
  Activity,
  Archive,
  ArchiveRestore,
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  Users,
  Trash2,
  Pin,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";

type Links = { name: string; link: string; icon: any };

const SIDEBAR_COLLAPSED_KEY = "cleon-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser.data?.is_document_manager === true;
  const [collapsed, setCollapsed] = useState(false);
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const coreLinks: Links[] = [
    { name: "Dashboard", link: "/pages/dashboard", icon: LayoutDashboard },
    { name: "Activity", link: "/pages/activity", icon: Activity },
    { name: "Employee Files", link: "/pages/employee", icon: Users },
    {
      name: "Organizational Files",
      link: "/pages/organization",
      icon: Building2,
    },
    {
      name: "Pending Uploads",
      link: "/pages/pending-uploads",
      icon: Clock3,
    },
  ];

  const intelligenceLinks: Links[] = [
    {
      name: "Document Intelligence",
      link: "/pages/document-intelligence",
      icon: Brain,
    },
    { name: "Settings", link: "/pages/settings", icon: Settings },
  ];

  const workspaceLinks: Links[] = [
    ...(!isAdmin
      ? [{ name: "Dashboard", link: "/pages/dashboard", icon: LayoutDashboard }]
      : []),
    { name: "My Documents", link: "/pages/my-documents", icon: Archive },
    ...(!isAdmin
      ? [{ name: "My Compliance", link: "/pages/my-compliance", icon: ShieldCheck }]
      : []),
    { name: "Quick Access", link: "/pages/quick-access", icon: Pin },
    { name: "Archived", link: "/pages/archived", icon: ArchiveRestore },
    { name: "Recycle Bin", link: "/pages/recycle-bin", icon: Trash2 },
  ];

  const renderLinks = (links: Links[]) =>
    links.map((l) => {
      const Icon = l.icon;
      const isActive =
        l.name === "Dashboard"
          ? routePath.startsWith("/pages/dashboard")
          : routePath.startsWith(l.link);
      return (
        <Link
          key={l.name}
          href={l.link}
          aria-current={isActive ? "page" : undefined}
          title={collapsed ? l.name : undefined}
          className={`group flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            isActive
              ? "bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-lg shadow-pink-200"
              : "text-slate-500 hover:translate-x-0.5 hover:bg-pink-50/80 hover:text-brand-text"
          } ${collapsed ? "justify-center px-2.5" : ""}`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{l.name}</span>}
        </Link>
      );
    });

  return (
    <aside
      className={`doc-sidebar flex h-full shrink-0 border-r border-slate-200 bg-white p-2 transition-all duration-200 ${
        collapsed ? "is-collapsed w-[4.5rem]" : "w-52 md:w-56 lg:w-60"
      }`}
    >
      <div className="flex w-full flex-col gap-5">
        <div className={`sidebar-brand-row ${collapsed ? "is-collapsed" : ""}`}>
          {!collapsed && (
            <div className="brand-lockup">
              <span className="directory-brand">Document Management</span>
              <span className="directory-brand-sub">
                {isAdmin ? "Intelligence Engine" : "Employee workspace"}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="sidebar-collapse-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
            {!collapsed && (
              <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Core
              </span>
            )}
            <div className="flex flex-col gap-1">{renderLinks(coreLinks)}</div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
          {!collapsed && (
            <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              My workspace
            </span>
          )}
          <div className="flex flex-col gap-1">{renderLinks(workspaceLinks)}</div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
          {!collapsed && (
            <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Intelligence
            </span>
          )}
          <div className="flex flex-col gap-1">
            {renderLinks(
              intelligenceLinks.filter((l) => l.name !== "Settings" || isAdmin),
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
