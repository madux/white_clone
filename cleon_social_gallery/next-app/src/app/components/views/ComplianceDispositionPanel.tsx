"use client";

import { useEffect, useState } from "react";
import { Scale, Shield } from "lucide-react";
import type { DisposalRecord, GalleryMedia } from "@/lib/types";
import { api, formatDate } from "@/lib/api";
import { MediaThumb } from "../shared/MediaThumb";
import { LoadingState } from "../shared/LoadingState";

export default function ComplianceDispositionPanel({
  onError,
}: {
  onError?: (message: string) => void;
}) {
  const [due, setDue] = useState<GalleryMedia[]>([]);
  const [records, setRecords] = useState<DisposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dueItems, disposal] = await Promise.all([
        api.complianceDispositionList(),
        api.complianceDisposalRecords(),
      ]);
      setDue(dueItems);
      setRecords(disposal);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runDisposition = async (action: "approve" | "dismiss", mediaIds: number[]) => {
    if (!mediaIds.length) return;
    setBusy(true);
    try {
      await api.complianceDispositionAction(action, mediaIds);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Disposition action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading compliance queue…" />;

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <Scale size={18} />
        <div>
          <div className="eyebrow">Retention</div>
          <h2>Disposition review</h2>
        </div>
      </div>
      <p className="meta-muted">
        Items due for permanent deletion require administrator approval when disposition review is enabled.
      </p>
      {due.length === 0 ? (
        <p className="meta-muted">No media is waiting for disposition approval.</p>
      ) : (
        <div className="stack-list">
          {due.map((item) => (
            <div key={item.id} className="approval-row">
              <MediaThumb media={item} />
              <div className="profile-copy">
                <strong>{item.display_name}</strong>
                <span>{item.album_name}</span>
                {item.purge_date && <span className="meta-muted">Purge after {formatDate(item.purge_date)}</span>}
                {item.legal_hold && (
                  <span className="status-badge pending">
                    <Shield size={12} /> Legal hold
                  </span>
                )}
              </div>
              <div className="media-list-actions">
                <button
                  type="button"
                  className="secondary-button small"
                  disabled={busy || item.legal_hold}
                  onClick={() => runDisposition("dismiss", [item.id])}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="primary-button small"
                  disabled={busy || item.legal_hold}
                  onClick={() => runDisposition("approve", [item.id])}
                >
                  Approve disposal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>Recent disposal records</h3>
      {records.length === 0 ? (
        <p className="meta-muted">No permanent deletions recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Media</th>
              <th>Album</th>
              <th>Purged</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr key={row.id}>
                <td>{row.media_name || `#${row.media_id}`}</td>
                <td>{row.album_name || "—"}</td>
                <td>{formatDate(row.purged_at)}</td>
                <td>{row.retention_rule || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
