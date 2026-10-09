"use client";

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
  const items = [
    { label: placeholder, value: null as string | null },
    ...options.map((option) => ({
      label: option.label,
      value: option.value,
      disabled: option.disabled,
    })),
  ];

  return (
    <Select
      items={items}
      value={value || null}
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
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger side="bottom" className="min-w-(--anchor-width)">
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
