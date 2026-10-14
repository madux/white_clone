"use client";

import { Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentaryMedia } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { formatDuration, initials } from "../documentaryUtils";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function resolutionBadge(media: DocumentaryMedia): string | null {
  if (media.resolution) {
    const upper = media.resolution.toUpperCase();
    if (upper.includes("3840") || upper.includes("4K")) return "4K UHD";
    if (upper.includes("1920") || upper.includes("1080")) return "1080p FHD";
    return media.resolution;
  }
  const variant = Object.keys(media.variants || {}).find((key) => /4k|2160|uhd/i.test(key));
  if (variant) return "4K UHD";
  return null;
}

export function DocumentaryHomeHero({
  media,
  onOpen,
  onToggleFavorite,
}: {
  media: DocumentaryMedia;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const progress = media.watch_progress;
  const completed = progress?.completed;
  const percent = progress ? Math.round(progress.completion_percent) : 0;
  const resBadge = resolutionBadge(media);
  const description = stripHtml(media.description || "").slice(0, 220);
  const speakerLine = [media.uploader_name, media.uploader_job_title].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!media.thumbnail_available) return () => undefined;
    let active = true;
    api.assetReadUrl(media.id, "thumbnail").then((result) => {
      if (active) setThumbnailUrl(result.url);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [media.id, media.thumbnail_available]);

  return (
    <section className="home-hero section-block">
      <div
        className={`home-hero-backdrop${thumbnailUrl ? " has-thumbnail" : ""}`}
        style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}
      >
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <div className="home-hero-badges">
            <span className="home-hero-eyebrow">
              {media.is_hero ? "Featured masterclass" : "Latest video"}
            </span>
            {media.duration_seconds ? (
              <span className="home-hero-meta-pill">{formatDuration(media.duration_seconds)}</span>
            ) : null}
            {resBadge ? <span className="home-hero-meta-pill">{resBadge}</span> : null}
          </div>
          <h2 className="home-hero-title">{media.title}</h2>
          {description ? <p className="home-hero-description">{description}</p> : null}
          {speakerLine ? (
            <div className="home-hero-speaker">
              <span className="home-hero-speaker-avatar">{initials(media.uploader_name || "?")}</span>
              <span>{speakerLine}</span>
            </div>
          ) : null}
          <div className="home-hero-actions">
            <button type="button" className="primary-button home-hero-play" onClick={onOpen}>
              <Play size={18} fill="currentColor" />
              {completed
                ? "Watch again"
                : percent > 0
                  ? `Resume watching (${percent}%)`
                  : "Watch now"}
            </button>
            <button
              type="button"
              className={`secondary-button home-hero-bookmark${media.favorite ? " is-active" : ""}`}
              onClick={onToggleFavorite}
            >
              <Star size={17} fill={media.favorite ? "currentColor" : "none"} />
              {media.favorite ? "Bookmarked" : "Bookmark"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
