"use client";

import { ChevronRight, Menu, Search } from "lucide-react";
import { initials } from "../documentaryUtils";

export function DocumentaryHeader({ pageTitle, search, userName, onSearch, onOpenMobileNav }: { pageTitle: string; search: string; userName?: string; onSearch: (value: string) => void; onOpenMobileNav: () => void }) {
  return <header className="documentary-header"><button className="mobile-menu" onClick={onOpenMobileNav} aria-label="Open navigation"><Menu size={20} /></button><div className="header-wordmark">Cleon<span>HR</span></div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{pageTitle}</strong></div><div className="header-actions"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search videos and folders" /></label><div className="header-avatar">{initials(userName || "CD")}</div></div></header>;
}
