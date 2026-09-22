"use client";

import AnimatedTabs, { type AnimatedTabItem } from "./AnimatedTabs";

type SectionTabsProps<T extends string> = {
  items: AnimatedTabItem<T>[];
  value: T;
  onChange?: (value: T) => void;
  stretch?: boolean;
  className?: string;
  ariaLabel?: string;
};

export default function SectionTabs<T extends string>({
  items,
  value,
  onChange,
  stretch = false,
  className = "",
  ariaLabel = "Sections",
}: SectionTabsProps<T>) {
  return (
    <AnimatedTabs
      items={items}
      value={value}
      onChange={onChange}
      variant="segmented"
      size="sm"
      stretch={stretch}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
