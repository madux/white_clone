"use client";

import { ChevronRight, Menu, Search } from "lucide-react";
import { initials } from "../galleryUtils";

export function GalleryHeader({
  pageTitle,
  search,
  userName,
  searchPlaceholder = "Search albums and media",
  onSearch,
  onOpenMobileNav,
}: {
  pageTitle: string;
  search: string;
  userName?: string;
  searchPlaceholder?: string;
  onSearch: (value: string) => void;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="gallery-header">
      <button
        type="button"
        className="mobile-menu"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      <div className="header-wordmark">
        Cleon<span>HR</span>
      </div>
      <div className="breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={14} />
        <strong>{pageTitle}</strong>
      </div>
      <div className="header-actions">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
        <div className="header-avatar">{initials(userName || "Social Gallery")}</div>
      </div>
    </header>
  );
}
