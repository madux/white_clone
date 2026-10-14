"use client";

import type { ReactNode } from "react";

type WizardSectionHeaderProps = {
  letter: string;
  title: string;
  badgeCount?: number;
  description: string;
  action?: ReactNode;
};

export function WizardSectionHeader({
  letter,
  title,
  badgeCount,
  description,
  action,
}: WizardSectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
      <div className="min-w-0 space-y-1">
        <h2 className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-800">
          <span>{letter ? `${letter}. ` : ""}{title}</span>
          {badgeCount != null ? (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-pink px-1.5 text-[10px] font-bold text-white"
              aria-hidden
            >
              {badgeCount}
            </span>
          ) : null}
        </h2>
        <p className="max-w-2xl text-xs text-slate-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
