"use client";

import { Filter } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  LIBRARY_APPROVAL_FILTER_OPTIONS,
  LIBRARY_STATUS_FILTER_OPTIONS,
  countActiveLibraryFilters,
} from "../../../../lib/libraryFilters";
import { DocMenuSelect } from "../ui/DocMenuSelect";
import type { MediaFiltersState } from "./libraryTypes";

export function LibraryFilterMenu({
  filters,
  onFiltersChange,
  align = "start",
}: {
  filters: MediaFiltersState;
  onFiltersChange: (filters: MediaFiltersState) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const activeCount = countActiveLibraryFilters(filters);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const clearFilters = () => {
    onFiltersChange({ sort: filters.sort });
  };

  return (
    <div
      className={`library-filter-popover${align === "end" ? " library-filter-popover--align-end" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`library-filter-icon-btn${open ? " is-open" : ""}${activeCount > 0 ? " is-active" : ""}`}
        aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Filter size={18} strokeWidth={2} aria-hidden />
        {activeCount > 0 ? (
          <span className="library-filter-badge" aria-hidden>{activeCount}</span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          className="library-filter-popover-panel"
          role="dialog"
          aria-label="Video filters"
        >
          <div className="library-filter-popover-head">
            <strong>Filters</strong>
            {activeCount > 0 ? (
              <button type="button" className="text-button small" onClick={clearFilters}>
                Clear all
              </button>
            ) : null}
          </div>
          <div className="library-filter-fields">
            <label className="library-filter-field">
              <span className="library-filter-field-label">Status</span>
              <DocMenuSelect
                className="doc-menu-select--block"
                ariaLabel="Filter by status"
                options={LIBRARY_STATUS_FILTER_OPTIONS}
                value={filters.status || ""}
                onChange={(next) =>
                  onFiltersChange({
                    ...filters,
                    status: next || undefined,
                    processing_state: undefined,
                  })
                }
              />
            </label>
            <label className="library-filter-field">
              <span className="library-filter-field-label">Approval state</span>
              <DocMenuSelect
                className="doc-menu-select--block"
                ariaLabel="Filter by approval state"
                options={LIBRARY_APPROVAL_FILTER_OPTIONS}
                value={filters.approval_status || ""}
                onChange={(next) =>
                  onFiltersChange({
                    ...filters,
                    approval_status: next || undefined,
                  })
                }
              />
            </label>
            <label className="library-filter-check library-filter-field-check">
              <input
                type="checkbox"
                checked={Boolean(filters.mandatory)}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    mandatory: event.target.checked || undefined,
                  })
                }
              />
              Mandatory only
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
