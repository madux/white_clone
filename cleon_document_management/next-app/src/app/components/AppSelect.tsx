"use client";

import { useMemo } from "react";
import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DROPDOWN_EMPTY_LABEL } from "../../../lib/dropdownEmptyLabel";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export default function AppSelect({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  className,
  ariaLabel,
  disabled,
  emptyLabel = DROPDOWN_EMPTY_LABEL,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  portaled?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const items = useMemo(
    () =>
      options.map((option) => ({
        value: String(option.value),
        label: option.label,
      })),
    [options],
  );

  return (
    <Select
      value={value ? String(value) : null}
      items={items}
      onValueChange={(next) => onChange(next == null ? "" : String(next))}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "!w-full max-w-full min-w-0 whitespace-normal [&_[data-slot=select-value]]:truncate",
          className,
        )}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        side="bottom"
        className="min-w-(--anchor-width)"
      >
        {options.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
