"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function BatchToolbar({
  count,
  total,
  onClear,
  onToggleAll,
  children,
}: {
  count: number;
  total?: number;
  onClear: () => void;
  onToggleAll?: () => void;
  children?: ReactNode;
}) {
  const allSelected = total != null && total > 0 && count === total;

  return (
    <div className="batch-toolbar">
      {onToggleAll && total != null ? (
        <label className="bulk-select-all">
          <input
            className="sg-check"
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
          />
          <span>
            {count ? `${count} selected` : `Select all (${total})`}
          </span>
        </label>
      ) : count > 0 ? (
        <span>{count} selected</span>
      ) : null}
      {children && <div className="batch-toolbar-actions">{children}</div>}
      {count > 0 && (
        <button type="button" className="batch-clear" onClick={onClear} aria-label="Clear selection">
          <X size={14} />
          Clear
        </button>
      )}
    </div>
  );
}
