"use client";

import { LoaderCircle } from "lucide-react";

export function LoadingState({
  message = "Loading…",
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  return (
    <div className={`loading-state ${compact ? "compact" : ""}`.trim()}>
      <LoaderCircle size={18} className="spin" />
      <span>{message}</span>
    </div>
  );
}
