export type LibraryView =
  | "home"
  | "all"
  | "favorites"
  | "recent"
  | "recycle"
  | "approvals";

import type { MediaSortMode } from "../../../../lib/libraryFilters";

export type LayoutMode = "grid" | "list";

export type { MediaSortMode };

export type MediaFiltersState = {
  mandatory?: boolean;
  processing_state?: string;
  approval_status?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  sort?: MediaSortMode;
};
