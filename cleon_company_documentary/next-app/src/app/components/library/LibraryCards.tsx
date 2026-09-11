"use client";

import {
  Archive,
  Clock3,
  Folder,
  FolderOpen,
  LoaderCircle,
  MoreVertical,
  Pin,
  Play,
  Plus,
  Settings2,
  Share2,
  Heart,
  MessageCircle,
  Star,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentaryFolder, DocumentaryMedia } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import type { LayoutMode } from "./libraryTypes";
import { formatBytes, formatDuration, scopeLabel } from "../documentaryUtils";
import { mediaStatusInfo } from "../../../../lib/statusUtils";

export function FeaturedFolder({
  folder,
  tint,
  onClick,
  onPin,
  canManage,
}: {
  folder: DocumentaryFolder;
  tint: number;
  onClick: () => void;
  onPin?: () => void;
  canManage?: boolean;
}) {
  return (
    <button className={`featured-card tint-${tint}`} onClick={onClick}>
      <div className="featured-card-top">
        <span className="pin-dot"><Star size={14} fill="currentColor" /></span>
        {canManage && onPin && (
          <button className="icon-button compact" onClick={(e) => { e.stopPropagation(); onPin(); }} aria-label="Pin folder">
            <Pin size={16} fill={folder.is_pinned ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      <div className="featured-illustration"><FolderOpen size={42} strokeWidth={1.3} /></div>
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
  onPin,
}: {
  folder: DocumentaryFolder;
  canManage: boolean;
  onOpen: () => void;
  onAction: (id: number, action: "archive" | "delete") => void;
  onEdit: () => void;
  onPin?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="folder-card" style={{ position: "relative" }}>
      <button className="folder-card-main" onClick={onOpen}>
        <span className="folder-icon"><Folder size={19} /></span>
        <span className="folder-card-copy">
          <strong>{folder.name}</strong>
          <small>{folder.media_count} videos · {scopeLabel(folder.access_scope)}</small>
        </span>
      </button>
      {canManage && folder.can_edit && (
        <button className="icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label={`Manage ${folder.name}`}>
          <MoreVertical size={18} />
        </button>
      )}
      {menuOpen && canManage && folder.can_edit && (
        <div className="context-menu">
          <button onClick={() => { setMenuOpen(false); onEdit(); }}>✎ Edit folder</button>
          {onPin && (
            <button onClick={() => { setMenuOpen(false); onPin(); }}>
              <Pin size={14} /> {folder.is_pinned ? "Unpin" : "Pin folder"}
            </button>
          )}
          <button onClick={() => { setMenuOpen(false); onAction(folder.id, "archive"); }}><Archive size={14} /> Archive</button>
          <button className="danger" onClick={() => { setMenuOpen(false); onAction(folder.id, "delete"); }}><Trash2 size={14} /> Move to recycle bin</button>
        </div>
      )}
    </div>
  );
}

export function MediaCard({
  media,
  index,
  layoutMode,
  canManage,
  selected,
  uploadProgress,
  onSelect,
  onEdit,
  onOpen,
  onShare,
  onAction,
}: {
  media: DocumentaryMedia;
  index: number;
  layoutMode: LayoutMode;
  canManage: boolean;
  selected: boolean;
  uploadProgress?: number;
  onSelect: () => void;
  onEdit: () => void;
  onOpen: () => void;
  onShare?: () => void;
  onAction: (media: DocumentaryMedia, action: "favorite" | "archive" | "delete") => void;
}) {
  const palette = ["rose", "lilac", "peach", "berry"][index % 4];
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const badge = mediaStatusInfo(media);
  const progress = media.watch_progress;
  const isUploading =
    media.processing_state === "uploading" ||
    (uploadProgress !== undefined && uploadProgress < 100);
  const uploadPct = uploadProgress ?? (media.processing_state === "uploading" ? 0 : undefined);

  const handleOpen = () => {
    if (isUploading) return;
    onOpen();
  };

  useEffect(() => {
    if (!media.thumbnail_available) return () => undefined;
    let active = true;
    api.assetReadUrl(media.id, "thumbnail").then((result) => { if (active) setThumbnailUrl(result.url); }).catch(() => undefined);
    return () => { active = false; };
  }, [media.id, media.thumbnail_available]);

  if (layoutMode === "list") {
    return (
      <article className={`media-list-row ${selected ? "is-selected" : ""}`}>
        {canManage && (
          <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${media.title}`} />
        )}
        <button className="media-list-main" onClick={handleOpen} disabled={isUploading}>
          <span className={`media-type-badge ${badge?.variant || "approved"}`}>{badge?.label || "Ready"}</span>
          <strong>{media.title}</strong>
          <span>{media.folder_name} · {formatDuration(media.duration_seconds)} · {formatBytes(media.file_size)}</span>
          {isUploading && uploadPct !== undefined && (
            <div className="media-upload-bar list">
              <div className="progress-track">
                <span style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}
          {progress && !progress.completed && !isUploading && (
            <span className="continue-meta"><Clock3 size={13} /> {Math.round(progress.completion_percent)}% watched</span>
          )}
        </button>
        <div className="media-list-actions">
          <button onClick={() => onAction(media, "favorite")} aria-label="Toggle favorite"><Star size={16} fill={media.favorite ? "currentColor" : "none"} /></button>
          {onShare && <button onClick={onShare} aria-label="Share"><Share2 size={16} /></button>}
          <button onClick={() => (canManage ? onEdit() : onOpen())} aria-label="Edit">{canManage ? <Settings2 size={16} /> : <MoreVertical size={16} />}</button>
        </div>
      </article>
    );
  }

  return (
    <article className={`media-card ${selected ? "is-selected" : ""}`}>
      <button
        className={`media-preview ${palette} ${thumbnailUrl ? "has-thumbnail" : ""}${isUploading ? " is-uploading" : ""}`}
        style={thumbnailUrl ? { backgroundImage: `linear-gradient(#24162a55,#24162a55), url(${thumbnailUrl})` } : undefined}
        onClick={handleOpen}
        disabled={isUploading}
      >
        {isUploading && (
          <span className="media-upload-overlay">
            <LoaderCircle className="spin" size={28} />
          </span>
        )}
        {canManage && (
          <span className="media-select" onClick={(event) => { event.stopPropagation(); onSelect(); }}>
            <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${media.title}`} />
          </span>
        )}
        <span className="media-type"><Video size={14} /> {media.mime_type.split("/")[1]?.toUpperCase() || "VIDEO"}</span>
        <span className="play-button"><Play size={19} fill="currentColor" /></span>
        <div className="social-card-overlay">
          <span className="social-card-stat"><Heart size={16} fill="currentColor" /> {media.like_count || 0}</span>
          <span className="social-card-stat"><MessageCircle size={16} /> {media.comment_count || 0}</span>
        </div>
        <span className="duration">{formatDuration(media.duration_seconds)}</span>
      </button>
      <div className="media-copy">
        {(badge || (progress && !progress.completed && !isUploading)) && (
          <div className="media-card-head">
            {badge ? <span className={`status-badge ${badge.variant}`}>{badge.label}</span> : <span />}
            {progress && !progress.completed && !isUploading && (
              <span className="watch-progress-chip">
                <Clock3 size={12} />
                {Math.round(progress.completion_percent)}% watched
              </span>
            )}
          </div>
        )}
        <div className="media-meta">
          <span>{formatBytes(media.file_size)}</span>
          <span>Updated {new Date(media.updated_at || media.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
        <div className="media-title-row">
          <button className="media-title" onClick={handleOpen} disabled={isUploading}>{media.title}</button>
          <button className="icon-button compact" onClick={() => onAction(media, "favorite")} aria-label="Toggle favorite">
            <Star size={16} fill={media.favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="media-footer">
          <span><Users size={14} /> {media.folder_name}</span>
          <div className="media-footer-actions">
            {onShare && <button className="icon-button compact" onClick={onShare} aria-label="Share"><Share2 size={16} /></button>}
            <button className="icon-button compact" onClick={() => (canManage ? onEdit() : onOpen())} aria-label={canManage ? "Edit video" : "View video"}>
              {canManage ? <Settings2 size={16} /> : <MoreVertical size={16} />}
            </button>
          </div>
        </div>
        {isUploading && uploadPct !== undefined && (
          <div className="media-upload-bar">
            <div className="progress-label">
              <span>Uploading</span>
              <strong>{uploadPct}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        )}
        {progress && !progress.completed && !isUploading && (
          <div className="watch-progress-bar"><span style={{ width: `${progress.completion_percent}%` }} /></div>
        )}
      </div>
    </article>
  );
}

export function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Video size={22} /></div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && onAction && (
        <button className="secondary-button small" onClick={onAction}><Plus size={15} /> {action}</button>
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
