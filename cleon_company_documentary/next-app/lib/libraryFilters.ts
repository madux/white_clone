import type { DocumentaryMedia } from "./types";
import { formatStatusLabel } from "./statusUtils";

export type MediaSortMode =
  | "updated_desc"
  | "created_desc"
  | "title_asc"
  | "title_desc";

const LIFECYCLE_STATUSES = [
  "processing",
  "processing_failed",
  "draft",
  "pending_review",
  "returned",
  "approved",
  "published",
  "archived",
] as const;

export const LIBRARY_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...LIFECYCLE_STATUSES.map((value) => ({
    value,
    label: formatStatusLabel(value),
  })),
];

export const LIBRARY_APPROVAL_FILTER_OPTIONS = [
  { value: "", label: "All approval states" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
];

export const LIBRARY_SORT_OPTIONS: { value: MediaSortMode; label: string }[] = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "created_desc", label: "Newest first" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
];

export function sortLibraryMedia(
  items: DocumentaryMedia[],
  sort: MediaSortMode = "updated_desc",
): DocumentaryMedia[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sort) {
      case "title_asc":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "title_desc":
        return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
      case "created_desc":
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "updated_desc":
      default:
        return (
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
        );
    }
  });
  return sorted;
}

export function mediaFiltersForApi(filters: {
  mandatory?: boolean;
  processing_state?: string;
  approval_status?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  sort?: MediaSortMode;
}) {
  const { sort: _sort, ...api } = filters;
  return api;
}

export function countActiveLibraryFilters(filters: {
  status?: string;
  approval_status?: string;
  mandatory?: boolean;
  processing_state?: string;
  date_from?: string;
  date_to?: string;
}): number {
  let count = 0;
  if (filters.status) count += 1;
  if (filters.approval_status) count += 1;
  if (filters.mandatory) count += 1;
  if (filters.processing_state) count += 1;
  if (filters.date_from || filters.date_to) count += 1;
  return count;
}
