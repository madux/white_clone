"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type AnimatedTabItem<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  href?: string;
  emphasisClassName?: string;
};

type AnimatedTabsProps<T extends string> = {
  items: AnimatedTabItem<T>[];
  value: T;
  onChange?: (value: T) => void;
  variant?: "underline" | "segmented";
  size?: "sm" | "md";
  stretch?: boolean;
  className?: string;
  ariaLabel?: string;
};

type IndicatorState = {
  left: number;
  width: number;
  height: number;
};

export default function AnimatedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
  size = "md",
  stretch = false,
  className = "",
  ariaLabel = "Sections",
}: AnimatedTabsProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<T, HTMLElement | null>>>({});
  const [indicator, setIndicator] = useState<IndicatorState>({
    left: 0,
    width: 0,
    height: 0,
  });
  const [ready, setReady] = useState(false);

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current[value];
    const track = trackRef.current;
    if (!activeEl || !track) return;
    setIndicator({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
      height: activeEl.offsetHeight,
    });
    setReady(true);
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, items]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(track);
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  const registerRef = (id: T) => (node: HTMLElement | null) => {
    tabRefs.current[id] = node;
  };

  const rootClass = [
    "animated-tabs",
    `animated-tabs--${variant}`,
    `animated-tabs--${size}`,
    stretch ? "animated-tabs--stretch" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={rootClass} aria-label={ariaLabel}>
      <div className="animated-tabs-track" ref={trackRef} role="tablist">
        <span
          className={`animated-tabs-indicator ${ready ? "is-ready" : ""}`}
          style={{
            width: indicator.width,
            height:
              variant === "segmented"
                ? indicator.height || undefined
                : undefined,
            transform: `translateX(${indicator.left}px)`,
          }}
          aria-hidden="true"
        />
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === value;
          const tabClass = [
            "animated-tabs-tab",
            active ? "is-active" : "",
            item.emphasisClassName ?? "",
          ]
            .filter(Boolean)
            .join(" ");

          const content = (
            <>
              {Icon ? <Icon className="animated-tabs-icon" aria-hidden="true" /> : null}
              <span className="animated-tabs-label">{item.label}</span>
              {item.count !== undefined ? (
                <span className="animated-tabs-count">{item.count}</span>
              ) : null}
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.id}
                ref={registerRef(item.id)}
                href={item.href}
                role="tab"
                aria-selected={active}
                className={tabClass}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              ref={registerRef(item.id)}
              type="button"
              role="tab"
              aria-selected={active}
              className={tabClass}
              onClick={() => onChange?.(item.id)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
