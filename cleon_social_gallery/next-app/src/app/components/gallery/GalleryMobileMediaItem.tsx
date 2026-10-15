"use client";

import { ChevronRight } from "lucide-react";
import type { GalleryAlbum, GalleryMedia } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { useLongPress } from "@/hooks/useLongPress";
import { GalleryMediaItemMenu } from "./GalleryMediaItemMenu";

export function GalleryMobileMediaCard({
  item,
  selected,
  selectionActive,
  canManage,
  albums,
  onOpen,
  onToggleSelect,
  onMove,
  onDelete,
}: {
  item: GalleryMedia;
  selected: boolean;
  selectionActive: boolean;
  canManage: boolean;
  albums: GalleryAlbum[];
  onOpen: () => void;
  onToggleSelect: () => void;
  onMove: (albumId: number) => void;
  onDelete: () => void;
}) {
  const longPress = useLongPress(onToggleSelect);

  const activate = () => {
    if (longPress.consumeLongPress()) return;
    if (canManage && selectionActive) {
      onToggleSelect();
      return;
    }
    onOpen();
  };

  return (
    <article
      className={`media-card gallery-mobile-card ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      <div className="media-thumb-wrap gallery-mobile-thumb-wrap" {...longPress.bind()}>
        {selected && <span className="gallery-mobile-selected-badge" aria-hidden />}
        <MediaThumb media={item} showOverlay className="gallery-mobile-card-thumb" />
        {canManage && (
          <GalleryMediaItemMenu
            albums={albums}
            onOpen={onOpen}
            onMove={onMove}
            onDelete={onDelete}
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
        {item.album_name && (
          <p className="gallery-mobile-card-album">{item.album_name}</p>
        )}
      </div>
    </article>
  );
}

export function GalleryMobileMediaListRow({
  item,
  selected,
  selectionActive,
  canManage,
  albums,
  onOpen,
  onToggleSelect,
  onMove,
  onDelete,
}: {
  item: GalleryMedia;
  selected: boolean;
  selectionActive: boolean;
  canManage: boolean;
  albums: GalleryAlbum[];
  onOpen: () => void;
  onToggleSelect: () => void;
  onMove: (albumId: number) => void;
  onDelete: () => void;
}) {
  const longPress = useLongPress(onToggleSelect);

  const activate = () => {
    if (longPress.consumeLongPress()) return;
    if (canManage && selectionActive) {
      onToggleSelect();
      return;
    }
    onOpen();
  };

  return (
    <li>
      <div
        className={`gallery-mobile-media-row ${selected ? "is-selected" : ""}`}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
      >
        <div className="gallery-mobile-media-thumb" {...longPress.bind()}>
          {selected && <span className="gallery-mobile-selected-badge" aria-hidden />}
          <MediaThumb
            media={item}
            className="gallery-mobile-list-thumb"
            showOverlay={item.media_type === "video"}
          />
        </div>
        <div className="gallery-mobile-media-body">
          <div className="gallery-mobile-media-head">
            <span className="gallery-mobile-media-title">{item.display_name}</span>
            <StatusBadge status={item.approval_status} />
          </div>
          <p className="gallery-mobile-media-line">
            {item.album_name || "No album"}
            <span className="gallery-mobile-media-dot" aria-hidden>·</span>
            {formatBytes(item.file_size)}
          </p>
          <p className="gallery-mobile-media-line gallery-mobile-media-line--muted">
            {item.uploaded_by_name}
            <span className="gallery-mobile-media-dot" aria-hidden>·</span>
            {formatDate(item.create_date)}
          </p>
        </div>
        {canManage ? (
          <GalleryMediaItemMenu
            albums={albums}
            onOpen={onOpen}
            onMove={onMove}
            onDelete={onDelete}
          />
        ) : (
          <ChevronRight className="gallery-mobile-media-chevron" size={18} aria-hidden />
        )}
      </div>
    </li>
  );
}
