"use client";

import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ListPagination from "./ListPagination";
import SectionTabs from "./SectionTabs";
import AppToolbar from "./AppToolbar";
import EmptyState from "./EmptyState";
import PersonCell from "./PersonCell";
import StatusPill from "./StatusPill";
import EmployeeFileIssueCell from "./EmployeeFileIssueCell";
import { api } from "../../../lib/api";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import {
  useEmployeeFileIssueAction,
  useEmployeeFileIssues,
  useEmployeeFilesHomeStats,
} from "../../../hooks/useEmployeeFiles";

const PAGE_CLASS =
  "app-page space-y-6";

const TABS = [
  { id: "all", label: "All" },
  { id: "excluded", label: "Excluded" },
  { id: "inactive", label: "Inactive" },
  { id: "initialization_failed", label: "Initialization failed" },
  { id: "unresolved_data", label: "Unresolved data issue" },
];

function categoryFromParams(value: string | null) {
  if (value && TABS.some((tab) => tab.id === value)) {
    return value;
  }
  return "all";
}

export default function EmployeeFilesIssuesPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState(() =>
    categoryFromParams(searchParams.get("category")),
  );

  const setCategoryAndUrl = (next: string) => {
    setCategory(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("category");
    } else {
      params.set("category", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const issues = useEmployeeFileIssues(
    category,
    page,
    EMPLOYEE_FILE_LIST_PAGE_SIZE,
    search,
  );

  useEffect(() => {
    setCategory(categoryFromParams(searchParams.get("category")));
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [category, search]);
  const stats = useEmployeeFilesHomeStats();
  const action = useEmployeeFileIssueAction();

  const rows = issues.data?.data ?? [];
  const listTotal = issues.data?.total ?? 0;
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of issues.data?.summary.categories ?? []) {
      map.set(row.category, row.count);
    }
    return map;
  }, [issues.data?.summary.categories]);

  return (
    <div className={embedded ? "space-y-6" : PAGE_CLASS}>
      {stats.data ? (
        <div className="app-page-metrics">
          <div className="app-page-metric">
            <span>EMS employees</span>
            <strong>{stats.data.ems_employees}</strong>
          </div>
          <div className="app-page-metric">
            <span>Employee files</span>
            <strong>{stats.data.employee_files_initialized}</strong>
          </div>
          <div className="app-page-metric">
            <span>Synced</span>
            <strong>{stats.data.successfully_synced}</strong>
          </div>
          <div className="app-page-metric">
            <span>Needs attention</span>
            <strong>{stats.data.needs_attention}</strong>
          </div>
        </div>
      ) : null}

      <SectionTabs
        level="nested"
        ariaLabel="Issue classifications"
        value={category}
        onChange={setCategoryAndUrl}
        items={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          count: tab.id === "all" ? undefined : categoryCounts.get(tab.id),
        }))}
      />
      <div className="app-table-well app-page-body">
        <AppToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search by employee name, issue title, department, or employee ID…"
          actions={
            <button
              type="button"
              onClick={() => api.downloadEmployeeFileIssuesReport()}
              className="app-btn app-btn-secondary"
            >
              <Download className="h-4 w-4" />
              Download report
            </button>
          }
        />
        {issues.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-pink" />
            Loading issues…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No open items in this category"
            description={
              search.trim()
                ? "No issues match your search in this category."
                : category === "all"
                  ? "Everything reconciled for now."
                  : "Try another category or return after the next EMS sync."
            }
            action={
              !embedded ? (
                <Link href="/pages/employee" className="app-btn app-btn-primary">
                  Open Employee Files
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="ef-table ef-table--issues min-w-full" data-no-sort="true">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Employee</th>
                    <th>Details</th>
                    <th className="dms-col-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((issue) => {
                    const classification =
                      issue.source === "exclusion"
                        ? "excluded"
                        : issue.classification ??
                          issue.category ??
                          "unresolved_data";
                    const classificationLabel =
                      issue.source === "exclusion"
                        ? "Excluded"
                        : issue.classification_label ??
                          TABS.find((t) => t.id === classification)?.label ??
                          classification.replace(/_/g, " ");
                    const rowKey = `${issue.source ?? "issue"}-${issue.id}`;

                    return (
                      <tr key={rowKey}>
                        <td className="ef-issue-col">
                          <EmployeeFileIssueCell
                            issue={issue}
                            classificationLabel={classificationLabel}
                          />
                        </td>
                        <td className="ef-issue-employee align-top">
                          {issue.employee_id ? (
                            <PersonCell
                              name={
                                issue.employee_name || `Employee #${issue.employee_id}`
                              }
                              href={`/pages/employee/profile?employee=${issue.employee_id}`}
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="ef-issue-details align-top text-slate-600">
                          <p>{issue.details || "—"}</p>
                        </td>
                        <td className="dms-col-actions">
                          {issue.source === "exclusion" ? (
                            <StatusPill label="Excluded" />
                          ) : issue.recommended_action === "view_in_ems" ? (
                            <StatusPill label="View in EMS" />
                          ) : issue.recommended_action === "none" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <button
                              type="button"
                              disabled={action.isPending}
                              className="app-btn app-btn-secondary"
                              onClick={() =>
                                action.mutate({
                                  id: issue.id,
                                  action: issue.recommended_action,
                                })
                              }
                            >
                              {issue.recommended_action === "retry"
                                ? "Retry"
                                : issue.recommended_action === "sync_now"
                                  ? "Sync now"
                                  : "Resolve"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <ListPagination
                page={page}
                pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
                total={listTotal}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
