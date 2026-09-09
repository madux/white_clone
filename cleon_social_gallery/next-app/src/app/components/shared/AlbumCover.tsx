"use client";

import { useEffect, useState } from "react";
import { Images, Play } from "lucide-react";
import { api } from "@/lib/api";

export function AlbumCover({
  mediaId,
  mediaType,
  name,
  className = "sg-album-cover",
  iconSize = 32,
}: {
  mediaId?: number | false;
  mediaType?: string;
  name: string;
  className?: string;
  iconSize?: number;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!mediaId) {
      setUrl("");
      return undefined;
    }
    let active = true;
    api.thumbnailUrl(mediaId)
      .then((result) => { if (active) setUrl(result.url); })
      .catch(() => { if (active) setUrl(""); });
    return () => { active = false; };
  }, [mediaId]);

  if (!mediaId || !url) {
    return (
      <div className={`${className} placeholder`}>
        <Images size={iconSize} />
      </div>
    );
  }

  const isVideo = mediaType === "video";

  return (
    <div className={className}>
      {isVideo ? (
        <video src={url} muted playsInline className="album-cover-media" />
      ) : (
        <img src={url} alt={name} className="album-cover-media" loading="lazy" />
      )}
      {isVideo && (
        <span className="album-cover-play">
          <Play size={16} fill="currentColor" />
        </span>
      )}
    </div>
  );
}
