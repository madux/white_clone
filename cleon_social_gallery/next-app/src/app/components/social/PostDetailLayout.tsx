"use client";

import type { ReactNode } from "react";

export function PostDetailLayout({
  media,
  sidebar,
}: {
  media: ReactNode;
  sidebar: ReactNode;
}) {
  return (
    <div className="social-post-layout">
      <div className="social-post-media">{media}</div>
      <div className="social-post-sidebar">{sidebar}</div>
    </div>
  );
}
