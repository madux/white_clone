"use client";

import {
  LayoutDashboard,
  Images,
  Grid3X3,
  Clock,
  Trash2,
  User,
  History,
  FileText,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GalleryView } from "@/lib/types";
import type { GalleryRoleTier } from "@/lib/galleryRoleTiers";
import { canAccessGalleryView } from "@/lib/galleryAccess";

const SIDEBAR_COLLAPSED_KEY = "cleon-social-gallery-sidebar-collapsed";

interface SidebarProps {
  activeView: GalleryView;
  onNavigate: (view: GalleryView) => void;
  pendingCount: number;
  roleTier: GalleryRoleTier;
  mobileNav: boolean;
  onClose: () => void;
}

const BROWSE: Array<{ id: GalleryView; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { id: "albums", label: "Albums", icon: <Images size={17} /> },
  { id: "gallery", label: "Gallery", icon: <Grid3X3 size={17} /> },
];

const PERSONAL_EMPLOYEE: Array<{ id: GalleryView; label: string; icon: React.ReactNode }> = [
  { id: "contributions", label: "My Contributions", icon: <User size={17} /> },
  { id: "upload-history", label: "Upload History", icon: <History size={17} /> },
];

const MODERATION: Array<{ id: GalleryView; label: string; icon: React.ReactNode; countKey?: "pending" }> = [
  { id: "pending", label: "Pending Review", icon: <Clock size={17} />, countKey: "pending" },
  { id: "recycle", label: "Recycle Bin", icon: <Trash2 size={17} /> },
];

export default function Sidebar({
  activeView, onNavigate, pendingCount,
  roleTier, mobileNav, onClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const counts = { pending: pendingCount };

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

  const renderLink = (item: { id: GalleryView; label: string; icon: React.ReactNode; countKey?: "pending" }) => {
    const count = item.countKey ? counts[item.countKey] : 0;
    return (
      <button
        key={item.id}
        type="button"
        className={`sidebar-link ${activeView === item.id ? "active" : ""}`}
        onClick={() => onNavigate(item.id)}
        aria-current={activeView === item.id ? "page" : undefined}
        title={effectiveCollapsed ? item.label : undefined}
      >
        {item.icon}
        {!effectiveCollapsed && <span>{item.label}</span>}
        {!effectiveCollapsed && count > 0 && (
          <span className={`nav-count ${item.countKey === "pending" ? "alert" : ""}`}>{count}</span>
        )}
      </button>
    );
  };

  const renderSection = (label: string, items: Array<{ id: GalleryView; label: string; icon: React.ReactNode; countKey?: "pending" }>) => (
    <>
      {!effectiveCollapsed && <div className="sidebar-section-label">{label}</div>}
      <nav className="sidebar-nav">{items.map(renderLink)}</nav>
    </>
  );

  const browseItems = useMemo(
    () => BROWSE.filter((item) => canAccessGalleryView(roleTier, item.id)),
    [roleTier],
  );

  const moderationItems = useMemo(
    () => MODERATION.filter((item) => canAccessGalleryView(roleTier, item.id)),
    [roleTier],
  );

  const showUploadHistoryInWorkspace = roleTier !== "employee"
    && canAccessGalleryView(roleTier, "upload-history");

  const effectiveCollapsed = collapsed && !mobileNav;
  const showBrand = !effectiveCollapsed;

  return (
    <aside className={`gallery-sidebar ${mobileNav ? "is-open" : ""} ${effectiveCollapsed ? "is-collapsed" : ""}`}>
      <div className={`sidebar-brand-row ${effectiveCollapsed ? "is-collapsed" : ""}`}>
        {showBrand && (
          <div className="brand-lockup">
            <span className="directory-brand">Social Gallery</span>
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
        <button
          type="button"
          className="sidebar-mobile-dismiss"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {browseItems.length > 0 && renderSection("Browse", browseItems)}
      {roleTier === "employee" && renderSection("Personal", PERSONAL_EMPLOYEE)}
      {showUploadHistoryInWorkspace && (
        <nav className="sidebar-nav">
          {renderLink({ id: "upload-history", label: "Upload History", icon: <History size={17} /> })}
        </nav>
      )}

      {moderationItems.length > 0 && renderSection("Moderation", moderationItems)}

      {roleTier === "administrator" && (
        <>
          {!effectiveCollapsed && <div className="sidebar-section-label">Admin</div>}
          <nav className="sidebar-nav">
            {canAccessGalleryView(roleTier, "audit") && (
              <button
                type="button"
                className={`sidebar-link ${activeView === "audit" ? "active" : ""}`}
                onClick={() => onNavigate("audit")}
                aria-current={activeView === "audit" ? "page" : undefined}
                title={effectiveCollapsed ? "Audit Log" : undefined}
              >
                <FileText size={17} />
                {!effectiveCollapsed && <span>Audit Log</span>}
              </button>
            )}
            {canAccessGalleryView(roleTier, "settings") && (
              <button
                type="button"
                className={`sidebar-link ${activeView === "settings" ? "active" : ""}`}
                onClick={() => onNavigate("settings")}
                aria-current={activeView === "settings" ? "page" : undefined}
                title={effectiveCollapsed ? "Settings" : undefined}
              >
                <Settings size={17} />
                {!effectiveCollapsed && <span>Settings</span>}
              </button>
            )}
          </nav>
        </>
      )}
    </aside>
  );
}
