"use client";

import { Link2 } from "lucide-react";

export default function ShortcutIcon({
  className = "h-3.5 w-3.5 text-violet-600",
  title = "Shortcut",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className="inline-flex shrink-0">
      <Link2 className={className} aria-label={title} />
    </span>
  );
}
