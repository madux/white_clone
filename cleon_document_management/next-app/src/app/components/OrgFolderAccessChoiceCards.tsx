"use client";

import { Building2, Check, CircleHelp, Globe2, Lock, Shield } from "lucide-react";
import {
  allowedVisibilityModes,
  coerceVisibilityMode,
  type OrgVisibilityMode,
} from "../../../lib/organizationalFolderScope";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CARD_OPTIONS: {
  key: OrgVisibilityMode;
  title: string;
  help: string;
  icon: typeof Globe2;
}[] = [
  {
    key: "public",
    title: "Company-wide",
    help: "All eligible employees in the workforce can access this folder.",
    icon: Globe2,
  },
  {
    key: "restricted",
    title: "Restricted",
    help: "Limit access to selected departments, grades, or individual employees.",
    icon: Shield,
  },
  {
    key: "company_owned",
    title: "Company owned",
    help:
      "Visible to you, users designated as company-owned delegates in settings, and administrators.",
    icon: Building2,
  },
  {
    key: "private",
    title: "Private",
    help: "Only the staff member who creates this folder can access it.",
    icon: Lock,
  },
];

function AccessOptionHelp({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:border-brand-pink/40 hover:text-brand-pink"
        aria-label={`About ${label}`}
        onClick={(event) => event.stopPropagation()}
      >
        <CircleHelp className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[120] max-w-[260px] text-left text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export default function OrgFolderAccessChoiceCards({
  value,
  onChange,
  parentAccessScope,
}: {
  value: OrgVisibilityMode;
  onChange: (value: OrgVisibilityMode) => void;
  parentAccessScope?: string;
}) {
  const allowed = new Set(allowedVisibilityModes(parentAccessScope));
  const options = CARD_OPTIONS.filter((option) => allowed.has(option.key));
  const selected = coerceVisibilityMode(value, parentAccessScope);

  if (!options.length) return null;

  return (
    <div
      className={cn(
        "grid gap-3",
        options.length <= 2 ? "grid-cols-2 max-w-md" : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {options.map((option) => {
        const isSelected = selected === option.key;
        const Icon = option.icon;
        return (
          <div
            key={option.key}
            className={cn(
              "relative aspect-square w-full min-w-0 rounded-2xl border transition",
              isSelected
                ? "border-brand-pink bg-pink-50/40 ring-2 ring-brand-pink/25"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div className="absolute left-2 top-2 z-10">
              <AccessOptionHelp label={option.title} text={option.help} />
            </div>
            {isSelected ? (
              <span
                className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-white"
                aria-hidden
              >
                <Check className="h-3 w-3" />
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onChange(option.key)}
              className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 pb-2 pt-8"
            >
              <Icon
                className={cn(
                  "h-7 w-7 shrink-0",
                  isSelected ? "text-brand-pink" : "text-slate-500",
                )}
                aria-hidden
              />
              <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-slate-900 sm:text-xs">
                {option.title}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
