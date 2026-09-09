export type LibraryView =
  | "home"
  | "all"
  | "favorites"
  | "recent"
  | "recycle"
  | "approvals";

export type LayoutMode = "grid" | "list";

export type MediaFiltersState = {
  mandatory?: boolean;
  processing_state?: string;
  approval_status?: string;
  date_from?: string;
  date_to?: string;
};
