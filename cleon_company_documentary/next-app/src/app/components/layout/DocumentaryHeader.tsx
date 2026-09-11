"use client";

import { ChevronRight, Menu, Search } from "lucide-react";
import { BackButton } from "../BackButton";
import { initials } from "../documentaryUtils";

export function DocumentaryHeader({
  pageTitle,
  search,
  userName,
  companyName,
  onSearch,
  onOpenMobileNav,
}: {
  pageTitle: string;
  search: string;
  userName?: string;
  companyName?: string;
  onSearch: (value: string) => void;
  onOpenMobileNav: () => void;
}) {
  const avatarInitials = initials(userName || "CD");

  return (
    <header className="mx-auto w-full max-w-[1650px] rounded-2xl border border-slate-200 bg-white px-6 py-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <button
            type="button"
            className="mobile-menu inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-pink-200 hover:text-brand-pink"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <BackButton variant="header" />
          <div className="header-wordmark shrink-0">
            Cleon<span>HR</span>
          </div>
          <div className="header-breadcrumb hidden min-w-0 items-center gap-2 text-xs text-slate-400 lg:flex">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong className="truncate font-semibold text-slate-600">
              {pageTitle}
            </strong>
          </div>
          <div className="relative min-w-0 flex-1 sm:max-w-[430px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search videos and folders"
              className="w-full rounded-2xl border border-transparent bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-brand-pink/30 focus:ring-4 focus:ring-brand-pink/10"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden h-4 w-px bg-slate-200 sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="header-user-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-pink text-xs font-semibold text-white shadow-sm ring-2 ring-white">
              {avatarInitials}
            </div>
            {userName ? (
              <div className="hidden flex-col sm:flex">
                <span className="text-sm font-semibold text-slate-800">
                  {userName}
                </span>
                {companyName ? (
                  <span className="-mt-0.5 text-[10px] font-medium text-slate-400">
                    {companyName}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
