"use client";

export type DocumentarySettingsSidebarItem = {
  id: string;
  label: string;
};

export type DocumentarySettingsSidebarGroup = {
  title: string;
  items: DocumentarySettingsSidebarItem[];
};

type DocumentarySettingsSidebarProps = {
  groups: DocumentarySettingsSidebarGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
};

export function DocumentarySettingsSidebar({
  groups,
  activeId,
  onSelect,
  search,
  onSearchChange,
}: DocumentarySettingsSidebarProps) {
  const hasItems = groups.some((group) => group.items.length > 0);

  return (
    <aside
      className="w-full shrink-0 lg:w-[220px] lg:sticky lg:top-0 lg:self-start"
      aria-label="Settings navigation"
    >
      <label className="sr-only" htmlFor="documentary-settings-find">
        Find a setting
      </label>
      <input
        id="documentary-settings-find"
        type="search"
        placeholder="Find a setting"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="mb-5 w-full rounded-md border border-[#e8e4ea] bg-white px-3 py-1.5 text-[0.875rem] text-[#181a36] placeholder:text-[#94a3b8] focus:border-[#d8d2dc] focus:outline-none focus:ring-2 focus:ring-pink-100"
      />

      {!hasItems ? (
        <p className="px-3 text-[0.875rem] text-[var(--muted-foreground)]">No matching settings.</p>
      ) : (
        <nav className="flex flex-col gap-6">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.title}>
                <p className="mb-1 px-3 text-[0.75rem] font-semibold text-[#5c5666]">{group.title}</p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = item.id === activeId;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(item.id)}
                          aria-current={active ? "page" : undefined}
                          className={[
                            "relative w-full rounded-md px-3 py-1.5 text-left text-[0.875rem] transition-colors",
                            active
                              ? "bg-pink-50/80 font-semibold text-[#181a36] before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-pink"
                              : "font-medium text-[#5c5666] hover:bg-[#f4f2f6] hover:text-[#181a36]",
                          ].join(" ")}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}
        </nav>
      )}
    </aside>
  );
}
