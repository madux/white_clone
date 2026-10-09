"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DROPDOWN_EMPTY_LABEL } from "../../../lib/dropdownEmptyLabel";

export type CheckboxDropdownOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export default function CheckboxDropdown({
  label,
  placeholder = "Select options",
  options,
  values,
  onChange,
  emptyLabel = DROPDOWN_EMPTY_LABEL,
}: {
  label?: string;
  placeholder?: string;
  options: CheckboxDropdownOption[];
  values: string[];
  onChange: (values: string[]) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const selectedLabels = values
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter((item): item is string => Boolean(item));
  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;

  const toggle = (value: string, disabled?: boolean) => {
    if (disabled) return;
    onChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  return (
    <div ref={rootRef} className="relative max-w-xl">
      {label ? (
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-2.5 text-left text-sm"
      >
        <span className={selectedLabels.length ? "truncate" : "truncate text-muted-foreground"}>
          {summary}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search attributes"
                className="h-8 pl-8"
              />
            </div>
          </div>
          {filtered.length ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <li key={option.value}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 px-3 py-2 text-sm ${
                        option.disabled ? "cursor-not-allowed opacity-70" : "hover:bg-muted"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={option.disabled}
                        onCheckedChange={() => toggle(option.value, option.disabled)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {option.label}
                          {option.disabled ? (
                            <span className="ml-2 text-xs font-semibold text-muted-foreground">
                              Unavailable
                            </span>
                          ) : null}
                        </span>
                        {option.hint ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
