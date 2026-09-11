"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function PostNav({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  if (!hasPrev && !hasNext) return null;
  return (
    <div className="social-post-nav">
      <button
        type="button"
        className="social-post-nav-btn"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous post"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        className="social-post-nav-btn"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next post"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
