"use client";

import { LayoutGrid, List } from "lucide-react";
import type { LayoutMode } from "@/lib/types";

const VIEW_MODES: { id: LayoutMode; label: string }[] = [
  { id: "grid", label: "Cards" },
  { id: "list", label: "List" },
];

export function GalleryViewToggle({
  layout,
  onLayoutChange,
  className = "",
}: {
  layout: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`gallery-view-toggle gallery-view-toggle--library ${className}`.trim()}
      role="group"
      aria-label="View mode"
    >
      {VIEW_MODES.map((mode) => {
        const active = layout === mode.id;
        const Icon = mode.id === "grid" ? LayoutGrid : List;
        return (
          <button
            key={mode.id}
            type="button"
            className={active ? "active" : ""}
            onClick={() => onLayoutChange(mode.id)}
            aria-pressed={active}
            aria-label={`${mode.label} view`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
            <span className="gallery-view-toggle-label">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
