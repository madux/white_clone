"use client";

import { ChevronRight, Menu, Search } from "lucide-react";
import { BackButton } from "../shared/BackButton";
import { initials } from "../galleryUtils";

export function GalleryHeader({
  pageTitle,
  search,
  userName,
  companyName,
  searchPlaceholder = "Search albums and media",
  onSearch,
  onOpenMobileNav,
  hideSearch = false,
}: {
  pageTitle: string;
  search: string;
  userName?: string;
  companyName?: string;
  searchPlaceholder?: string;
  onSearch: (value: string) => void;
  onOpenMobileNav: () => void;
  hideSearch?: boolean;
}) {
  const avatarInitials = initials(userName || "Social Gallery");

  return (
    <header className="gallery-app-header">
      <div className="gallery-header-primary">
        <div className="gallery-header-nav">
          <button
            type="button"
            className="mobile-menu"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <BackButton variant="header" />
          <div className="header-wordmark gallery-header-wordmark">
            Cleon<span>HR</span>
          </div>
          <div className="header-breadcrumb gallery-header-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} aria-hidden />
            <strong title={pageTitle}>{pageTitle}</strong>
          </div>
        </div>
        <div className="gallery-header-user">
          <div className="header-user-avatar" aria-hidden>
            {avatarInitials}
          </div>
          {userName ? (
            <div className="gallery-header-user-text">
              <span className="gallery-header-user-name">{userName}</span>
              {companyName ? (
                <span className="gallery-header-user-company">{companyName}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <p className="gallery-header-mobile-title" title={pageTitle}>
        {pageTitle}
      </p>

      {!hideSearch && (
        <label className="gallery-header-search">
          <Search size={18} className="gallery-header-search-icon" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </label>
      )}
    </header>
  );
}
