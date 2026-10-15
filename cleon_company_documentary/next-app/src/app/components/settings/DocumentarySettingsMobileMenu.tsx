"use client";

import { ChevronRight, Search } from "lucide-react";
import type { DocumentarySettingsSidebarGroup } from "./DocumentarySettingsSidebar";

type DocumentarySettingsMobileMenuProps = {
  groups: DocumentarySettingsSidebarGroup[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
};

export function DocumentarySettingsMobileMenu({
  groups,
  search,
  onSearchChange,
  onSelect,
}: DocumentarySettingsMobileMenuProps) {
  const hasItems = groups.some((group) => group.items.length > 0);

  return (
    <div className="documentary-settings-mobile-menu">
      <label className="sr-only" htmlFor="documentary-settings-find-mobile">
        Find a setting
      </label>
      <div className="documentary-settings-mobile-search">
        <Search size={16} aria-hidden />
        <input
          id="documentary-settings-find-mobile"
          type="search"
          placeholder="Find a setting"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {!hasItems ? (
        <p className="documentary-settings-mobile-empty">No matching settings.</p>
      ) : (
        <nav className="documentary-settings-mobile-groups" aria-label="Settings sections">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.title} className="documentary-settings-mobile-group">
                <h2>{group.title}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onSelect(item.id)}>
                        <span className="documentary-settings-mobile-row-label">{item.label}</span>
                        <ChevronRight size={18} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
