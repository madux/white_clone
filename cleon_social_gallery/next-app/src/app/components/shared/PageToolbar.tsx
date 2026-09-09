"use client";

import type { ReactNode } from "react";

export function PageToolbar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="filter-toolbar">
      <div className="filter-toolbar-left">{left}</div>
      <div className="filter-toolbar-right">{right}</div>
    </div>
  );
}
