"use client";

import {
  FolderPlus,
  LayoutGrid,
  List,
  UploadCloud,
} from "lucide-react";
import { LIBRARY_SORT_OPTIONS } from "../../../../lib/libraryFilters";
import { DocMenuSelect } from "../ui/DocMenuSelect";
import { LibraryFilterMenu } from "./LibraryFilterMenu";
import type { LayoutMode, MediaFiltersState } from "./libraryTypes";

export function LibraryPageToolbar({
  title,
  description,
  canManage,
  layoutMode,
  filters,
  onCreateFolder,
  onUpload,
  onLayoutChange,
  onFiltersChange,
}: {
  title: string;
  description: string;
  canManage: boolean;
  layoutMode: LayoutMode;
  filters: MediaFiltersState;
  onCreateFolder: () => void;
  onUpload: () => void;
  onLayoutChange: (mode: LayoutMode) => void;
  onFiltersChange: (filters: MediaFiltersState) => void;
}) {
  const sort = filters.sort || "updated_desc";

  return (
    <section className="library-page-chrome section-block">
      <div className="library-page-header">
        <div className="library-page-heading">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {canManage ? (
          <div className="library-page-actions primary-actions">
            <button type="button" className="secondary-button" onClick={onCreateFolder}>
              <FolderPlus size={17} />
              New folder
            </button>
            <button type="button" className="primary-button" onClick={onUpload}>
              <UploadCloud size={17} />
              Upload video
            </button>
          </div>
        ) : null}
      </div>
      <div className="library-filter-bar">
        <div className="library-filter-bar-end">
          <div className="library-filter-sort">
            <span className="library-filter-label">Sort by:</span>
            <DocMenuSelect
              className="library-filter-menu library-filter-menu-sort"
              ariaLabel="Sort videos"
              options={LIBRARY_SORT_OPTIONS}
              value={sort}
              defaultValue="updated_desc"
              highlightWhen={(current, defaultValue) => current !== defaultValue}
              onChange={(next) =>
                onFiltersChange({
                  ...filters,
                  sort: (next || "updated_desc") as MediaFiltersState["sort"],
                })
              }
            />
          </div>
          <div className="view-toggle library-view-toggle" role="group" aria-label="Layout">
            <button
              type="button"
              className={layoutMode === "grid" ? "active" : ""}
              onClick={() => onLayoutChange("grid")}
              aria-label="Grid view"
              aria-pressed={layoutMode === "grid"}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={layoutMode === "list" ? "active" : ""}
              onClick={() => onLayoutChange("list")}
              aria-label="List view"
              aria-pressed={layoutMode === "list"}
            >
              <List size={16} />
            </button>
          </div>
          <LibraryFilterMenu filters={filters} onFiltersChange={onFiltersChange} align="end" />
        </div>
      </div>
    </section>
  );
}
