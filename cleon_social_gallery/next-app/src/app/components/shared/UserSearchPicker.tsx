"use client";

import { Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useGalleryUserSearch } from "@/hooks/useSocialGallery";

export function UserSearchPicker({
  excludeUserIds = [],
  onSelect,
  disabled = false,
}: {
  excludeUserIds?: number[];
  onSelect: (user: { id: number; name: string; email: string }) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const usersQuery = useGalleryUserSearch(debounced, open);
  const results = (usersQuery.data || []).filter((user) => !excludeUserIds.includes(user.id));

  return (
    <div className="user-search-picker">
      <label className="search-field compact-search">
        <Search size={15} />
        <input
          value={search}
          disabled={disabled}
          placeholder="Search employees by name or email"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
        />
      </label>
      {open && (
        <div className="user-search-results">
          {usersQuery.isLoading ? (
            <span className="form-hint">Searching…</span>
          ) : results.length ? (
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                className="user-search-result"
                onClick={() => {
                  onSelect(user);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span className="user-search-avatar">
                  <UserRound size={14} />
                </span>
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email || `User #${user.id}`}</small>
                </span>
              </button>
            ))
          ) : (
            <span className="form-hint">No matching users found.</span>
          )}
        </div>
      )}
    </div>
  );
}
