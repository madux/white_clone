"use client";

import { Images, Trash2, Upload } from "lucide-react";
import type { GalleryAlbum, GalleryMedia } from "@/lib/types";
import { api } from "@/lib/api";
import { MediaThumb } from "../shared/MediaThumb";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { LoadMoreFooter } from "../shared/LoadMoreFooter";
import { useGalleryMutations } from "@/hooks/useSocialGallery";

export default function AlbumDetailView({
  album,
  media,
  loading,
  onOpenMedia,
  onRefresh,
  onUpload,
  total,
  onLoadMore,
  loadingMore,
  canManage = false,
  onError,
}: {
  album: GalleryAlbum;
  media: GalleryMedia[];
  loading: boolean;
  onOpenMedia: (media: GalleryMedia) => void;
  onRefresh: () => void;
  onUpload?: () => void;
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  canManage?: boolean;
  onError?: (message: string) => void;
}) {
  const { mediaAction } = useGalleryMutations();
  const itemCount = total ?? album.media_count ?? media.length;

  const handleError = (err: unknown) => {
    onError?.(err instanceof Error ? err.message : "Action failed");
  };

  const deleteOne = async (item: GalleryMedia) => {
    if (!window.confirm(`Move "${item.display_name}" to the Recycle Bin?`)) return;
    try {
      await mediaAction.mutateAsync({ id: item.id, action: "delete" });
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const deleteAll = async () => {
    if (!itemCount) return;
    if (!window.confirm(
      `Move all ${itemCount} item(s) in "${album.name}" to the Recycle Bin? This cannot be undone from here.`,
    )) return;
    try {
      await api.mediaBatchAction({ action: "delete_album_contents", album_id: album.id, ids: [] });
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <div className="album-detail">
      <header className="album-detail-header">
        <div className="album-detail-heading">
          <h1>{album.name}</h1>
          <p className="album-detail-count">
            {itemCount} {itemCount === 1 ? "item" : "items"}
            {album.description ? ` · ${album.description}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="album-detail-actions">
            {onUpload && (
              <button type="button" className="primary-button small" onClick={onUpload}>
                <Upload size={16} />
                Upload Media
              </button>
            )}
            {itemCount > 0 && (
              <button type="button" className="danger-button small" onClick={deleteAll}>
                <Trash2 size={16} />
                Delete All
              </button>
            )}
          </div>
        )}
      </header>

      {loading ? (
        <LoadingGrid count={12} cols={4} />
      ) : media.length === 0 ? (
        <EmptyState
          icon={Images}
          title="This album is empty"
          description={canManage
            ? "Upload photos or videos to start building this collection."
            : "There is no approved media in this album yet."}
          action={canManage && onUpload ? (
            <button type="button" className="primary-button" onClick={onUpload}>
              <Upload size={16} />
              Upload Media
            </button>
          ) : undefined}
        />
      ) : (
        <div className="album-detail-grid">
          {media.map((item) => (
            <article key={item.id} className="album-detail-card">
              <button
                type="button"
                className="album-detail-card-hit"
                onClick={() => onOpenMedia(item)}
                aria-label={`Open ${item.display_name}`}
              >
                <MediaThumb
                  media={item}
                  showOverlay={false}
                  showDescriptionOnHover={!!item.description}
                  description={item.description}
                  className="album-detail-thumb"
                />
              </button>
              {canManage && (
                <button
                  type="button"
                  className="album-detail-delete"
                  aria-label={`Delete ${item.display_name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteOne(item);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {onLoadMore && media.length > 0 && (
        <LoadMoreFooter
          shown={media.length}
          total={total ?? media.length}
          loading={loadingMore}
          onLoadMore={onLoadMore}
        />
      )}
    </div>
  );
}
