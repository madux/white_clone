"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Filter } from "lucide-react";
import { cn } from "cn";

/** Standard filter control: lucide `Filter` icon + label, matches `.field` height (2rem). */
export default function FilterToggleButton({
  children = "Filter",
  className,
  badge,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Filter className="h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
      {badge}
    </button>
  );
}
