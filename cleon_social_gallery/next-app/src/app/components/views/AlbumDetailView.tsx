"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { Images, Trash2, Upload } from "lucide-react";
import type { GalleryAlbum, GalleryMedia, LayoutMode } from "@/lib/types";
import { api, formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { LoadMoreFooter } from "../shared/LoadMoreFooter";
import AppSelect from "../shared/AppSelect";
import { BatchToolbar } from "../shared/BatchToolbar";
import { normalizeLayout, useGalleryMutations } from "@/hooks/useSocialGallery";
import { useGalleryMobile } from "@/hooks/useMediaQuery";
import { GalleryViewToggle } from "../gallery/GalleryViewToggle";
import { GalleryMobileBulkBar } from "../gallery/GalleryMobileBulkBar";
import {
  GalleryMobileMediaCard,
  GalleryMobileMediaListRow,
} from "../gallery/GalleryMobileMediaItem";
import { GalleryMediaItemMenu } from "../gallery/GalleryMediaItemMenu";

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
  albums = [],
  layout,
  onLayoutChange,
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
  albums?: GalleryAlbum[];
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
}) {
  const { mediaBatchAction } = useGalleryMutations();
  const [selected, setSelected] = useState<number[]>([]);
  const [moveAlbumId, setMoveAlbumId] = useState<number | "">("");
  const isMobile = useGalleryMobile();
  const viewLayout = normalizeLayout(layout);
  const selectionActive = selected.length > 0;
  const allSelected = selected.length === media.length && media.length > 0;
  const itemCount = total ?? album.media_count ?? media.length;

  const moveTargetAlbums = useMemo(
    () => albums.filter((a) => a.status === "approved" && a.id !== album.id),
    [albums, album.id],
  );

  const handleError = (err: unknown) => {
    onError?.(err instanceof Error ? err.message : "Action failed");
  };

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openMedia = (item: GalleryMedia, event?: MouseEvent) => {
    if (canManage && event && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      toggle(item.id);
      return;
    }
    onOpenMedia(item);
  };

  const deleteItems = (ids: number[]) => {
    if (!ids.length) return;
    if (!window.confirm(`Move ${ids.length} item(s) to the recycle bin?`)) return;
    mediaBatchAction.mutateAsync({ ids, action: "delete" })
      .then(() => { setSelected([]); onRefresh(); })
      .catch(handleError);
  };

  const moveItems = (ids: number[], targetAlbumId: number) => {
    if (!ids.length || !targetAlbumId) return;
    mediaBatchAction.mutateAsync({ ids, action: "move", album_id: targetAlbumId })
      .then(() => { setSelected([]); setMoveAlbumId(""); onRefresh(); })
      .catch(handleError);
  };

  const itemActions = (item: GalleryMedia) => ({
    onOpen: () => onOpenMedia(item),
    onToggleSelect: () => toggle(item.id),
    onMove: (albumId: number) => moveItems([item.id], albumId),
    onDelete: () => deleteItems([item.id]),
  });

  const deleteAll = async () => {
    if (!itemCount) return;
    if (!window.confirm(
      `Move all ${itemCount} item(s) in "${album.name}" to the Recycle Bin? This cannot be undone from here.`,
    )) return;
    try {
      await api.mediaBatchAction({ action: "delete_album_contents", album_id: album.id, ids: [] });
      setSelected([]);
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const rootClass = [
    "album-detail",
    "gallery-library-page",
    isMobile && selectionActive ? "gallery-library-page--bulk-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <header className="album-detail-header">
        <div className="album-detail-heading">
          <h1>{album.name}</h1>
          <p className="album-detail-count">
            {itemCount} {itemCount === 1 ? "item" : "items"}
            {album.description ? ` · ${album.description}` : ""}
          </p>
        </div>
        <div className="album-detail-header-tools">
          {media.length > 0 && (
            <GalleryViewToggle layout={viewLayout} onLayoutChange={onLayoutChange} />
          )}
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
        </div>
      </header>

      {media.length > 0 && !isMobile && canManage && (
        <div className="gallery-selection-bar">
          <BatchToolbar
            count={selected.length}
            total={media.length}
            onClear={() => setSelected([])}
            onToggleAll={() => setSelected(allSelected ? [] : media.map((m) => m.id))}
          >
            <AppSelect
              variant="toolbar"
              value={moveAlbumId === "" ? "" : String(moveAlbumId)}
              placeholder="Move to album…"
              options={[
                { value: "", label: "Move to album…" },
                ...moveTargetAlbums.map((a) => ({
                  value: String(a.id),
                  label: a.name,
                })),
              ]}
              onChange={(value) => setMoveAlbumId(value ? Number(value) : "")}
              ariaLabel="Move selected to album"
            />
            <button
              type="button"
              className="secondary-button small"
              disabled={!selected.length || !moveAlbumId}
              onClick={() => moveItems(selected, moveAlbumId as number)}
            >
              Move
            </button>
            <button
              type="button"
              className="danger-button small gallery-selection-delete"
              disabled={!selected.length}
              onClick={() => deleteItems(selected)}
            >
              <Trash2 size={14} />
              <span className="gallery-selection-delete-label">Delete</span>
            </button>
          </BatchToolbar>
          <p className="gallery-selection-tip">
            <span className="gallery-selection-tip-desktop">
              Tip: Hover over any media item and click the checkmark to select
            </span>
          </p>
        </div>
      )}

      {isMobile && canManage && (
        <GalleryMobileBulkBar
          count={selected.length}
          moveAlbumId={moveAlbumId}
          onMoveAlbumIdChange={setMoveAlbumId}
          albums={moveTargetAlbums}
          onMove={() => moveItems(selected, moveAlbumId as number)}
          onDelete={() => deleteItems(selected)}
          onDone={() => setSelected([])}
        />
      )}

      {loading ? (
        <LoadingGrid count={isMobile ? 4 : 8} />
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
      ) : viewLayout === "list" ? (
        <>
          <ul className="gallery-mobile-media-list" aria-label="Album media list">
            {media.map((item) => (
              <GalleryMobileMediaListRow
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                selectionActive={selectionActive}
                canManage={canManage}
                albums={moveTargetAlbums}
                {...itemActions(item)}
              />
            ))}
          </ul>
          <div className="analytics-table-wrap gallery-list-table">
            <table>
              <thead>
                <tr>
                  {canManage && <th aria-label="Select" />}
                  <th>Preview</th>
                  <th>Name</th>
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
                        <input
                          className="sg-check media-select-check"
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggle(item.id)}
                        />
                      </td>
                    )}
                    <td><MediaThumb media={item} className="list-thumb" showOverlay={false} /></td>
                    <td>{item.display_name}</td>
                    <td>{item.uploaded_by_name}</td>
                    <td>{formatBytes(item.file_size)}</td>
                    <td><StatusBadge status={item.approval_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={`media-grid gallery-library-grid${isMobile ? " gallery-mobile-grid" : ""}`}>
          {media.map((item) => (
            isMobile ? (
              <GalleryMobileMediaCard
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                selectionActive={selectionActive}
                canManage={canManage}
                albums={moveTargetAlbums}
                {...itemActions(item)}
              />
            ) : (
              <article
                key={item.id}
                className={`media-card ${selected.includes(item.id) ? "is-selected" : ""}`}
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
                      className="sg-check media-select-check gallery-hover-check"
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggle(item.id)}
                      aria-label={`Select ${item.display_name}`}
                    />
                  )}
                  <MediaThumb
                    media={item}
                    showOverlay={false}
                    showDescriptionOnHover={!!item.description}
                    description={item.description}
                  />
                  {canManage && (
                    <GalleryMediaItemMenu
                      albums={moveTargetAlbums}
                      onOpen={() => onOpenMedia(item)}
                      onMove={(albumId) => moveItems([item.id], albumId)}
                      onDelete={() => deleteItems([item.id])}
                    />
                  )}
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
                </div>
              </article>
            )
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
