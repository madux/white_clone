import { useEffect, useMemo, useState } from "react";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "./employeeFileListPageSize";

export function useClientPagination<T>(
  items: T[],
  resetKey: string | number,
  pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  return {
    page: safePage,
    setPage,
    pageSize,
    total,
    items: pagedItems,
  };
}
