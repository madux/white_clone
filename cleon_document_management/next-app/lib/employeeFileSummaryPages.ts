import { api } from "./api";
import type { EmployeeFileSummary, EmployeeFileSummaryPage } from "./types";

const FETCH_PAGE = 100;

function identificationValue(file: EmployeeFileSummary) {
  return String(file.employee_identification || file.employee_id);
}

async function paginateAllEmployeeFiles(
  fetchPage: (limit: number, offset: number) => Promise<EmployeeFileSummaryPage>,
  pageSize: number,
  offset: number,
  descending: boolean,
): Promise<EmployeeFileSummaryPage> {
  const first = await fetchPage(FETCH_PAGE, 0);
  const total = first.total ?? first.items.length;
  const extraOffsets: number[] = [];
  for (let next = FETCH_PAGE; next < total; next += FETCH_PAGE) {
    extraOffsets.push(next);
  }
  const extra = extraOffsets.length
    ? await Promise.all(extraOffsets.map((pageOffset) => fetchPage(FETCH_PAGE, pageOffset)))
    : [];
  const items = [first, ...extra]
    .flatMap((page) => page.items)
    .sort((left, right) => {
      const result = identificationValue(left).localeCompare(
        identificationValue(right),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
      return descending ? -result : result;
    });
  return {
    ...first,
    items: items.slice(offset, offset + pageSize),
    total,
    limit: pageSize,
    offset,
  };
}

export async function fetchEmployeeFileSummaryPage(params: {
  groupId?: number;
  search?: string;
  department_id?: number | string;
  pageSize: number;
  offset: number;
  order?: string;
  attention_filter?: string;
}): Promise<EmployeeFileSummaryPage> {
  const order = params.order || "name asc";
  const descending = order.includes("desc");
  if (order.startsWith("identification")) {
    if (params.groupId) {
      return paginateAllEmployeeFiles(
        (limit, offset) =>
          api.listEmployeeGroupMembers(params.groupId!, {
            search: params.search,
            limit,
            offset,
            order: "name asc",
            attention_filter: params.attention_filter,
          }),
        params.pageSize,
        params.offset,
        descending,
      );
    }
    return paginateAllEmployeeFiles(
      (limit, offset) =>
        api.listEmployeeFileSummaries({
          search: params.search,
          department_id: params.department_id,
          limit,
          offset,
          order: "name asc",
          attention_filter: params.attention_filter,
        }),
      params.pageSize,
      params.offset,
      descending,
    );
  }
  if (params.groupId) {
    return api.listEmployeeGroupMembers(params.groupId, {
      search: params.search,
      limit: params.pageSize,
      offset: params.offset,
      order,
      attention_filter: params.attention_filter,
    });
  }
  return api.listEmployeeFileSummaries({
    search: params.search,
    department_id: params.department_id,
    limit: params.pageSize,
    offset: params.offset,
    order,
    attention_filter: params.attention_filter,
  });
}
