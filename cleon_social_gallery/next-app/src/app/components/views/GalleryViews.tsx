"use client";

import { useState } from "react";
import { Grid3X3, LayoutGrid, List, Upload } from "lucide-react";
import type { GalleryAlbum, GalleryMedia, LayoutMode } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import UploadModal from "../modals/UploadModal";
import { BackButton } from "../shared/BackButton";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { PageToolbar } from "../shared/PageToolbar";

interface GalleryFeedProps {
  media: GalleryMedia[];
  loading: boolean;
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
  onOpenMedia: (media: GalleryMedia) => void;
  albumId?: number;
  albums?: GalleryAlbum[];
  onRefresh: () => void;
  onUpload?: () => void;
  hideToolbar?: boolean;
}

const LAYOUT_ICONS = {
  grid: LayoutGrid,
  list: List,
  masonry: Grid3X3,
};

export default function GalleryFeedView({
  media, loading, layout, onLayoutChange, onOpenMedia, albumId, albums, onRefresh, onUpload, hideToolbar,
}: GalleryFeedProps) {
  const [showUpload, setShowUpload] = useState(false);

  const triggerUpload = () => {
    if (onUpload) onUpload();
    else setShowUpload(true);
  };

  return (
    <div>
      {!hideToolbar && (
        <PageToolbar
          left={(
            <div className="view-toggle">
              {(["grid", "list", "masonry"] as LayoutMode[]).map((mode) => {
                const Icon = LAYOUT_ICONS[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    className={layout === mode ? "active" : ""}
                    onClick={() => onLayoutChange(mode)}
                    aria-label={`${mode} view`}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
          )}
        />
      )}

      {loading ? (
        <LoadingGrid count={8} />
      ) : media.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No media found"
          description="Upload photos or videos to start building your gallery."
          action={(
            <button type="button" className="primary-button" onClick={triggerUpload}>
              <Upload size={16} />
              Upload Media
            </button>
          )}
        />
      ) : layout === "list" ? (
        <div className="analytics-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Preview</th>
                <th>Name</th>
                <th>Album</th>
                <th>Uploader</th>
                <th>Size</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {media.map((item) => (
                <tr key={item.id} className="media-list-row" onClick={() => onOpenMedia(item)}>
                  <td><MediaThumb media={item} className="list-thumb" showOverlay={false} /></td>
                  <td>{item.display_name}</td>
                  <td>{item.album_name || "—"}</td>
                  <td>{item.uploaded_by_name}</td>
                  <td>{formatBytes(item.file_size)}</td>
                  <td><StatusBadge status={item.approval_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={layout === "masonry" ? "sg-masonry" : "media-grid"}>
          {media.map((item) => (
            <article
              key={item.id}
              className={`media-card ${layout === "masonry" ? "sg-masonry-item" : ""}`}
              tabIndex={0}
              role="button"
              onClick={() => onOpenMedia(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenMedia(item);
                }
              }}
            >
              <MediaThumb media={item} />
              <div className="media-copy">
                <div className="media-title-row">
                  <span className="media-title">{item.display_name}</span>
                  <StatusBadge status={item.approval_status} />
                </div>
                <div className="media-footer">
                  <span>{item.uploaded_by_name}</span>
                  <span>{formatDate(item.create_date)}</span>
                </div>
                <div className="media-meta">
                  <span>{item.like_count} likes · {item.comment_count} comments</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showUpload && !onUpload && (
        <UploadModal
          albumId={albumId}
          albums={albums}
          onClose={() => setShowUpload(false)}
          onComplete={() => { setShowUpload(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

export function AlbumDetailView({
  album, media, loading, layout, onLayoutChange, onOpenMedia, onBack, onRefresh, onUpload, fromDashboard,
}: {
  album: GalleryAlbum;
  media: GalleryMedia[];
  loading: boolean;
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
  onOpenMedia: (media: GalleryMedia) => void;
  onBack: () => void;
  onRefresh: () => void;
  onUpload?: () => void;
  fromDashboard?: boolean;
}) {
  return (
    <div>
      <BackButton label={fromDashboard ? "Back to Dashboard" : "Back to Albums"} onClick={onBack} />
      <div className="filter-toolbar">
        <p className="album-meta-line">
          {album.description || "No description"} · {album.photo_count} photos · {album.video_count} videos · {formatBytes(album.total_size)}
        </p>
        {onUpload && (
          <button type="button" className="primary-button small" onClick={onUpload}>
            <Upload size={14} />
            Upload Media
          </button>
        )}
      </div>
      <GalleryFeedView
        media={media}
        loading={loading}
        layout={layout}
        onLayoutChange={onLayoutChange}
        onOpenMedia={onOpenMedia}
        albumId={album.id}
        onRefresh={onRefresh}
        onUpload={onUpload}
        hideToolbar={false}
      />
    </div>
  );
}
