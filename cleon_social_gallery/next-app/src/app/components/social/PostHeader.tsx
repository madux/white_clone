"use client";

import { MoreHorizontal } from "lucide-react";
import { formatRelativeTime, initials } from "@/lib/socialUtils";

export function PostHeader({
  userName,
  subtitle,
  createdAt,
  onMenu,
}: {
  userName: string;
  subtitle?: string;
  createdAt?: string | false;
  onMenu?: () => void;
}) {
  return (
    <header className="social-post-header">
      <div className="social-post-avatar">{initials(userName)}</div>
      <div className="social-post-header-copy">
        <strong>{userName}</strong>
        {subtitle && <span>{subtitle}</span>}
        {createdAt && <span className="social-post-time">{formatRelativeTime(createdAt)}</span>}
      </div>
      {onMenu && (
        <button type="button" className="social-post-menu" onClick={onMenu} aria-label="More options">
          <MoreHorizontal size={18} />
        </button>
      )}
    </header>
  );
}
