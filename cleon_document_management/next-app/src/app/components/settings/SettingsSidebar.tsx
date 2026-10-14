"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSidebarItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

export type SettingsSidebarGroup = {
  title: string;
  items: SettingsSidebarItem[];
};

type SettingsSidebarProps = {
  groups: SettingsSidebarGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  activeEmphasis?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export default function SettingsSidebar({
  groups,
  activeId,
  onSelect,
  search,
  onSearchChange,
  activeEmphasis,
  collapsed = false,
  onCollapsedChange,
}: SettingsSidebarProps) {
  const visibleGroups = useMemo(
    () => groups.filter((group) => group.items.length > 0),
    [groups],
  );
  const flatItems = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );
  const hasItems = flatItems.length > 0;

  const renderNavButton = (
    item: SettingsSidebarItem,
    compact: boolean,
  ) => {
    const active = item.id === activeId;
    const emphasize = active && activeEmphasis;
    const Icon = item.icon;

    if (compact) {
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          aria-current={active ? "page" : undefined}
          aria-label={item.label}
          title={item.label}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            active
              ? "bg-pink-50 text-brand-pink ring-1 ring-pink-200"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {Icon ? (
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <span className="text-xs font-bold">
              {item.label.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
      );
    }

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
            active
              ? "font-semibold text-slate-900 before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-pink"
              : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            emphasize ? "bg-pink-50/80" : active ? "bg-slate-100" : "",
          )}
        >
          {item.label}
        </button>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "shrink-0 transition-[width] duration-200 ease-out lg:sticky lg:top-6 lg:self-start",
        collapsed ? "w-full lg:w-[3.25rem]" : "w-full lg:w-[220px]",
      )}
      aria-label="Settings navigation"
    >
      <div
        className={cn(
          "mb-4 flex items-center gap-2",
          collapsed ? "lg:justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <p className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">
            Settings
          </p>
        ) : null}
        {onCollapsedChange ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 lg:inline-flex"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand settings menu" : "Collapse settings menu"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <>
          <label className="sr-only" htmlFor="settings-find">
            Find a setting
          </label>
          <input
            id="settings-find"
            type="search"
            placeholder="Find a setting"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="mb-5 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-100"
          />
        </>
      ) : null}

      {!hasItems ? (
        !collapsed ? (
          <p className="px-3 text-sm text-slate-500">No matching settings.</p>
        ) : null
      ) : collapsed ? (
        <nav className="hidden flex-col items-center gap-1 lg:flex">
          {flatItems.map((item) => renderNavButton(item, true))}
        </nav>
      ) : (
        <nav className="flex flex-col gap-6">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1 px-3 text-xs font-semibold text-slate-500">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => renderNavButton(item, false))}
              </ul>
            </div>
          ))}
        </nav>
      )}

      {collapsed ? (
        <nav className="flex flex-col gap-6 lg:hidden">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1 px-3 text-xs font-semibold text-slate-500">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => renderNavButton(item, false))}
              </ul>
            </div>
          ))}
        </nav>
      ) : null}
    </aside>
  );
}
