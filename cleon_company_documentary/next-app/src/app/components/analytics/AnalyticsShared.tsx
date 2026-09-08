"use client";

import type { DocumentaryAnalyticsDashboard } from "../../../../lib/types";

export function formatAnalyticsDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function TrendList({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: DocumentaryAnalyticsDashboard["content_performance"];
}) {
  return (
    <div className="analytics-panel trend-list">
      <h3>{title}</h3>
      <p>{description}</p>
      {rows.map((row) => (
        <div className="trend-row" key={row.id}>
          <span>
            <strong>{row.title}</strong>
            <small>{row.folder_name}</small>
          </span>
          <b>{row.total_views.toLocaleString()} views</b>
          <em>{row.completion_rate.toFixed(0)}%</em>
        </div>
      ))}
      {!rows.length && (
        <span className="form-hint">No data for this period.</span>
      )}
    </div>
  );
}

export function ContentTable({
  rows,
}: {
  rows: DocumentaryAnalyticsDashboard["content_performance"];
}) {
  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>Video</th>
            <th>Views</th>
            <th>Unique viewers</th>
            <th>Watch time</th>
            <th>Completion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.title}</strong>
                <small className="table-subtitle">
                  {row.folder_name}
                  {row.mandatory ? " · Mandatory" : ""}
                </small>
              </td>
              <td>{row.total_views}</td>
              <td>{row.unique_viewers}</td>
              <td>{formatAnalyticsDuration(row.watch_seconds)}</td>
              <td>
                <div className="table-progress">
                  <i style={{ width: `${row.completion_rate}%` }} />
                  <span>{row.completion_rate.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
