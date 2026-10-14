"use client";

import type { GalleryAlbum, LayoutMode } from "@/lib/types";
import {
  ArrowDownUp,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AppSelect from "../shared/AppSelect";

export type GalleryStatusFilter = "" | "approved" | "pending" | "rejected";

const VIEW_MODES: { id: LayoutMode; label: string; icon: LucideIcon }[] = [
  { id: "grid", label: "Cards", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
];

const SORT_LABELS: Record<string, string> = {
  newest: "Newest Added",
  oldest: "Oldest Added",
  name: "Name",
  size: "File Size",
};

export function GalleryLibraryChrome({
  search,
  onSearch,
  layout,
  onLayoutChange,
  statusFilter,
  onStatusFilter,
  statusOptions,
  sort,
  onSort,
  albums,
  albumFilterId,
  onAlbumFilter,
  shown,
  total,
  onCreateAlbum,
  canManageStatus,
}: {
  search: string;
  onSearch: (value: string) => void;
  layout: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  statusFilter: GalleryStatusFilter;
  onStatusFilter: (value: GalleryStatusFilter) => void;
  statusOptions: { value: GalleryStatusFilter; label: string; count: number }[];
  sort: string;
  onSort: (value: string) => void;
  albums: GalleryAlbum[];
  albumFilterId: number | null;
  onAlbumFilter: (albumId: number | null) => void;
  shown: number;
  total: number;
  onCreateAlbum?: () => void;
  canManageStatus?: boolean;
}) {
  const activeStatus = statusOptions.find((o) => o.value === statusFilter) || statusOptions[0];
  const statusDisplay = `${activeStatus?.label || "All"} (${activeStatus?.count ?? total})`;

  const statusSelectOptions = statusOptions.map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));

  const sortSelectOptions = Object.entries(SORT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="gallery-library-chrome">
      <section className="gallery-library-panel" aria-label="Search and filters">
        <label className="gallery-library-search">
          <Search size={18} className="gallery-library-search-icon" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search title, file, author…"
            aria-label="Search assets"
          />
        </label>

        <div className="gallery-library-filter-row">
          {canManageStatus ? (
            <AppSelect
              variant="chip"
              className="gallery-library-filter-select"
              chipPrefix="Status"
              value={statusFilter}
              displayValue={statusDisplay}
              options={statusSelectOptions}
              onChange={(value) => onStatusFilter(value as GalleryStatusFilter)}
              ariaLabel="Filter by status"
            />
          ) : (
            <div className="gallery-filter-chip gallery-filter-chip--readonly gallery-library-filter-select">
              <span className="gallery-filter-chip-prefix">Status</span>
              <span>{statusDisplay}</span>
            </div>
          )}

          <AppSelect
            variant="chip"
            className="gallery-library-filter-select"
            leadingIcon={<ArrowDownUp size={16} aria-hidden />}
            value={sort}
            options={sortSelectOptions}
            onChange={onSort}
            ariaLabel="Sort assets"
          />
        </div>

        <div className="gallery-view-toggle gallery-view-toggle--library" role="group" aria-label="Gallery view mode">
          {VIEW_MODES.map((mode) => {
            const active = layout === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                className={active ? "active" : ""}
                onClick={() => onLayoutChange(mode.id)}
                aria-pressed={active}
                aria-label={`${mode.label} view`}
              >
                <Icon size={18} strokeWidth={2} aria-hidden />
                <span className="gallery-view-toggle-label">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="gallery-album-bar" aria-label="Album filter">
        <div className="gallery-album-bar-head">
          <span className="gallery-album-bar-label">Album</span>
          <span className="gallery-showing-count">
            <strong>{shown}</strong> / <strong>{total}</strong>
          </span>
        </div>
        <div className="gallery-album-pills-scroll">
          <div className="gallery-album-pills">
            <button
              type="button"
              className={`gallery-album-pill${albumFilterId == null ? " is-active" : ""}`}
              onClick={() => onAlbumFilter(null)}
            >
              All
            </button>
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                className={`gallery-album-pill${albumFilterId === album.id ? " is-active" : ""}`}
                onClick={() => onAlbumFilter(album.id)}
              >
                {album.name}
              </button>
            ))}
            {onCreateAlbum && (
              <button type="button" className="gallery-album-pill is-dashed" onClick={onCreateAlbum}>
                <Plus size={14} aria-hidden />
                New
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
