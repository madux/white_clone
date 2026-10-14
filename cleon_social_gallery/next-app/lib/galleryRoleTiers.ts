import type { ModuleRoleMember } from "./types";

export type GalleryRoleTier = "employee" | "supervisor" | "administrator";

export const ROLE_TIER_CARDS: {
  tier: GalleryRoleTier;
  title: string;
  badge: string;
  description: string;
}[] = [
  {
    tier: "employee",
    title: "Employee",
    badge: "Contribution & viewing",
    description:
      "Browse albums and the gallery, upload media for review, and track personal contributions. Cannot create albums, review submissions, or open the recycle bin.",
  },
  {
    tier: "supervisor",
    title: "Supervisor",
    badge: "Curation & review",
    description:
      "Dashboard, album management, pending review, recycle bin, and upload history. Uploads go through albums. No audit log or settings.",
  },
  {
    tier: "administrator",
    title: "Administrator",
    badge: "Full control",
    description:
      "Full gallery governance: albums (auto-approved), review, recycle bin, audit log, compliance settings, and role assignments.",
  },
];

export const TIER_PRIVILEGES: Record<
  GalleryRoleTier,
  { label: string; allowed: boolean }[]
> = {
  employee: [
    { label: "Browse albums & gallery", allowed: true },
    { label: "Upload via Upload Media (pending review)", allowed: true },
    { label: "Create albums & pending review queue", allowed: false },
    { label: "Delete or restore media / recycle bin", allowed: false },
    { label: "Audit log & settings", allowed: false },
  ],
  supervisor: [
    { label: "Browse albums & gallery", allowed: true },
    { label: "Upload via album detail", allowed: true },
    { label: "Create albums (pending approval)", allowed: true },
    { label: "Delete or restore media / recycle bin", allowed: true },
    { label: "Audit log & settings", allowed: false },
  ],
  administrator: [
    { label: "Browse albums & gallery", allowed: true },
    { label: "Upload via album detail", allowed: true },
    { label: "Create albums (auto-approved)", allowed: true },
    { label: "Delete or restore media / recycle bin", allowed: true },
    { label: "Audit log & settings", allowed: true },
  ],
};

export function memberRoleTier(member: ModuleRoleMember): GalleryRoleTier {
  if (member.roles.admin) return "administrator";
  if (member.roles.manager) return "supervisor";
  return "employee";
}

export function tierLabel(tier: GalleryRoleTier): string {
  if (tier === "administrator") return "Administrator";
  if (tier === "supervisor") return "Supervisor";
  return "Employee";
}

export function applyTierToRoles(
  roles: ModuleRoleMember["roles"],
  tier: GalleryRoleTier,
): ModuleRoleMember["roles"] {
  const next = { ...roles, user: true };
  if (tier === "employee") {
    next.manager = false;
    next.admin = false;
  } else if (tier === "supervisor") {
    next.manager = true;
    next.admin = false;
  } else {
    next.manager = true;
    next.admin = true;
  }
  return next;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarTone(name: string): string {
  const tones = ["rose", "violet", "sky", "amber", "teal", "indigo", "pink", "slate"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % 997;
  return tones[hash % tones.length];
}
