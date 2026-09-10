"use client";

import { Download, LoaderCircle, Maximize2, Minimize2, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import type { ComplianceMandatoryFilter, DocumentaryFolder } from "../../../../lib/types";
import { useDocumentaryAnalytics } from "../../../../hooks/useDocumentary";
import {
  AnalyticsCompliance,
  type ComplianceExportState,
} from "./AnalyticsCompliance";
import {
  AnalyticsDepartments,
  AnalyticsEngagement,
  AnalyticsOverview,
  AnalyticsTrends,
} from "./AnalyticsTabs";

type AnalyticsTab = "overview" | "departments" | "engagement" | "trends" | "compliance";

export function AnalyticsDashboard({
  folders,
  onClose,
}: {
  folders: DocumentaryFolder[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [complianceMandatory, setComplianceMandatory] =
    useState<ComplianceMandatoryFilter>("all");
  const [complianceExport, setComplianceExport] = useState<ComplianceExportState>({
    mediaId: null,
    employeeSearch: "",
    status: "all",
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleClose = useCallback(() => {
    setIsFullscreen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose, isFullscreen]);
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
  const query = useDocumentaryAnalytics(filters, tab !== "compliance");
  const data = query.data;
  async function exportReport() {
    if (tab === "compliance") {
      if (!complianceExport.mediaId) return;
      const report = await api.complianceReport({
        ...(departmentId ? { department_id: Number(departmentId) } : {}),
        ...(folderId ? { folder_id: Number(folderId) } : {}),
        media_id: complianceExport.mediaId,
        mandatory: complianceMandatory,
        status: complianceExport.status,
        search: complianceExport.employeeSearch,
        page: 1,
        page_size: 5000,
      });
      const rows = [
        [
          "Employee",
          "Department",
          "Folder",
          "Video",
          "Mandatory",
          "Status",
          "Completion %",
          "Views",
          "Last watched",
          "Completed at",
        ],
        ...report.rows.map((row) => [
          row.employee_name,
          row.department_name,
          row.folder_name,
          row.media_title,
          row.mandatory ? "Yes" : "No",
          row.status,
          row.completion_percent,
          row.view_count,
          row.last_watched_at || "",
          row.completed_at || "",
        ]),
      ];
      const videoSlug = report.rows[0]?.media_title?.replace(/[^\w.-]+/g, "-") || "video";
      downloadCsv(
        rows,
        `company-documentary-compliance-${videoSlug}-${dateFrom}-${dateTo}.csv`,
      );
      return;
    }
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
    downloadCsv(rows, `company-documentary-analytics-${dateFrom}-${dateTo}.csv`);
  }

  function downloadCsv(rows: unknown[][], filename: string) {
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
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`analytics-backdrop${isFullscreen ? " is-fullscreen" : ""}`}>
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
          <div className="modal-header-actions">
            <button
              type="button"
              className="modal-icon-button"
              onClick={() => setIsFullscreen((current) => !current)}
              aria-label={isFullscreen ? "Exit full screen" : "Maximize full screen"}
              title={isFullscreen ? "Exit full screen" : "Maximize full screen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              className="modal-close"
              onClick={handleClose}
              aria-label="Close analytics"
            >
              <X size={18} />
            </button>
          </div>
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
            onClick={() => void exportReport()}
            disabled={tab === "compliance" ? !complianceExport.mediaId : !data}
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
              ["compliance", "Compliance"],
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
          {tab !== "compliance" && query.isLoading && (
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
          {tab === "compliance" && (
            <AnalyticsCompliance
              departmentId={departmentId ? Number(departmentId) : undefined}
              folderId={folderId ? Number(folderId) : undefined}
              initialMandatory={complianceMandatory}
              onExportStateChange={setComplianceExport}
            />
          )}
          {tab !== "compliance" && query.isError && (
            <div className="analytics-error">
              <X size={17} /> Analytics could not be loaded. Try refreshing the
              date range.
            </div>
          )}
        </div>
        <footer className="analytics-footer">
          <ShieldCheck size={15} />
          <span>
            Analytics are available to authorized managers and administrators.
            The Compliance tab shows per-employee training status for oversight.
          </span>
        </footer>
      </section>
    </div>
  );
}
