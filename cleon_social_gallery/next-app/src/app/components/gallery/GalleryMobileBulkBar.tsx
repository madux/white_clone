"use client";

import { Trash2 } from "lucide-react";
import type { GalleryAlbum } from "@/lib/types";
import AppSelect from "../shared/AppSelect";

export function GalleryMobileBulkBar({
  count,
  moveAlbumId,
  onMoveAlbumIdChange,
  albums,
  onMove,
  onDelete,
  onDone,
}: {
  count: number;
  moveAlbumId: number | "";
  onMoveAlbumIdChange: (albumId: number | "") => void;
  albums: GalleryAlbum[];
  onMove: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  if (count <= 0) return null;

  return (
    <div className="gallery-mobile-bulk-bar" role="toolbar" aria-label="Bulk actions">
      <span className="gallery-mobile-bulk-count">{count} selected</span>
      <div className="gallery-mobile-bulk-actions">
        <AppSelect
          variant="toolbar"
          value={moveAlbumId === "" ? "" : String(moveAlbumId)}
          placeholder="Album…"
          options={[
            { value: "", label: "Move to album…" },
            ...albums.map((album) => ({
              value: String(album.id),
              label: album.name,
            })),
          ]}
          onChange={(value) => onMoveAlbumIdChange(value ? Number(value) : "")}
          ariaLabel="Move selected to album"
        />
        <button
          type="button"
          className="secondary-button small"
          disabled={!moveAlbumId}
          onClick={onMove}
        >
          Move
        </button>
        <button type="button" className="danger-button small" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
        <button type="button" className="text-button small" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
