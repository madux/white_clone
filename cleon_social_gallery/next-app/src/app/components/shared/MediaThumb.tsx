"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Play, Video } from "lucide-react";
import type { GalleryMedia } from "@/lib/types";
import { api } from "@/lib/api";

export function MediaThumb({
  media,
  className = "",
  selectable = false,
  selected = false,
  onSelect,
  showOverlay = true,
  showDescriptionOnHover = false,
  description,
}: {
  media: GalleryMedia;
  className?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  showOverlay?: boolean;
  /** SRS §3.4 FR-047: show description as overlay on hover (album detail grid). */
  showDescriptionOnHover?: boolean;
  description?: string;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.thumbnailUrl(media.id)
      .then((result) => { if (active) setUrl(result.url); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [media.id]);

  const isVideo = media.media_type === "video";
  const descText = (description ?? media.description ?? "").trim();

  return (
    <div className={`media-preview rose ${showDescriptionOnHover ? "has-desc-hover" : ""} ${className}`.trim()}>
      {loading && <div className="thumb-skeleton" />}
      {url ? (
        isVideo ? (
          <video src={url} muted playsInline />
        ) : (
          <img src={url} alt={media.display_name} loading="lazy" />
        )
      ) : !loading ? (
        isVideo ? <Video size={28} /> : <ImageIcon size={28} />
      ) : null}
      {showOverlay && (
        <>
          <span className="media-type-badge">{isVideo ? "Video" : "Photo"}</span>
          {isVideo && <span className="play-button"><Play size={18} fill="currentColor" /></span>}
        </>
      )}
      {showDescriptionOnHover && descText && (
        <div className="media-desc-overlay" aria-hidden>
          <p>{descText}</p>
        </div>
      )}
      {selectable && (
        <label className="media-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect?.(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
          />
        </label>
      )}
    </div>
  );
}

export { StatusBadge } from "./StatusBadge";
