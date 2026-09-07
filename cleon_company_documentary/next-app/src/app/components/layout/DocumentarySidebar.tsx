"use client";

import { BarChart3, Clock3, Folder, Home, Library, MoreVertical, Settings2, Star, X } from "lucide-react";
import type { DocumentaryFolder } from "../../../../lib/types";
import type { LibraryView } from "../library/libraryTypes";
import { initials } from "../documentaryUtils";

export function DocumentarySidebar({
  folders,
  selectedFolder,
  libraryView,
  mediaCount,
  canManage,
  isAdmin,
  mobileNav,
  userName,
  companyName,
  onNavigate,
  onOpenFolder,
  onAnalytics,
  onStorage,
  onClose,
}: {
  folders: DocumentaryFolder[];
  selectedFolder: DocumentaryFolder | null;
  libraryView: LibraryView;
  mediaCount: number;
  canManage: boolean;
  isAdmin: boolean;
  mobileNav: boolean;
  userName?: string;
  companyName?: string;
  onNavigate: (view: LibraryView) => void;
  onOpenFolder: (folder: DocumentaryFolder) => void;
  onAnalytics: () => void;
  onStorage: () => void;
  onClose: () => void;
}) {
  return <aside className={`documentary-sidebar ${mobileNav ? "is-open" : ""}`}>
    <div className="brand-lockup"><span className="directory-brand">Company Directory</span></div>
    <button className="mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
    <div className="sidebar-section-label">Workspace</div>
    <nav className="sidebar-nav">
      <button className={`sidebar-link ${libraryView === "home" && !selectedFolder ? "active" : ""}`} onClick={() => onNavigate("home")}><Home size={17} /><span>Documentary home</span></button>
      <button className={`sidebar-link ${libraryView === "all" ? "active" : ""}`} onClick={() => onNavigate("all")}><Library size={17} /><span>All videos</span><span className="nav-count">{mediaCount}</span></button>
      <button className={`sidebar-link ${libraryView === "favorites" ? "active" : ""}`} onClick={() => onNavigate("favorites")}><Star size={17} /><span>Favorites</span></button>
      <button className={`sidebar-link ${libraryView === "recent" ? "active" : ""}`} onClick={() => onNavigate("recent")}><Clock3 size={17} /><span>Recently watched</span></button>
    </nav>
    <div className="sidebar-section-label folder-label">Folders <span>{folders.length}</span></div>
    <div className="sidebar-folder-list">{folders.slice(0, 6).map((folder) => <button key={folder.id} className={`sidebar-link ${selectedFolder?.id === folder.id ? "selected" : ""}`} onClick={() => onOpenFolder(folder)}><Folder size={16} /><span>{folder.name}</span></button>)}{!folders.length && <p className="sidebar-empty">Your folders will appear here.</p>}</div>
    <div className="sidebar-bottom">{canManage && <><button className="sidebar-link" onClick={onAnalytics}><BarChart3 size={17} /><span>Library analytics</span></button>{isAdmin && <button className="sidebar-link" onClick={onStorage}><Settings2 size={17} /><span>Storage settings</span></button>}</>}<div className="profile-chip"><div className="avatar">{initials(userName || "Company Documentary")}</div><div className="profile-copy"><strong>{userName || "Your workspace"}</strong><span>{companyName || "Company library"}</span></div><MoreVertical size={16} className="muted-icon" /></div></div>
  </aside>;
}
