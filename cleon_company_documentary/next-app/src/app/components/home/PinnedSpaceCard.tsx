"use client";

import { ArrowRight, FolderOpen, Pin } from "lucide-react";
import type { DocumentaryFolder } from "../../../../lib/types";
import { scopeLabel } from "../documentaryUtils";

function formatUpdated(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PinnedSpaceCard({
  folder,
  onOpen,
}: {
  folder: DocumentaryFolder;
  onOpen: () => void;
}) {
  const updated = formatUpdated(folder.updated_at);
  const description = (folder.description || "").replace(/<[^>]*>/g, " ").trim();

  return (
    <article className="pinned-space-card">
      <button type="button" className="pinned-space-card-main" onClick={onOpen}>
        <div className="pinned-space-card-head">
          <span className="pinned-space-icon"><FolderOpen size={22} /></span>
          <span className="pinned-space-pin" aria-hidden><Pin size={15} /></span>
        </div>
        <div className="pinned-space-copy">
          <strong>{folder.name}</strong>
          <span className="pinned-space-meta">
            {folder.media_count} videos · {scopeLabel(folder.access_scope)}
          </span>
          {description ? <p>{description}</p> : null}
        </div>
        <footer className="pinned-space-footer">
          <span>{updated ? `Updated ${updated}` : ""}</span>
          <span className="pinned-space-cta">
            Open space <ArrowRight size={14} />
          </span>
        </footer>
      </button>
    </article>
  );
}
