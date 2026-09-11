"use client";

import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Folder,
  Home,
  Library,
  Recycle,
  Settings2,
  Star,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { DocumentaryFolder } from "../../../../lib/types";
import type { LibraryView } from "../library/libraryTypes";

const SIDEBAR_COLLAPSED_KEY = "cleon-documentary-sidebar-collapsed";

export function DocumentarySidebar({
  folders,
  selectedFolder,
  libraryView,
  mediaCount,
  pendingCount,
  canManage,
  isAdmin,
  mobileNav,
  onNavigate,
  onOpenFolder,
  onAnalytics,
  onSettings,
  onClose,
}: {
  folders: DocumentaryFolder[];
  selectedFolder: DocumentaryFolder | null;
  libraryView: LibraryView;
  mediaCount: number;
  pendingCount: number;
  canManage: boolean;
  isAdmin: boolean;
  mobileNav: boolean;
  onNavigate: (view: LibraryView) => void;
  onOpenFolder: (folder: DocumentaryFolder) => void;
  onAnalytics: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pinned = folders.filter((folder) => folder.is_pinned);
  const otherFolders = folders.filter((folder) => !folder.is_pinned);

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

  const renderLink = (
    label: string,
    icon: ReactNode,
    active: boolean,
    onClick: () => void,
    count?: ReactNode,
  ) => (
    <button
      type="button"
      className={`sidebar-link ${active ? "active" : ""}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
      {!collapsed && count}
    </button>
  );

  return (
    <aside
      className={`documentary-sidebar ${mobileNav ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}
    >
      <div className={`sidebar-brand-row ${collapsed ? "is-collapsed" : ""}`}>
        {!collapsed && (
          <div className="brand-lockup">
            <span className="directory-brand">Company Documentary</span>
          </div>
        )}
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <button
        className="mobile-close"
        onClick={onClose}
        aria-label="Close navigation"
      >
        <X size={18} />
      </button>
      {!collapsed && <div className="sidebar-section-label">Workspace</div>}
      <nav className="sidebar-nav">
        {renderLink(
          "Documentary home",
          <Home size={17} />,
          libraryView === "home" && !selectedFolder,
          () => onNavigate("home"),
        )}
        {renderLink(
          "All videos",
          <Library size={17} />,
          libraryView === "all",
          () => onNavigate("all"),
          <span className="nav-count">{mediaCount}</span>,
        )}
        {renderLink(
          "Favorites",
          <Star size={17} />,
          libraryView === "favorites",
          () => onNavigate("favorites"),
        )}
        {renderLink(
          "Continue watching",
          <Clock3 size={17} />,
          libraryView === "recent",
          () => onNavigate("recent"),
        )}
        {canManage && (
          <>
            {renderLink(
              "Pending review",
              <CheckCircle2 size={17} />,
              libraryView === "approvals",
              () => onNavigate("approvals"),
              pendingCount > 0 ? (
                <span className="nav-count alert">{pendingCount}</span>
              ) : undefined,
            )}
            {renderLink(
              "Recycle bin",
              <Recycle size={17} />,
              libraryView === "recycle",
              () => onNavigate("recycle"),
            )}
          </>
        )}
      </nav>
      {!collapsed && (
        <div className="sidebar-section-label folder-label">
          Folders <span>{folders.length}</span>
        </div>
      )}
      <div className="sidebar-folder-list scrollable">
        {pinned.map((folder) => (
          <button
            key={folder.id}
            className={`sidebar-link pinned ${selectedFolder?.id === folder.id ? "selected" : ""}`}
            onClick={() => onOpenFolder(folder)}
            title={collapsed ? folder.name : undefined}
          >
            <Star size={14} fill="currentColor" />
            {!collapsed && <span>{folder.name}</span>}
          </button>
        ))}
        {otherFolders.map((folder) => (
          <button
            key={folder.id}
            className={`sidebar-link ${selectedFolder?.id === folder.id ? "selected" : ""}`}
            onClick={() => onOpenFolder(folder)}
            title={collapsed ? folder.name : undefined}
          >
            <Folder size={16} />
            {!collapsed && <span>{folder.name}</span>}
          </button>
        ))}
        {!folders.length && !collapsed && (
          <p className="sidebar-empty">Your folders will appear here.</p>
        )}
      </div>
      <div className="sidebar-bottom">
        {canManage && (
          <>
            {renderLink(
              "Library analytics",
              <BarChart3 size={17} />,
              false,
              onAnalytics,
            )}
            {isAdmin &&
              renderLink(
                "Settings",
                <Settings2 size={17} />,
                false,
                onSettings,
              )}
          </>
        )}
      </div>
    </aside>
  );
}
