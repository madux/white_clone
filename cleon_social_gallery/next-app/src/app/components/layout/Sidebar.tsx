"use client";

import {
  LayoutDashboard,
  Images,
  Grid3X3,
  Clock,
  Bot,
  Flag,
  Trash2,
  User,
  History,
  Copy,
  FileText,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { GalleryView } from "@/lib/types";

const SIDEBAR_COLLAPSED_KEY = "cleon-social-gallery-sidebar-collapsed";

interface SidebarProps {
  activeView: GalleryView;
  onNavigate: (view: GalleryView) => void;
  pendingCount: number;
  aiReviewCount?: number;
  flaggedCount?: number;
  isManager: boolean;
  isAdmin: boolean;
  mobileNav: boolean;
  onClose: () => void;
}

const BROWSE: Array<{ id: GalleryView; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { id: "albums", label: "Albums", icon: <Images size={17} /> },
  { id: "gallery", label: "Gallery", icon: <Grid3X3 size={17} /> },
];

const PERSONAL: Array<{ id: GalleryView; label: string; icon: React.ReactNode }> = [
  { id: "contributions", label: "My Contributions", icon: <User size={17} /> },
  { id: "upload-history", label: "Upload History", icon: <History size={17} /> },
];

const MODERATION: Array<{ id: GalleryView; label: string; icon: React.ReactNode; countKey?: "pending" | "ai" | "flagged" }> = [
  { id: "pending", label: "Pending Review", icon: <Clock size={17} />, countKey: "pending" },
  { id: "pending-ai", label: "AI Review", icon: <Bot size={17} />, countKey: "ai" },
  { id: "flagged", label: "Flagged Content", icon: <Flag size={17} />, countKey: "flagged" },
  { id: "recycle", label: "Recycle Bin", icon: <Trash2 size={17} /> },
  { id: "duplicates", label: "Duplicates", icon: <Copy size={17} /> },
  { id: "audit", label: "Audit Log", icon: <FileText size={17} /> },
];

export default function Sidebar({
  activeView, onNavigate, pendingCount, aiReviewCount = 0, flaggedCount = 0,
  isManager, isAdmin, mobileNav, onClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const counts = { pending: pendingCount, ai: aiReviewCount, flagged: flaggedCount };

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

  const renderLink = (item: { id: GalleryView; label: string; icon: React.ReactNode; countKey?: "pending" | "ai" | "flagged" }) => {
    const count = item.countKey ? counts[item.countKey] : 0;
    return (
      <button
        key={item.id}
        type="button"
        className={`sidebar-link ${activeView === item.id ? "active" : ""}`}
        onClick={() => onNavigate(item.id)}
        aria-current={activeView === item.id ? "page" : undefined}
        title={collapsed ? item.label : undefined}
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && count > 0 && (
          <span className={`nav-count ${item.countKey === "pending" ? "alert" : ""}`}>{count}</span>
        )}
      </button>
    );
  };

  const renderSection = (label: string, items: Array<{ id: GalleryView; label: string; icon: React.ReactNode; countKey?: "pending" | "ai" | "flagged" }>) => (
    <>
      {!collapsed && <div className="sidebar-section-label">{label}</div>}
      <nav className="sidebar-nav">{items.map(renderLink)}</nav>
    </>
  );

  return (
    <aside className={`gallery-sidebar ${mobileNav ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <div className={`sidebar-brand-row ${collapsed ? "is-collapsed" : ""}`}>
        {!collapsed && (
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
      </div>
      <button type="button" className="mobile-close" onClick={onClose} aria-label="Close navigation">
        <X size={18} />
      </button>

      {renderSection("Browse", BROWSE)}
      {renderSection("Personal", PERSONAL)}

      {isManager && renderSection("Moderation", MODERATION)}

      {isAdmin && (
        <>
          {!collapsed && <div className="sidebar-section-label">Admin</div>}
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-link ${activeView === "settings" ? "active" : ""}`}
              onClick={() => onNavigate("settings")}
              aria-current={activeView === "settings" ? "page" : undefined}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings size={17} />
              {!collapsed && <span>Settings</span>}
            </button>
          </nav>
        </>
      )}
    </aside>
  );
}
