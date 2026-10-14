import type { GalleryView, User } from "./types";
import type { GalleryRoleTier } from "./galleryRoleTiers";

export function resolveGalleryTier(user: User | null | undefined): GalleryRoleTier {
  if (!user) return "employee";
  if (user.is_gallery_admin || user.is_admin) return "administrator";
  if (user.is_gallery_manager) return "supervisor";
  return "employee";
}

const VIEW_ACCESS: Record<GalleryView, Record<GalleryRoleTier, boolean>> = {
  dashboard: { administrator: true, supervisor: true, employee: false },
  albums: { administrator: true, supervisor: true, employee: true },
  gallery: { administrator: true, supervisor: true, employee: true },
  pending: { administrator: true, supervisor: true, employee: false },
  recycle: { administrator: true, supervisor: true, employee: false },
  contributions: { administrator: false, supervisor: false, employee: true },
  "upload-history": { administrator: true, supervisor: true, employee: true },
  audit: { administrator: true, supervisor: false, employee: false },
  settings: { administrator: true, supervisor: false, employee: false },
};

export function canAccessGalleryView(tier: GalleryRoleTier, view: GalleryView): boolean {
  return VIEW_ACCESS[view]?.[tier] ?? false;
}

export function defaultGalleryViewForTier(tier: GalleryRoleTier): GalleryView {
  return tier === "employee" ? "albums" : "dashboard";
}

export function canCreateAlbum(tier: GalleryRoleTier): boolean {
  return tier === "administrator" || tier === "supervisor";
}

/** SRS: employees use the Upload Media button; supervisors/admins upload from album detail. */
export function canShowListUploadButton(tier: GalleryRoleTier): boolean {
  return tier === "employee";
}

export function canDeleteOrRestoreMedia(tier: GalleryRoleTier): boolean {
  return tier !== "employee";
}
