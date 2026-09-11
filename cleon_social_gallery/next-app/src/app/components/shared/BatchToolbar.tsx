"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function BatchToolbar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <div className="batch-toolbar">
      <span>{count} selected</span>
      {children}
      <button type="button" className="batch-clear" onClick={onClear}>
        <X size={14} />
        Clear
      </button>
    </div>
  );
}
