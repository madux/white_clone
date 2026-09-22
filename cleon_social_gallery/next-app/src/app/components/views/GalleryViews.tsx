"use client";

import { useState, type MouseEvent } from "react";
import { Grid3X3, Heart, LayoutGrid, List, MessageCircle, Trash2, Upload } from "lucide-react";
import type { GalleryAlbum, GalleryMedia, LayoutMode } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import UploadModal from "../modals/UploadModal";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { LoadMoreFooter } from "../shared/LoadMoreFooter";
import { PageToolbar } from "../shared/PageToolbar";
import { BatchToolbar } from "../shared/BatchToolbar";
import { useGalleryMutations } from "@/hooks/useSocialGallery";

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
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  canManage?: boolean;
  onError?: (message: string) => void;
}

const LAYOUT_ICONS = {
  grid: LayoutGrid,
  list: List,
  masonry: Grid3X3,
};

export default function GalleryFeedView({
  media, loading, layout, onLayoutChange, onOpenMedia, albumId, albums, onRefresh, onUpload, hideToolbar,
  total, onLoadMore, loadingMore, canManage = false, onError,
}: GalleryFeedProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [moveAlbumId, setMoveAlbumId] = useState<number | "">("");
  const { mediaBatchAction } = useGalleryMutations();
  const allSelected = selected.length === media.length && media.length > 0;

  const triggerUpload = () => {
    if (onUpload) onUpload();
    else setShowUpload(true);
  };

  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");
  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const openMedia = (item: GalleryMedia, event?: MouseEvent) => {
    if (canManage && event && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      toggle(item.id);
      return;
    }
    onOpenMedia(item);
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

      {canManage && media.length > 0 && (
        <BatchToolbar
          count={selected.length}
          total={media.length}
          onClear={() => setSelected([])}
          onToggleAll={() => setSelected(allSelected ? [] : media.map((m) => m.id))}
        >
          <div className="field">
            <select
              value={moveAlbumId}
              onChange={(e) => setMoveAlbumId(e.target.value ? Number(e.target.value) : "")}
              aria-label="Move selected to album"
            >
              <option value="">Move to album…</option>
              {(albums || []).map((album) => (
                <option key={album.id} value={album.id}>{album.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="secondary-button small"
            disabled={!selected.length || !moveAlbumId}
            onClick={() => mediaBatchAction.mutateAsync({
              ids: selected,
              action: "move",
              album_id: moveAlbumId,
            }).then(() => { setSelected([]); onRefresh(); }).catch(handleError)}
          >
            Move Selected
          </button>
          <button
            type="button"
            className="danger-button small"
            disabled={!selected.length}
            onClick={() => {
              if (!window.confirm(`Move ${selected.length} item(s) to the recycle bin?`)) return;
              mediaBatchAction.mutateAsync({ ids: selected, action: "delete" })
                .then(() => { setSelected([]); onRefresh(); })
                .catch(handleError);
            }}
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
        </BatchToolbar>
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
                {canManage && <th aria-label="Select" />}
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
                <tr
                  key={item.id}
                  className={`media-list-row ${selected.includes(item.id) ? "is-selected" : ""}`}
                  onClick={(event) => openMedia(item, event)}
                >
                  {canManage && (
                    <td onClick={(event) => event.stopPropagation()}>
                      <input className="sg-check media-select-check" type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                    </td>
                  )}
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
              className={`media-card ${layout === "masonry" ? "sg-masonry-item" : ""} ${selected.includes(item.id) ? "is-selected" : ""}`}
              tabIndex={0}
              role="button"
              onClick={(event) => openMedia(item, event)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenMedia(item);
                }
              }}
            >
              <div className="media-thumb-wrap">
                {canManage && (
                  <input
                    className="sg-check media-select-check"
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggle(item.id)}
                    aria-label={`Select ${item.display_name}`}
                  />
                )}
                <MediaThumb media={item} />
                <div className="social-card-overlay">
                  <span className="social-card-stat"><Heart size={18} fill="currentColor" /> {item.like_count}</span>
                  <span className="social-card-stat"><MessageCircle size={18} /> {item.comment_count}</span>
                </div>
              </div>
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

      {onLoadMore && (
        <LoadMoreFooter
          shown={media.length}
          total={total ?? media.length}
          loading={loadingMore}
          onLoadMore={onLoadMore}
        />
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
  album, media, loading, layout, onLayoutChange, onOpenMedia, onRefresh, onUpload,
  total, onLoadMore, loadingMore, canManage, albums, onError,
}: {
  album: GalleryAlbum;
  media: GalleryMedia[];
  loading: boolean;
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
  onOpenMedia: (media: GalleryMedia) => void;
  onRefresh: () => void;
  onUpload?: () => void;
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  canManage?: boolean;
  albums?: GalleryAlbum[];
  onError?: (message: string) => void;
}) {
  return (
    <div>
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
        albums={albums}
        onRefresh={onRefresh}
        onUpload={onUpload}
        hideToolbar={false}
        total={total}
        onLoadMore={onLoadMore}
        loadingMore={loadingMore}
        canManage={canManage}
        onError={onError}
      />
    </div>
  );
}
