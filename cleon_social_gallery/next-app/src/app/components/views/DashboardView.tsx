"use client";

import {
  Clock3,
  Heart,
  Images,
  LayoutGrid,
  MessageCircle,
  Plus,
  TrendingUp,
} from "lucide-react";
import type { GalleryDashboard, GalleryMedia } from "@/lib/types";
import { formatBytes } from "@/lib/api";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { AlbumCover } from "../shared/AlbumCover";
import { MediaThumb } from "../shared/MediaThumb";
import { greeting, initials } from "../galleryUtils";

function UploadTrendLineChart({
  points,
}: {
  points: Array<{ date: string; label: string; count: number }>;
}) {
  if (!points.length) return null;

  const width = 280;
  const height = 72;
  const padX = 4;
  const padY = 8;
  const max = Math.max(...points.map((point) => point.count), 1);

  const coords = points.map((point, index) => {
    const x = padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y = height - padY - (point.count / max) * (height - padY * 2);
    return { x, y, ...point };
  });

  const linePoints = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const areaPoints = [
    `${padX},${height - padY}`,
    linePoints,
    `${coords[coords.length - 1].x},${height - padY}`,
  ].join(" ");

  return (
    <div className="dash-upload-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Uploads over the last 7 days">
        <defs>
          <linearGradient id="upload-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e83e8c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#e83e8c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#upload-chart-fill)" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="#e83e8c"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((coord, index) => (
          coord.count > 0 ? (
            <circle key={coord.date} cx={coord.x} cy={coord.y} r="2.75" fill="#e83e8c" />
          ) : (
            <circle key={coord.date} cx={coord.x} cy={coord.y} r="1.75" fill="#f3c4dc" opacity={index === coords.length - 1 ? 1 : 0.6} />
          )
        ))}
      </svg>
      <div className="dash-upload-chart-axis" aria-hidden="true">
        {points.map((point) => (
          <span key={point.date}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardView({
  data,
  loading,
  userName,
  isManager,
  pendingCount,
  onOpenPending,
  onOpenAlbum,
  onOpenMedia,
  onBrowseGallery,
  onCreateAlbum,
}: {
  data?: GalleryDashboard;
  loading: boolean;
  userName?: string;
  isManager?: boolean;
  pendingCount?: number;
  onOpenPending: () => void;
  onOpenAlbum: (id: number) => void;
  onOpenMedia: (media: GalleryMedia, list?: GalleryMedia[]) => void;
  onBrowseGallery: () => void;
  onCreateAlbum?: () => void;
}) {
  if (loading || !data) {
    return (
      <div className="dash-home">
        <div className="skeleton-hero" />
        <div className="dash-kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-metric" />
          ))}
        </div>
        <LoadingGrid count={4} cols={4} />
      </div>
    );
  }

  const totalLikes = data.total_likes ?? 0;
  const totalComments = data.total_comments ?? 0;
  const weekUploads = data.week_uploads ?? data.today_uploads ?? 0;
  const uploadTrend = data.upload_trend || [];
  const mediaStrip = data.trending_media?.length ? data.trending_media : data.recent_media || [];

  return (
    <div className="dash-home">
      <section className="dash-hero analytics-panel">
        <div className="dash-hero-copy">
          <p className="dash-eyebrow">Social Gallery</p>
          <h1>{greeting(userName)}</h1>
          <p>See what&apos;s new, what&apos;s trending, and where your team is engaging.</p>
          <div className="dash-hero-actions">
            <button type="button" className="secondary-button" onClick={onBrowseGallery}>
              <LayoutGrid size={16} />
              Browse gallery
            </button>
            {onCreateAlbum && (
              <button type="button" className="primary-button" onClick={onCreateAlbum}>
                <Plus size={16} />
                New album
              </button>
            )}
          </div>
        </div>
        {isManager && pendingCount ? (
          <div className="dash-manager-queue">
            <button type="button" className="dash-queue-card" onClick={onOpenPending}>
              <Clock3 size={18} />
              <strong>{pendingCount}</strong>
              <span>Pending review</span>
            </button>
          </div>
        ) : null}
      </section>

      <section className="dash-kpi-grid">
        <article className="dash-kpi primary">
          <span className="dash-kpi-label"><LayoutGrid size={15} /> Total media</span>
          <strong>{data.total_media}</strong>
          <small>{data.photo_count} photos · {data.video_count} videos</small>
          {data.today_uploads > 0 && <span className="dash-delta">+{data.today_uploads} today</span>}
        </article>
        <article className="dash-kpi">
          <span className="dash-kpi-label"><Heart size={15} /> Engagement</span>
          <strong>{totalLikes + totalComments}</strong>
          <small>{totalLikes} likes · {totalComments} comments</small>
        </article>
        <article className="dash-kpi">
          <span className="dash-kpi-label"><Images size={15} /> Albums</span>
          <strong>{data.total_albums}</strong>
          <small>{formatBytes(data.storage_used)} used</small>
        </article>
        <article className="dash-kpi dash-kpi-chart">
          <span className="dash-kpi-label"><TrendingUp size={15} /> Uploads this week</span>
          <strong>{weekUploads}</strong>
          <small>{data.today_uploads} today · last 7 days</small>
          {uploadTrend.length > 0 && <UploadTrendLineChart points={uploadTrend} />}
        </article>
      </section>

      <section className="analytics-panel section-block">
        <div className="section-heading">
          <div>
            <h2>Trending now</h2>
            <p>Most engaged posts in your gallery</p>
          </div>
          <button type="button" className="text-button" onClick={onBrowseGallery}>View all</button>
        </div>
        {mediaStrip.length === 0 ? (
          <EmptyState
            icon={Images}
            title="No media yet"
            description="Upload photos or videos to start building your gallery."
            action={onCreateAlbum ? (
              <button type="button" className="secondary-button small" onClick={onCreateAlbum}>
                <Plus size={14} />
                Create album
              </button>
            ) : undefined}
          />
        ) : (
          <div className="dash-media-strip">
            {mediaStrip.map((item) => (
              <button
                key={item.id}
                type="button"
                className="dash-media-card"
                onClick={() => onOpenMedia(item, mediaStrip)}
              >
                <MediaThumb media={item} showOverlay={false} className="dash-media-thumb" />
                <div className="dash-media-meta">
                  <strong>{item.display_name}</strong>
                  <span>
                    <Heart size={12} /> {item.like_count}
                    <MessageCircle size={12} /> {item.comment_count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="analytics-two-column section-block">
        <section className="analytics-panel">
          <div className="section-heading">
            <div>
              <h2>Recent albums</h2>
              <p>Latest collections in your gallery</p>
            </div>
          </div>
          {data.recent_albums.length === 0 ? (
            <EmptyState
              icon={Images}
              title="No albums yet"
              description="Create an album to start organizing media."
              action={(
                <button type="button" className="secondary-button small" onClick={onCreateAlbum}>
                  <Plus size={14} />
                  Create album
                </button>
              )}
            />
          ) : (
            <div className="dash-album-grid">
              {data.recent_albums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  className="dash-album-card"
                  onClick={() => onOpenAlbum(album.id)}
                >
                  <AlbumCover
                    className="dash-album-cover"
                    iconSize={22}
                    mediaId={album.preview_media_id}
                    mediaType={album.preview_media_type || undefined}
                    name={album.name}
                  />
                  <div className="dash-album-copy">
                    <strong>{album.name}</strong>
                    <span>{album.media_count} items · {album.photo_count} photos · {album.video_count} videos</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="analytics-panel">
          <div className="section-heading">
            <div>
              <h2>Top contributors</h2>
              <p>Most active uploaders (all time)</p>
            </div>
          </div>
          {data.top_contributors.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No activity yet" description="Contributors will appear here after uploads." />
          ) : (
            data.top_contributors.slice(0, 6).map((contributor) => {
              const maxUploads = Math.max(...data.top_contributors.map((row) => row.uploads), 1);
              return (
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
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
