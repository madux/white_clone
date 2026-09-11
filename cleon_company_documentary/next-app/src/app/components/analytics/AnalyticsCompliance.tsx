"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Search,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDocumentaryCompliance } from "../../../../hooks/useDocumentary";
import type {
  ComplianceMandatoryFilter,
  ComplianceRow,
  ComplianceStatus,
  ComplianceVideoSummary,
} from "../../../../lib/types";

function formatWhen(value: string | false | null) {
  if (!value) return "—";
  return new Date(String(value).replace(" ", "T")).toLocaleString();
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const labels: Record<ComplianceStatus, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Completed",
  };
  return (
    <span className={`compliance-status-badge ${status}`}>
      {labels[status]}
    </span>
  );
}

function ComplianceDonut({ video }: { video: ComplianceVideoSummary }) {
  const total = Math.max(
    video.completed_count + video.in_progress_count + video.not_started_count,
    1,
  );
  const completedAngle = (video.completed_count / total) * 360;
  const inProgressAngle = (video.in_progress_count / total) * 360;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const completedLen = (completedAngle / 360) * circumference;
  const inProgressLen = (inProgressAngle / 360) * circumference;
  const notStartedLen = circumference - completedLen - inProgressLen;

  return (
    <div className="compliance-donut">
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#fef3c7"
          strokeWidth="14"
          strokeDasharray={`${notStartedLen} ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(-90 60 60)"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#dbeafe"
          strokeWidth="14"
          strokeDasharray={`${inProgressLen} ${circumference}`}
          strokeDashoffset={`${-notStartedLen}`}
          transform="rotate(-90 60 60)"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth="14"
          strokeDasharray={`${completedLen} ${circumference}`}
          strokeDashoffset={`${-(notStartedLen + inProgressLen)}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="56" textAnchor="middle" className="compliance-donut-value">
          {video.completion_rate.toFixed(0)}%
        </text>
        <text x="60" y="72" textAnchor="middle" className="compliance-donut-label">
          complete
        </text>
      </svg>
      <div className="compliance-donut-legend">
        <span><i className="legend-completed" /> {video.completed_count} completed</span>
        <span><i className="legend-progress" /> {video.in_progress_count} in progress</span>
        <span><i className="legend-pending" /> {video.not_started_count} not started</span>
      </div>
    </div>
  );
}

export type ComplianceExportState = {
  mediaId: number | null;
  employeeSearch: string;
  status: "all" | ComplianceStatus;
};

export function AnalyticsCompliance({
  departmentId,
  folderId,
  initialMandatory = "all",
  onExportStateChange,
}: {
  departmentId?: number;
  folderId?: number;
  initialMandatory?: ComplianceMandatoryFilter;
  onExportStateChange?: (state: ComplianceExportState) => void;
}) {
  const [mandatory, setMandatory] = useState<ComplianceMandatoryFilter>(initialMandatory);
  const [status, setStatus] = useState<"all" | ComplianceStatus>("all");
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setMandatory(initialMandatory);
  }, [initialMandatory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmployeeSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    onExportStateChange?.({
      mediaId: selectedMediaId,
      employeeSearch,
      status,
    });
  }, [selectedMediaId, employeeSearch, status, onExportStateChange]);

  const filters = useMemo(
    () => ({
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(folderId ? { folder_id: folderId } : {}),
      ...(selectedMediaId ? { media_id: selectedMediaId } : {}),
      mandatory,
      status,
      search: employeeSearch,
      page,
      page_size: pageSize,
    }),
    [
      departmentId,
      folderId,
      selectedMediaId,
      mandatory,
      status,
      employeeSearch,
      page,
    ],
  );

  const libraryQuery = useDocumentaryCompliance(
    {
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(folderId ? { folder_id: folderId } : {}),
      mandatory,
      page: 1,
      page_size: 1,
    },
    true,
  );

  const detailQuery = useDocumentaryCompliance(filters, !!selectedMediaId);
  const library = libraryQuery.data?.library ?? [];
  const data = detailQuery.data;
  const videoSummary = data?.video_summary;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.page_size))
    : 1;

  useEffect(() => {
    if (selectedMediaId) return;
    const firstVideo = library[0]?.videos[0];
    if (firstVideo) {
      setSelectedMediaId(firstVideo.media_id);
      setExpandedFolders((current) => ({
        ...current,
        [library[0].folder_id]: true,
      }));
    }
  }, [library, selectedMediaId]);

  useEffect(() => {
    setPage(1);
  }, [selectedMediaId, mandatory, status, departmentId, folderId]);

  function toggleFolder(folderIdValue: number) {
    setExpandedFolders((current) => ({
      ...current,
      [folderIdValue]: !current[folderIdValue],
    }));
  }

  return (
    <div className="analytics-tab-content">
      <div className="compliance-summary-grid">
        {[
          ["Eligible assignments", libraryQuery.data?.summary.eligible_assignments],
          ["Completed", libraryQuery.data?.summary.completed],
          ["In progress", libraryQuery.data?.summary.in_progress],
          ["Not started", libraryQuery.data?.summary.not_started],
          ["Mandatory pending", libraryQuery.data?.summary.mandatory_pending],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={`analytics-metric${index === 0 ? " is-primary" : ""}`}
          >
            <span>{label}</span>
            <strong>{value?.toLocaleString() ?? "—"}</strong>
          </div>
        ))}
      </div>

      <div className="compliance-toolbar">
        <label>
          Training type
          <select
            value={mandatory}
            onChange={(event) => {
              setMandatory(event.target.value as ComplianceMandatoryFilter);
              setSelectedMediaId(null);
            }}
          >
            <option value="all">All</option>
            <option value="mandatory">Mandatory only</option>
            <option value="optional">Optional only</option>
          </select>
        </label>
        <label>
          Employee status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "all" | ComplianceStatus);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      <div className="compliance-library-layout">
        <aside className="analytics-panel compliance-library-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Video library</h3>
              <p>Browse folders and select a video to inspect employee compliance.</p>
            </div>
          </div>
          {libraryQuery.isLoading ? (
            <div className="analytics-loading inline">Loading library…</div>
          ) : !library.length ? (
            <p className="sidebar-empty">No videos match the current filters.</p>
          ) : (
            <div className="compliance-folder-accordion">
              {library.map((folder) => {
                const expanded = expandedFolders[folder.folder_id] ?? true;
                return (
                  <div className="compliance-folder-block" key={folder.folder_id}>
                    <button
                      type="button"
                      className="compliance-folder-header"
                      onClick={() => toggleFolder(folder.folder_id)}
                    >
                      <Folder size={15} />
                      <span>{folder.folder_name}</span>
                      <small>{folder.videos.length}</small>
                      <ChevronDown
                        size={15}
                        className={expanded ? "expanded" : ""}
                      />
                    </button>
                    {expanded && (
                      <div className="compliance-video-list">
                        {folder.videos.map((video) => (
                          <button
                            key={video.media_id}
                            type="button"
                            className={`compliance-video-row${selectedMediaId === video.media_id ? " selected" : ""}`}
                            onClick={() => setSelectedMediaId(video.media_id)}
                          >
                            <Video size={14} />
                            <div className="compliance-video-copy">
                              <strong>{video.title}</strong>
                              <div className="compliance-video-meta">
                                <span
                                  className={
                                    video.mandatory
                                      ? "compliance-mandatory-pill"
                                      : "compliance-optional-pill"
                                  }
                                >
                                  {video.mandatory ? "Mandatory" : "Optional"}
                                </span>
                                <span>{video.completed_count}/{video.audience_count} completed</span>
                              </div>
                              <div className="compliance-mini-progress">
                                <i style={{ width: `${video.completion_rate}%` }} />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <section className="analytics-panel table-panel compliance-detail-panel">
          {!selectedMediaId || !videoSummary ? (
            <div className="analytics-loading inline">
              Select a video from the library to view employee compliance.
            </div>
          ) : (
            <>
              <div className="compliance-detail-header">
                <div>
                  <h3>{videoSummary.title}</h3>
                  <p>
                    {videoSummary.mandatory ? "Mandatory training" : "Optional training"} ·{" "}
                    {videoSummary.completion_threshold}% required to complete ·{" "}
                    {videoSummary.audience_count} employees in scope
                  </p>
                </div>
                <ComplianceDonut video={videoSummary} />
              </div>

              <label className="compliance-search">
                <Search size={15} />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search employee or department"
                />
              </label>

              <div className="analytics-panel-heading compact">
                <div>
                  <h3>Employee roster</h3>
                  <p>First {pageSize} employees per page for this video.</p>
                </div>
                {data && (
                  <span className="form-hint">
                    Showing {data.rows.length} of {data.total.toLocaleString()}
                  </span>
                )}
              </div>

              {detailQuery.isLoading ? (
                <div className="analytics-loading inline">Loading employees…</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table compliance-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Completion</th>
                        <th>Last watched</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.rows.map((row) => (
                        <ComplianceEmployeeRow key={row.employee_id} row={row} />
                      ))}
                    </tbody>
                  </table>
                  {!data?.rows.length && (
                    <p className="sidebar-empty">No employees match this search.</p>
                  )}
                </div>
              )}

              {data && data.total > pageSize && (
                <div className="compliance-pagination">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ComplianceEmployeeRow({ row }: { row: ComplianceRow }) {
  return (
    <tr>
      <td><strong>{row.employee_name}</strong></td>
      <td>{row.department_name}</td>
      <td><StatusBadge status={row.status} /></td>
      <td>
        <div className="table-progress">
          <i style={{ width: `${row.completion_percent}%` }} />
          <span>{row.completion_percent.toFixed(1)}%</span>
        </div>
      </td>
      <td>{formatWhen(row.last_watched_at)}</td>
    </tr>
  );
}
