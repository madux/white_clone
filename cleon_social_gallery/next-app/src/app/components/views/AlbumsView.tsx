"use client";

import { useState } from "react";
import { Images, MoreVertical, Pin, Plus } from "lucide-react";
import type { GalleryAlbum } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/api";
import CreateAlbumModal from "../modals/CreateAlbumModal";
import EditAlbumModal from "../modals/EditAlbumModal";
import { EmptyState } from "../shared/EmptyState";
import { LoadingGrid } from "../shared/LoadingGrid";
import { PageToolbar } from "../shared/PageToolbar";
import { AlbumCover } from "../shared/AlbumCover";
import { LoadMoreFooter } from "../shared/LoadMoreFooter";
import { StatusBadge } from "../shared/StatusBadge";

interface AlbumsViewProps {
  albums: GalleryAlbum[];
  loading: boolean;
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  onOpenAlbum: (albumId: number) => void;
  onRefresh: () => void;
  onCreateAlbum?: () => void;
  isManager?: boolean;
}

export default function AlbumsView({
  albums, loading, total, onLoadMore, loadingMore, onOpenAlbum, onRefresh, onCreateAlbum, isManager,
}: AlbumsViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editAlbum, setEditAlbum] = useState<GalleryAlbum | null>(null);
  const [sort, setSort] = useState("newest");

  const sorted = [...albums].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "photos") return b.photo_count - a.photo_count;
    if (sort === "size") return b.total_size - a.total_size;
    if (sort === "oldest") return a.create_date.localeCompare(b.create_date);
    return b.create_date.localeCompare(a.create_date);
  });

  const openCreate = () => {
    if (onCreateAlbum) onCreateAlbum();
    else setShowCreate(true);
  };

  return (
    <div>
      <PageToolbar
        left={(
          <>
            <div className="field">
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="photos">Most Photos</option>
                <option value="size">Largest Size</option>
              </select>
            </div>
            <span className="meta-muted">{total ?? albums.length} albums</span>
          </>
        )}
      />

      {loading ? (
        <LoadingGrid count={6} cols={3} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No albums found"
          description="Create your first album to organize team photos and videos."
          action={(
            <button type="button" className="primary-button" onClick={openCreate}>
              <Plus size={16} />
              Create Album
            </button>
          )}
        />
      ) : (
        <div className="folder-grid">
          {sorted.map((album) => (
            <article
              key={album.id}
              className="album-card"
              tabIndex={0}
              role="button"
              onClick={() => onOpenAlbum(album.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenAlbum(album.id);
                }
              }}
            >
              <AlbumCover
                mediaId={album.preview_media_id}
                mediaType={album.preview_media_type || undefined}
                name={album.name}
              />
              <div className="album-card-body">
                <div className="album-title-row">
                  <strong>{album.name}</strong>
                  <div className="album-card-actions">
                    {album.is_pinned && <Pin size={14} />}
                    <StatusBadge status={album.status === "approved" ? "approved" : "pending"} />
                    {album.can_edit && (
                      <button
                        type="button"
                        className="text-button"
                        aria-label="Edit album"
                        onClick={(e) => { e.stopPropagation(); setEditAlbum(album); }}
                      >
                        <MoreVertical size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <span>{album.description || "No description"}</span>
                <span>
                  {album.photo_count} photos · {album.video_count} videos · {formatBytes(album.total_size)}
                </span>
                <span className="meta-muted">{formatDate(album.create_date)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {onLoadMore && (
        <LoadMoreFooter
          shown={albums.length}
          total={total ?? albums.length}
          loading={loadingMore}
          onLoadMore={onLoadMore}
        />
      )}

      {showCreate && !onCreateAlbum && (
        <CreateAlbumModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onRefresh(); }}
        />
      )}
      {editAlbum && (
        <EditAlbumModal
          album={editAlbum}
          isManager={!!isManager}
          onClose={() => setEditAlbum(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
