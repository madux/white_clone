"use client";

import { Check, ChevronDown } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

export default function ThemedSelect({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  className = "field",
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const index = options.findIndex((option) => option.value === value);
    setHighlighted(index >= 0 ? index : 0);
  }, [options, value]);

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") return setOpen(false);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) =>
        event.key === "ArrowDown"
          ? (current + 1) % options.length
          : (current - 1 + options.length) % options.length,
      );
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[highlighted]) choose(options[highlighted]);
      else setOpen(true);
    }
  };

  return (
    <div ref={root} className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={`${className} flex items-center justify-between gap-3 text-left`}
      >
        <span
          className={
            selected ? "truncate text-slate-700" : "truncate text-slate-400"
          }
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-pink transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[80] max-h-64 overflow-y-auto rounded-2xl border border-pink-100 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {options.length ? (
            options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${index === highlighted ? "bg-pink-50 text-brand-text" : "text-slate-600 hover:bg-pink-50/70 hover:text-brand-text"}`}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && (
                  <Check className="h-4 w-4 shrink-0 text-brand-pink" />
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-slate-400">
              No options available
            </p>
          )}
        </div>
      )}
    </div>
  );
}
