"use client";

import {
  Archive,
  Folder,
  FolderOpen,
  LoaderCircle,
  MoreVertical,
  Play,
  Plus,
  Settings2,
  Star,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  DocumentaryFolder,
  DocumentaryMedia,
} from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { formatBytes, formatDuration, scopeLabel } from "../documentaryUtils";

export function FeaturedFolder({
  folder,
  tint,
  onClick,
}: {
  folder: DocumentaryFolder;
  tint: number;
  onClick: () => void;
}) {
  return (
    <button className={`featured-card tint-${tint}`} onClick={onClick}>
      <div className="featured-card-top">
        <span className="pin-dot">
          <Star size={14} fill="currentColor" />
        </span>
        <MoreVertical size={17} />
      </div>
      <div className="featured-illustration">
        <FolderOpen size={42} strokeWidth={1.3} />
      </div>
      <div className="featured-card-copy">
        <span>{folder.media_count} videos</span>
        <strong>{folder.name}</strong>
        <small>{scopeLabel(folder.access_scope)}</small>
      </div>
    </button>
  );
}

export function FolderCard({
  folder,
  canManage,
  onOpen,
  onAction,
  onEdit,
}: {
  folder: DocumentaryFolder;
  canManage: boolean;
  onOpen: () => void;
  onAction: (id: number, action: "archive" | "delete") => void;
  onEdit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="folder-card" style={{ position: "relative" }}>
      <button className="folder-card-main" onClick={onOpen}>
        <span className="folder-icon">
          <Folder size={19} />
        </span>
        <span className="folder-card-copy">
          <strong>{folder.name}</strong>
          <small>
            {folder.media_count} videos · {scopeLabel(folder.access_scope)}
          </small>
        </span>
      </button>
      {canManage && folder.can_edit && (
        <button
          className="icon-button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={`Manage ${folder.name}`}
        >
          <MoreVertical size={18} />
        </button>
      )}
      {menuOpen && canManage && folder.can_edit && (
        <div className="context-menu">
          <button
            onClick={() => {
              setMenuOpen(false);
              onEdit();
            }}
          >
            <span className="pencil-icon">✎</span> Edit folder
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onAction(folder.id, "archive");
            }}
          >
            <Archive size={14} /> Archive
          </button>
          <button
            className="danger"
            onClick={() => {
              setMenuOpen(false);
              onAction(folder.id, "delete");
            }}
          >
            <Trash2 size={14} /> Move to recycle bin
          </button>
        </div>
      )}
    </div>
  );
}

export function MediaCard({
  media,
  index,
  canManage,
  selected,
  onSelect,
  onEdit,
  onOpen,
  onAction,
}: {
  media: DocumentaryMedia;
  index: number;
  canManage: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onOpen: () => void;
  onAction: (
    media: DocumentaryMedia,
    action: "favorite" | "archive" | "delete",
  ) => void;
}) {
  const palette = ["rose", "lilac", "peach", "berry"][index % 4];
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!media.thumbnail_available) return () => undefined;
    let active = true;
    api
      .assetReadUrl(media.id, "thumbnail")
      .then((result) => {
        if (active) setThumbnailUrl(result.url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [media.id, media.thumbnail_available]);
  return (
    <article className={`media-card ${selected ? "is-selected" : ""}`}>
      <button
        className={`media-preview ${palette} ${thumbnailUrl ? "has-thumbnail" : ""}`}
        style={
          thumbnailUrl
            ? {
                backgroundImage: `linear-gradient(#24162a55,#24162a55), url(${thumbnailUrl})`,
              }
            : undefined
        }
        onClick={onOpen}
      >
        {canManage && (
          <span
            className="media-select"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              aria-label={`Select ${media.title}`}
            />
          </span>
        )}
        <span className="media-type">
          <Video size={14} />{" "}
          {media.mime_type.split("/")[1]?.toUpperCase() || "VIDEO"}
        </span>
        <span className="play-button">
          <Play size={19} fill="currentColor" />
        </span>
        <span className="duration">
          {formatDuration(media.duration_seconds)}
        </span>
      </button>
      <div className="media-copy">
        <div className="media-meta">
          <span>{formatBytes(media.file_size)}</span>
          <span>
            Updated{" "}
            {new Date(media.updated_at || media.created_at).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            )}
          </span>
        </div>
        <div className="media-title-row">
          <button className="media-title" onClick={onOpen}>
            {media.title}
          </button>
          <button
            className="icon-button compact"
            onClick={() => onAction(media, "favorite")}
            aria-label="Toggle favorite"
          >
            <Star size={16} fill={media.favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="media-footer">
          <span>
            <Users size={14} /> {media.folder_name}
          </span>
          <button
            className="icon-button compact"
            onClick={() => (canManage ? onEdit() : onOpen())}
            aria-label={canManage ? "Edit video" : "View video"}
          >
            {canManage ? <Settings2 size={16} /> : <MoreVertical size={16} />}
          </button>
        </div>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Video size={22} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && onAction && (
        <button className="secondary-button small" onClick={onAction}>
          <Plus size={15} /> {action}
        </button>
      )}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={24} />
      <span>Loading your documentary library…</span>
    </div>
  );
}
