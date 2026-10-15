"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { DROPDOWN_EMPTY_LABEL } from "@/lib/dropdownEmptyLabel";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AppSelectVariant = "field" | "chip" | "toolbar";

export default function AppSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled,
  ariaLabel,
  className,
  variant = "field",
  chipPrefix,
  leadingIcon,
  displayValue,
  emptyLabel = DROPDOWN_EMPTY_LABEL,
  id: idProp,
}: {
  value: string | number | "";
  options: AppSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  variant?: AppSelectVariant;
  chipPrefix?: string;
  leadingIcon?: ReactNode;
  /** Override the closed trigger label (e.g. status counts). */
  displayValue?: string;
  emptyLabel?: string;
  id?: string;
}) {
  const generatedId = useId();
  const listboxId = idProp || `app-select-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "above" | "below";
  } | null>(null);

  const stringValue = value === "" || value == null ? "" : String(value);

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );

  const selectedOption = useMemo(
    () => options.find((option) => option.value === stringValue),
    [options, stringValue],
  );

  const closedLabel =
    displayValue ??
    (selectedOption ? selectedOption.label : placeholder);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(
      Math.max(rect.width, variant === "chip" ? rect.width : 220),
      vw - margin * 2,
    );

    let left = rect.left;
    if (left + width > vw - margin) left = vw - width - margin;
    left = Math.max(margin, left);

    const menuEl = menuRef.current;
    const measuredHeight = menuEl?.getBoundingClientRect().height ?? 0;
    const estimatedHeight = Math.min(
      Math.max(options.length, 1) * 40 + 16,
      320,
    );
    const menuHeight = measuredHeight > 0 ? measuredHeight : estimatedHeight;

    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openAbove = menuHeight > spaceBelow && spaceAbove > spaceBelow;

    if (openAbove) {
      const maxHeight = Math.max(120, Math.min(320, spaceAbove));
      setMenuStyle({
        bottom: vh - rect.top + gap,
        left,
        width,
        maxHeight,
        placement: "above",
      });
      return;
    }

    const maxHeight = Math.max(120, Math.min(320, spaceBelow));
    setMenuStyle({
      top: rect.bottom + gap,
      left,
      width,
      maxHeight,
      placement: "below",
    });
  }, [options.length, variant]);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    const frame = requestAnimationFrame(() => positionMenu());
    return () => cancelAnimationFrame(frame);
  }, [open, positionMenu, options.length]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => positionMenu();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHighlight(-1);
      return;
    }
    const selectedIndex = enabledOptions.findIndex((option) => option.value === stringValue);
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, enabledOptions, stringValue]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveHighlight = (delta: number) => {
    if (!enabledOptions.length) return;
    setHighlight((current) => {
      const base = current < 0 ? 0 : current;
      const next = (base + delta + enabledOptions.length) % enabledOptions.length;
      return next;
    });
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (event.key === "ArrowDown") moveHighlight(1);
      if (event.key === "ArrowUp") moveHighlight(-1);
      if ((event.key === "Enter" || event.key === " ") && highlight >= 0) {
        commit(enabledOptions[highlight].value);
      }
    }
  };

  const rootClass = [
    "app-select",
    `app-select--${variant}`,
    open ? "is-open" : "",
    disabled ? "is-disabled" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  const showPlaceholder = !selectedOption && !displayValue;

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={listboxId}
        className="app-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listboxId}-listbox`}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {variant === "chip" && chipPrefix ? (
          <span className="app-select-chip-prefix">{chipPrefix}</span>
        ) : null}
        {leadingIcon ? <span className="app-select-leading">{leadingIcon}</span> : null}
        <span className={`app-select-value${showPlaceholder ? " is-placeholder" : ""}`}>
          {closedLabel}
        </span>
        <ChevronDown size={16} className="app-select-chevron" aria-hidden />
      </button>

      {open && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className={`app-select-menu app-select-menu--${menuStyle.placement}`}
              style={{
                top: menuStyle.top,
                bottom: menuStyle.bottom,
                left: menuStyle.left,
                width: menuStyle.width,
                maxHeight: menuStyle.maxHeight,
              }}
              role="presentation"
            >
              {options.length === 0 ? (
                <p className="app-select-empty">{emptyLabel}</p>
              ) : (
                <ul
                  id={`${listboxId}-listbox`}
                  className="app-select-list"
                  role="listbox"
                  aria-label={ariaLabel}
                >
                  {options.map((option) => {
                    const enabledIndex = enabledOptions.findIndex((o) => o.value === option.value);
                    const isSelected = option.value === stringValue;
                    const isHighlighted = enabledIndex === highlight;
                    return (
                      <li
                        key={option.value}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled || undefined}
                        className={[
                          "app-select-option",
                          isSelected ? "is-selected" : "",
                          isHighlighted ? "is-highlighted" : "",
                          option.disabled ? "is-disabled" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseEnter={() => {
                          if (!option.disabled && enabledIndex >= 0) setHighlight(enabledIndex);
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (option.disabled) return;
                          commit(option.value);
                        }}
                      >
                        <span className="app-select-option-label">{option.label}</span>
                        {isSelected ? <Check size={16} className="app-select-option-check" aria-hidden /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
