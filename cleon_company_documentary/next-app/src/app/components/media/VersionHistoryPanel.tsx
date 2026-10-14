"use client";

import { LoaderCircle } from "lucide-react";
import { useDocumentaryVersions } from "../../../../hooks/useDocumentary";
import { formatDuration } from "../documentaryUtils";

export function VersionHistoryPanel({ mediaId }: { mediaId: number }) {
  const query = useDocumentaryVersions(mediaId);

  if (query.isLoading) {
    return (
      <div className="panel-loading">
        <LoaderCircle className="spin" size={18} />
        <span>Loading versions…</span>
      </div>
    );
  }
  if (query.isError) {
    return <p className="panel-error">Version history could not be loaded.</p>;
  }
  const versions = query.data ?? [];
  if (!versions.length) {
    return <p className="panel-muted">No version history yet.</p>;
  }

  return (
    <div className="version-history-table-wrap">
      <table className="version-history-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Note</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id}>
              <td>
                v{version.version_number}
                {version.is_live ? <span className="live-pill">Live</span> : null}
                <div className="version-meta">
                  {formatDuration(version.duration_seconds)}
                  {version.resolution ? ` · ${version.resolution}` : ""}
                </div>
              </td>
              <td>{version.is_live ? "Published" : "Archived"}</td>
              <td>{version.change_note || "—"}</td>
              <td>{version.created_by_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
