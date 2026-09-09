"use client";

import {
  Clock3, HardDrive, Images, LayoutGrid, MessageCircle, TrendingUp,
} from "lucide-react";
import type { GalleryDashboard } from "@/lib/types";
import { formatBytes } from "@/lib/api";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { initials, relativeTime } from "../galleryUtils";

export default function DashboardView({
  data,
  loading,
  onOpenPending,
  onOpenAlbum,
}: {
  data?: GalleryDashboard;
  loading: boolean;
  onOpenPending: () => void;
  onOpenAlbum: (id: number) => void;
}) {
  if (loading || !data) {
    return (
      <div>
        <div className="analytics-metric-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-metric" />
          ))}
        </div>
        <LoadingGrid count={2} cols={3} />
      </div>
    );
  }

  const maxUploads = Math.max(...data.top_contributors.map((c) => c.uploads), 1);
  const maxDeptUploads = Math.max(...data.department_engagement.map((d) => d.uploads), 1);

  return (
    <div>
      <div className="analytics-metric-grid">
        <div className="analytics-metric rose">
          <span><Images size={16} /></span>
          <strong>{data.total_albums}</strong>
          <small>Total Albums</small>
        </div>
        <div className="analytics-metric blue">
          <span><LayoutGrid size={16} /></span>
          <strong>{data.total_media}</strong>
          <small>Total Media</small>
        </div>
        <div className="analytics-metric orange">
          <span><Clock3 size={16} /></span>
          <strong>{data.pending_approvals}</strong>
          <small>
            Pending Approvals
            {data.pending_approvals > 0 && (
              <>
                {" · "}
                <button type="button" className="text-button" onClick={onOpenPending}>Review</button>
              </>
            )}
          </small>
        </div>
        <div className="analytics-metric green">
          <span><HardDrive size={16} /></span>
          <strong>{formatBytes(data.storage_used)}</strong>
          <small>Storage Used</small>
        </div>
        <div className="analytics-metric blue">
          <span><Images size={16} /></span>
          <strong>{data.photo_count}</strong>
          <small>Photos</small>
        </div>
        <div className="analytics-metric rose">
          <span><LayoutGrid size={16} /></span>
          <strong>{data.video_count}</strong>
          <small>Videos</small>
        </div>
        <div className="analytics-metric orange">
          <span><Clock3 size={16} /></span>
          <strong>{data.today_uploads}</strong>
          <small>Uploaded Today</small>
        </div>
      </div>

      <div className="analytics-two-column section-block">
        <div className="analytics-panel">
          <div className="section-heading">
            <div>
              <h2>Recent Albums</h2>
              <p>Latest collections in your gallery</p>
            </div>
          </div>
          {data.recent_albums.length === 0 ? (
            <EmptyState icon={Images} title="No albums yet" description="Create an album to start organizing media." />
          ) : (
            <div className="stack-list">
              {data.recent_albums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  className="recent-album-row"
                  onClick={() => onOpenAlbum(album.id)}
                >
                  <div className="recent-album-thumb"><Images size={18} /></div>
                  <div className="profile-copy">
                    <strong>{album.name}</strong>
                    <span>{album.media_count} items</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="analytics-panel">
          <div className="section-heading">
            <div>
              <h2>Top Contributors</h2>
              <p>Most active uploaders this period</p>
            </div>
          </div>
          {data.top_contributors.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No activity yet" description="Contributors will appear here after uploads." />
          ) : (
            data.top_contributors.map((contributor) => (
              <div key={contributor.name} className="contributor-row">
                <div className="avatar">{initials(contributor.name)}</div>
                <div className="profile-copy">
                  <strong>{contributor.name}</strong>
                  <span>{contributor.uploads} uploads</span>
                </div>
                <div className="contributor-bar">
                  <i style={{ width: `${(contributor.uploads / maxUploads) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="analytics-panel section-block">
        <div className="section-heading">
          <div>
            <h2>Department Engagement</h2>
            <p>Uploads, likes, and comments by department</p>
          </div>
        </div>
        {data.department_engagement.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No department data" description="Engagement metrics will populate as teams participate." />
        ) : (
          <div className="department-bars">
            {data.department_engagement.map((row) => (
              <div key={row.department} className="department-bar-row">
                <span>{row.department}</span>
                <div><i style={{ width: `${(row.uploads / maxDeptUploads) * 100}%` }} /></div>
                <strong>{row.uploads}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="analytics-panel section-block">
        <div className="section-heading">
          <div>
            <h2>Recent Activity</h2>
            <p>Latest gallery events</p>
          </div>
        </div>
        {data.recent_activity.length === 0 ? (
          <EmptyState icon={Clock3} title="No activity yet" description="Audit events will appear here." />
        ) : (
          data.recent_activity.map((log, index) => (
            <div key={index} className="activity-row">
              <span className="status-badge pending">{log.event_type}</span>
              <div className="profile-copy">
                <strong>{log.user_name}</strong>
                <span>{log.details || log.entity_type} · {relativeTime(log.create_date)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
