"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type DocMenuOption = { value: string; label: string };

export function DocMenuSelect({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
  highlightWhen = (current, defaultValue) => current !== defaultValue,
  defaultValue = "",
}: {
  options: DocMenuOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  highlightWhen?: (value: string, defaultValue: string) => boolean;
  defaultValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value) ?? options[0];
  const isFiltered = highlightWhen(value, defaultValue);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`doc-menu-select ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`doc-menu-select-trigger${open ? " is-open" : ""}${isFiltered ? " is-active" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="doc-menu-select-label">{selected?.label ?? ariaLabel}</span>
        <ChevronDown size={16} className="doc-menu-select-chevron" aria-hidden />
      </button>
      {open ? (
        <ul id={listId} className="doc-menu-select-panel" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || "__all"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`doc-menu-select-option${isSelected ? " is-selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected ? <Check size={15} strokeWidth={2.5} aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
