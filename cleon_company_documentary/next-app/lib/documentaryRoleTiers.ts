import type { ModuleRoleMember } from "./types";

export type DocumentaryRoleTier = "employee" | "supervisor" | "administrator";

export const ROLE_TIER_CARDS: {
  tier: DocumentaryRoleTier;
  title: string;
  badge: string;
  description: string;
}[] = [
  {
    tier: "employee",
    title: "Employee",
    badge: "Viewing Only",
    description:
      "Browse and play published documentaries, read transcripts, and use captions. Cannot upload, edit details, delete files, or access settings.",
  },
  {
    tier: "supervisor",
    title: "Supervisor",
    badge: "Management Role",
    description:
      "Full video management, review approval queue, transcripts, captions, and viewership analytics. Cannot change core settings or assign roles.",
  },
  {
    tier: "administrator",
    title: "Administrator",
    badge: "Full Control",
    description:
      "Full governance over the library: folders, uploads, publishing, analytics, recycle bin, storage limits, and role assignments.",
  },
];

export const TIER_PRIVILEGES: Record<
  DocumentaryRoleTier,
  { label: string; allowed: boolean }[]
> = {
  employee: [
    { label: "Browse & play published video", allowed: true },
    { label: "Upload & replace footage", allowed: false },
    { label: "Edit details & AI transcripts", allowed: false },
    { label: "Configure policies & assign roles", allowed: false },
  ],
  supervisor: [
    { label: "Browse & play published video", allowed: true },
    { label: "Upload & replace footage", allowed: true },
    { label: "Edit details & AI transcripts", allowed: true },
    { label: "Configure policies & assign roles", allowed: false },
  ],
  administrator: [
    { label: "Browse & play published video", allowed: true },
    { label: "Upload & replace footage", allowed: true },
    { label: "Edit details & AI transcripts", allowed: true },
    { label: "Configure policies & assign roles", allowed: true },
  ],
};

export function memberRoleTier(member: ModuleRoleMember): DocumentaryRoleTier {
  if (member.roles.admin) return "administrator";
  if (member.roles.manager) return "supervisor";
  return "employee";
}

export function tierLabel(tier: DocumentaryRoleTier): string {
  if (tier === "administrator") return "Administrator";
  if (tier === "supervisor") return "Supervisor";
  return "Employee";
}

export function applyTierToRoles(
  roles: ModuleRoleMember["roles"],
  tier: DocumentaryRoleTier,
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
