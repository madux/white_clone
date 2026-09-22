"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string };

export default function ThemedSelect({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  className = "field",
  ariaLabel,
  portaled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Render menu in document.body (avoids overflow-hidden clipping). */
  portaled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [highlighted, setHighlighted] = useState(
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open || !portaled) return;
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, portaled, options.length]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
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

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      className={`${portaled ? "fixed" : "absolute left-0 right-0 top-[calc(100%+0.4rem)]"} z-[200] max-h-64 overflow-y-auto rounded-2xl border border-pink-100 bg-white p-1.5 shadow-xl shadow-slate-900/10`}
      style={
        portaled
          ? {
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }
          : undefined
      }
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
        <p className="px-3 py-2.5 text-sm text-slate-400">No options available</p>
      )}
    </div>
  );

  return (
    <div ref={root} className="relative min-w-0 w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next && portaled) updateMenuPosition();
            return next;
          });
        }}
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
      {open && !portaled ? menu : null}
      {open && portaled && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}
