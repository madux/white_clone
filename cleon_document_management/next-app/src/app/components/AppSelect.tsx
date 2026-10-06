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
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  portaled?: boolean;
  disabled?: boolean;
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
      <SelectContent alignItemWithTrigger side="bottom">
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
      </SelectContent>
    </Select>
  );
}
