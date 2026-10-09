"use client";

export type SettingsSidebarItem = {
  id: string;
  label: string;
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
};

export default function SettingsSidebar({
  groups,
  activeId,
  onSelect,
  search,
  onSearchChange,
  activeEmphasis,
}: SettingsSidebarProps) {
  const hasItems = groups.some((group) => group.items.length > 0);

  return (
    <aside
      className="w-full shrink-0 lg:w-[220px] lg:sticky lg:top-6 lg:self-start"
      aria-label="Settings navigation"
    >
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

      {!hasItems ? (
        <p className="px-3 text-sm text-slate-500">No matching settings.</p>
      ) : (
        <nav className="flex flex-col gap-6">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.title}>
                <p className="mb-1 px-3 text-xs font-semibold text-slate-500">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = item.id === activeId;
                    const emphasize = active && activeEmphasis;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(item.id)}
                          aria-current={active ? "page" : undefined}
                          className={[
                            "relative w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                            active
                              ? "font-semibold text-slate-900 before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-pink"
                              : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                            emphasize ? "bg-pink-50/80" : active ? "bg-slate-100" : "",
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
