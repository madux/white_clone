"use client";

import type { ReactNode } from "react";
import { cn } from "cn";

type PinkSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label for the switch (optional; use aria-label if omitted). */
  label?: string;
  className?: string;
  size?: "md" | "sm";
};

export function PinkSwitch({
  checked,
  disabled,
  onCheckedChange,
  label,
  className,
  size = "md",
}: PinkSwitchProps) {
  const compact = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-pink",
        "disabled:cursor-not-allowed disabled:opacity-45",
        checked ? "bg-brand-pink" : "bg-slate-200",
        compact ? "h-5 w-9" : "h-6 w-11",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          compact ? "h-4 w-4 translate-x-0.5" : "h-5 w-5 translate-x-0.5",
          checked &&
            (compact ? "translate-x-[18px]" : "translate-x-[22px]"),
        )}
      />
    </button>
  );
}

type PinkSwitchRowProps = {
  label: ReactNode;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

/** Label left, pink switch right — shared row layout for notification settings. */
export function PinkSwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
  className,
}: PinkSwitchRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
        ) : null}
      </div>
      <PinkSwitch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        label={typeof label === "string" ? label : undefined}
      />
    </div>
  );
}
