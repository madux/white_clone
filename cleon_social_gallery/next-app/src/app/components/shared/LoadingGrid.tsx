"use client";

export function LoadingGrid({ count = 4, cols = 4 }: { count?: number; cols?: 3 | 4 }) {
  return (
    <div className={`loading-grid ${cols === 3 ? "cols-3" : ""}`.trim()}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  );
}
