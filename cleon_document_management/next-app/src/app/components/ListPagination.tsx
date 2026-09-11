"use client";

function pageNumbers(current: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export default function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= 0) return null;

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const showControls = totalPages > 1;

  return (
    <div className="list-pagination">
      <p className="list-pagination-summary">
        Showing {start}–{end} of {total}
      </p>
      {showControls ? (
        <div className="list-pagination-controls">
          <button
            type="button"
            className="list-pagination-button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            Previous
          </button>
          {pageNumbers(safePage, totalPages).map((number) => (
            <button
              key={number}
              type="button"
              className={`list-pagination-button ${
                number === safePage ? "active" : ""
              }`}
              onClick={() => onPageChange(number)}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            className="list-pagination-button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
