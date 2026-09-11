"use client";

export function LoadMoreFooter({
  shown,
  total,
  loading,
  onLoadMore,
}: {
  shown: number;
  total: number;
  loading?: boolean;
  onLoadMore: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="load-more-footer">
      <span className="meta-muted">Showing {shown} of {total}</span>
      <button type="button" className="secondary-button" disabled={loading} onClick={onLoadMore}>
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
