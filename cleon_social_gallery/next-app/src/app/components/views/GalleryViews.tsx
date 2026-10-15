"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { LayoutGrid, List, Trash2, Upload } from "lucide-react";
import type { GalleryAlbum, GalleryMedia, LayoutMode } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import UploadModal from "../modals/UploadModal";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { LoadMoreFooter } from "../shared/LoadMoreFooter";
import AppSelect from "../shared/AppSelect";
import { BatchToolbar } from "../shared/BatchToolbar";
import { useGalleryMutations } from "@/hooks/useSocialGallery";
import {
  GalleryLibraryChrome,
  type GalleryStatusFilter,
} from "../gallery/GalleryLibraryChrome";
import { normalizeLayout } from "@/hooks/useSocialGallery";
import { useGalleryMobile } from "@/hooks/useMediaQuery";
import {
  GalleryMobileMediaCard,
  GalleryMobileMediaListRow,
} from "../gallery/GalleryMobileMediaItem";
import { GalleryMobileBulkBar } from "../gallery/GalleryMobileBulkBar";

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
  libraryMode?: boolean;
  albumFilterId?: number | null;
  onAlbumFilter?: (albumId: number | null) => void;
  statusFilter?: GalleryStatusFilter;
  onStatusFilter?: (value: GalleryStatusFilter) => void;
  sort?: string;
  onSort?: (value: string) => void;
  onCreateAlbum?: () => void;
  statusCounts?: { all: number; approved: number; pending: number; rejected: number };
  search?: string;
  onSearch?: (value: string) => void;
}

export default function GalleryFeedView({
  media, loading, layout, onLayoutChange, onOpenMedia, albumId, albums, onRefresh, onUpload, hideToolbar,
  total, onLoadMore, loadingMore, canManage = false, onError,
  libraryMode = false,
  albumFilterId = null,
  onAlbumFilter,
  statusFilter = "",
  onStatusFilter,
  sort = "newest",
  onSort,
  onCreateAlbum,
  statusCounts,
  search = "",
  onSearch,
}: GalleryFeedProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [moveAlbumId, setMoveAlbumId] = useState<number | "">("");
  const { mediaBatchAction } = useGalleryMutations();
  const allSelected = selected.length === media.length && media.length > 0;
  const viewLayout = normalizeLayout(layout);
  const isMobile = useGalleryMobile();
  const selectionActive = selected.length > 0;

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

  const statusOptions = useMemo(() => {
    const counts = statusCounts || { all: total ?? media.length, approved: 0, pending: 0, rejected: 0 };
    return [
      { value: "" as GalleryStatusFilter, label: "All", count: counts.all },
      { value: "approved" as GalleryStatusFilter, label: "Approved", count: counts.approved },
      { value: "pending" as GalleryStatusFilter, label: "Pending", count: counts.pending },
      { value: "rejected" as GalleryStatusFilter, label: "Rejected", count: counts.rejected },
    ];
  }, [statusCounts, total, media.length]);

  const approvedAlbums = useMemo(
    () => (albums || []).filter((a) => a.status === "approved"),
    [albums],
  );

  const deleteItems = (ids: number[]) => {
    if (!ids.length) return;
    if (!window.confirm(`Move ${ids.length} item(s) to the recycle bin?`)) return;
    mediaBatchAction.mutateAsync({ ids, action: "delete" })
      .then(() => { setSelected([]); onRefresh(); })
      .catch(handleError);
  };

  const moveItems = (ids: number[], albumId: number) => {
    if (!ids.length || !albumId) return;
    mediaBatchAction.mutateAsync({ ids, action: "move", album_id: albumId })
      .then(() => { setSelected([]); setMoveAlbumId(""); onRefresh(); })
      .catch(handleError);
  };

  const itemActions = (item: GalleryMedia) => ({
    onOpen: () => onOpenMedia(item),
    onToggleSelect: () => toggle(item.id),
    onMove: (albumId: number) => moveItems([item.id], albumId),
    onDelete: () => deleteItems([item.id]),
  });

  return (
    <div
      className={
        libraryMode
          ? `gallery-library-page${isMobile && selectionActive ? " gallery-library-page--bulk-open" : ""}`
          : ""
      }
    >
      {libraryMode && onAlbumFilter && onStatusFilter && onSort && onSearch && (
        <GalleryLibraryChrome
          search={search}
          onSearch={onSearch}
          layout={viewLayout}
          onLayoutChange={onLayoutChange}
          statusFilter={statusFilter}
          onStatusFilter={onStatusFilter}
          statusOptions={statusOptions}
          sort={sort}
          onSort={onSort}
          albums={approvedAlbums}
          albumFilterId={albumFilterId}
          onAlbumFilter={onAlbumFilter}
          shown={media.length}
          total={total ?? media.length}
          onCreateAlbum={onCreateAlbum}
          canManageStatus={canManage}
        />
      )}

      {libraryMode && media.length > 0 && !isMobile && (
        <div className="gallery-selection-bar">
          {canManage ? (
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
                  ...approvedAlbums.map((album) => ({
                    value: String(album.id),
                    label: album.name,
                  })),
                ]}
                onChange={(value) => setMoveAlbumId(value ? Number(value) : "")}
                ariaLabel="Move selected to album"
              />
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
          ) : null}
          {canManage && (
            <p className="gallery-selection-tip">
              <span className="gallery-selection-tip-desktop">Tip: Hover over any media item and click the checkmark to select</span>
            </p>
          )}
        </div>
      )}

      {libraryMode && isMobile && canManage && (
        <GalleryMobileBulkBar
          count={selected.length}
          moveAlbumId={moveAlbumId}
          onMoveAlbumIdChange={setMoveAlbumId}
          albums={approvedAlbums}
          onMove={() => moveItems(selected, moveAlbumId as number)}
          onDelete={() => deleteItems(selected)}
          onDone={() => setSelected([])}
        />
      )}

      {!libraryMode && !hideToolbar && canManage && media.length > 0 && (
        <BatchToolbar
          count={selected.length}
          total={media.length}
          onClear={() => setSelected([])}
          onToggleAll={() => setSelected(allSelected ? [] : media.map((m) => m.id))}
        />
      )}

      {loading ? (
        <LoadingGrid count={8} />
      ) : media.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No media found"
          description="Upload photos or videos to start building your gallery."
          action={onUpload ? (
            <button type="button" className="primary-button" onClick={triggerUpload}>
              <Upload size={16} />
              Upload Media
            </button>
          ) : undefined}
        />
      ) : viewLayout === "list" ? (
        <>
          <ul className="gallery-mobile-media-list" aria-label="Media list">
            {media.map((item) => (
              <GalleryMobileMediaListRow
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                selectionActive={selectionActive}
                canManage={canManage}
                albums={approvedAlbums}
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
                albums={approvedAlbums}
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
                  <MediaThumb media={item} showOverlay />
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

