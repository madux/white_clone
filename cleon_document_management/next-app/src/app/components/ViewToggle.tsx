"use client";

import { Grid2X2, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function ViewToggle({
  value,
  onChange,
  ariaLabel = "View",
}: {
  value: "list" | "card";
  onChange: (value: "list" | "card") => void;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        const selected = Array.isArray(next) ? next[0] : next;
        if (selected === "list" || selected === "card") onChange(selected);
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={ariaLabel}
    >
      <ToggleGroupItem value="list" aria-label="List">
        <List />
      </ToggleGroupItem>
      <ToggleGroupItem value="card" aria-label="Grid">
        <Grid2X2 />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
