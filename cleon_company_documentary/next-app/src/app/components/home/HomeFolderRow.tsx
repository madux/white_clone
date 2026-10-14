"use client";

import { Folder, Pin, Star } from "lucide-react";
import type { DocumentaryFolder } from "../../../../lib/types";
import { scopeLabel } from "../documentaryUtils";

export function HomeFolderRow({
  folder,
  onOpen,
  onPin,
  onFavorite,
}: {
  folder: DocumentaryFolder;
  onOpen: () => void;
  onPin: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className="home-folder-row">
      <button type="button" className="home-folder-row-main" onClick={onOpen}>
        <span className="home-folder-row-icon"><Folder size={20} /></span>
        <span className="home-folder-row-copy">
          <strong>{folder.name}</strong>
          <span>{folder.media_count} videos · {scopeLabel(folder.access_scope)}</span>
        </span>
      </button>
      <div className="home-folder-row-actions">
        <button
          type="button"
          className={`icon-button compact${folder.is_pinned ? " is-active" : ""}`}
          onClick={onPin}
          aria-label={folder.is_pinned ? "Unpin folder" : "Pin folder"}
        >
          <Pin size={16} fill={folder.is_pinned ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className={`icon-button compact${folder.favorite ? " is-active" : ""}`}
          onClick={onFavorite}
          aria-label={folder.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={16} fill={folder.favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
