"use client";

import { Download, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { DocumentaryFolder } from "../../../../lib/types";
import { useDocumentaryAnalytics } from "../../../../hooks/useDocumentary";
import {
  AnalyticsDepartments,
  AnalyticsEngagement,
  AnalyticsOverview,
  AnalyticsTrends,
} from "./AnalyticsTabs";

type AnalyticsTab = "overview" | "departments" | "engagement" | "trends";

export function AnalyticsDashboard({
  folders,
  onClose,
}: {
  folders: DocumentaryFolder[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [dateFrom, setDateFrom] = useState(() =>
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  );
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [departmentId, setDepartmentId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [mediaId, setMediaId] = useState("");
  const filters = {
    date_from: dateFrom,
    date_to: dateTo,
    ...(departmentId ? { department_id: Number(departmentId) } : {}),
    ...(folderId ? { folder_id: Number(folderId) } : {}),
    ...(mediaId ? { media_id: Number(mediaId) } : {}),
  };
  const query = useDocumentaryAnalytics(filters, true);
  const data = query.data;

  function exportReport() {
    if (!data) return;
    const rows = [
      [
        "Department",
        "Eligible employees",
        "Unique viewers",
        "Viewer rate",
        "Total views",
        "Average watch seconds",
        "Average completion",
        "Performance",
      ],
      ...data.departments.map((row) => [
        row.name,
        row.eligible_employees,
        row.unique_viewers,
        `${row.viewer_rate}%`,
        row.total_views,
        row.average_watch_seconds,
        `${row.average_completion}%`,
        row.performance,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `company-documentary-analytics-${dateFrom}-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="analytics-backdrop">
      <section className="analytics-shell" aria-label="Library analytics">
        <header className="analytics-header">
          <div>
            <div className="eyebrow">Manager workspace</div>
            <h2>Library analytics</h2>
            <p>
              Understand reach, learning effectiveness, and the content your
              company needs next.
            </p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close analytics"
          >
            <X size={18} />
          </button>
        </header>
        <div className="analytics-toolbar">
          <label>
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <label>
            Department
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">All departments</option>
              {data?.departments
                .filter((row) => row.id)
                .map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Folder
            <select
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
            >
              <option value="">All folders</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Video
            <select
              value={mediaId}
              onChange={(event) => setMediaId(event.target.value)}
            >
              <option value="">All videos</option>
              {data?.content_performance.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                </option>
              ))}
            </select>
          </label>
          <span className="analytics-freshness">
            <span className="status-dot" />{" "}
            {query.isFetching
              ? "Refreshing"
              : `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </span>
          <button
            className="secondary-button"
            onClick={exportReport}
            disabled={!data}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
        <nav className="analytics-tabs">
          {(
            [
              ["overview", "Overview"],
              ["departments", "Departments"],
              ["engagement", "Engagement"],
              ["trends", "Trends"],
            ] as [AnalyticsTab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="analytics-body">
          {query.isLoading && (
            <div className="analytics-loading">
              <LoaderCircle className="spin" size={24} /> Building the report…
            </div>
          )}
          {!query.isLoading && data && tab === "overview" && (
            <AnalyticsOverview data={data} />
          )}
          {!query.isLoading && data && tab === "departments" && (
            <AnalyticsDepartments data={data} />
          )}
          {!query.isLoading && data && tab === "engagement" && (
            <AnalyticsEngagement data={data} />
          )}
          {!query.isLoading && data && tab === "trends" && (
            <AnalyticsTrends data={data} />
          )}
          {query.isError && (
            <div className="analytics-error">
              <X size={17} /> Analytics could not be loaded. Try refreshing the
              date range.
            </div>
          )}
        </div>
        <footer className="analytics-footer">
          <ShieldCheck size={15} />
          <span>
            Analytics are aggregated for authorized managers and administrators.
            Individual employee watch histories are not displayed.
          </span>
        </footer>
      </section>
    </div>
  );
}
