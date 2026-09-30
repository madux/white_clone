"use client";

import AnimatedTabs, { type AnimatedTabItem } from "./AnimatedTabs";

type SectionTabsProps<T extends string> = {
  items: AnimatedTabItem<T>[];
  value: T;
  onChange?: (value: T) => void;
  level?: "page" | "nested";
  stretch?: boolean;
  className?: string;
  ariaLabel?: string;
};

export default function SectionTabs<T extends string>({
  items,
  value,
  onChange,
  level = "page",
  stretch = false,
  className = "",
  ariaLabel = "Sections",
}: SectionTabsProps<T>) {
  const nested = level === "nested";
  return (
    <AnimatedTabs
      items={items}
      value={value}
      onChange={onChange}
      variant={nested ? "underline" : "segmented"}
      size={nested ? "sm" : "md"}
      level={nested ? "nested" : "page"}
      stretch={stretch}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
