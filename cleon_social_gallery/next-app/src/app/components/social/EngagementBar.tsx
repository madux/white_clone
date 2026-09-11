"use client";

import { Download, Heart, MessageCircle, Share2 } from "lucide-react";
import type { ReactNode } from "react";

export function EngagementBar({
  liked,
  onLike,
  onComment,
  onShare,
  onDownload,
  extra,
}: {
  liked?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="social-post-engagement">
      {onLike && (
        <button
          type="button"
          className={`social-post-icon-btn ${liked ? "is-liked" : ""}`}
          onClick={onLike}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart size={22} fill={liked ? "currentColor" : "none"} />
        </button>
      )}
      {onComment && (
        <button type="button" className="social-post-icon-btn" onClick={onComment} aria-label="Comment">
          <MessageCircle size={22} />
        </button>
      )}
      {onShare && (
        <button type="button" className="social-post-icon-btn" onClick={onShare} aria-label="Share">
          <Share2 size={22} />
        </button>
      )}
      {onDownload && (
        <button type="button" className="social-post-icon-btn" onClick={onDownload} aria-label="Download">
          <Download size={22} />
        </button>
      )}
      {extra}
    </div>
  );
}

export function LikeCount({ count }: { count: number }) {
  if (!count) return null;
  return (
    <p className="social-post-like-count">
      <strong>{count}</strong> {count === 1 ? "like" : "likes"}
    </p>
  );
}
