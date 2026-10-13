"use client";

import {
  FileText,
  FolderKanban,
  FolderOpen,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { OrgLibraryKindFilter, OrgLibraryStats } from "../../../lib/orgLibraryStats";

const cards: {
  key: OrgLibraryKindFilter;
  label: string;
  hint: string;
  icon: typeof FolderOpen;
  stat: (s: OrgLibraryStats) => number;
}[] = [
  {
    key: "all",
    label: "Folders",
    hint: "Browse and organise",
    icon: FolderOpen,
    stat: (s) => s.folder_count,
  },
  {
    key: "documents",
    label: "Documents",
    hint: "Folders with files",
    icon: FileText,
    stat: (s) => s.document_count,
  },
  {
    key: "project",
    label: "Projects",
    hint: "Project workspaces",
    icon: FolderKanban,
    stat: (s) => s.project_count,
  },
  {
    key: "vendor",
    label: "Vendors",
    hint: "Vendor records",
    icon: Store,
    stat: (s) => s.vendor_count,
  },
  {
    key: "policy",
    label: "Policies",
    hint: "Policy libraries",
    icon: ShieldCheck,
    stat: (s) => s.policy_count,
  },
];

export default function OrgLibrarySummaryCards({
  stats,
  active,
  onChange,
}: {
  stats: OrgLibraryStats;
  active: OrgLibraryKindFilter;
  onChange: (filter: OrgLibraryKindFilter) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const selected = active === card.key;
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onChange(card.key)}
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
              selected
                ? "border-brand-pink ring-2 ring-brand-pink/20"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                selected ? "bg-pink-50 text-brand-pink" : "bg-slate-50 text-slate-600"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold leading-tight text-slate-900">
                {card.stat(stats)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{card.hint}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
