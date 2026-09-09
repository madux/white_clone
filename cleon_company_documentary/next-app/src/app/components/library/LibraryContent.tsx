"use client";

import {
  Archive,
  ArrowLeft,
  Check,
  Filter,
  LayoutGrid,
  List,
  Pin,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import type { DocumentaryFolder, DocumentaryMedia } from "../../../../lib/types";
import type { LayoutMode, LibraryView, MediaFiltersState } from "./libraryTypes";
import {
  FeaturedFolder,
  FolderCard,
  MediaCard,
  EmptyState,
  LoadingState,
} from "./LibraryCards";
type MediaAction = "favorite" | "archive" | "delete";

export function LibraryContent({
  folders,
  featuredFolders,
  selectedFolder,
  libraryView,
  search,
  canManage,
  layoutMode,
  filters,
  selectedMediaIds,
  batchTargetFolder,
  mediaLoading,
  visibleMedia,
  uploadProgressByMediaId,
  onCreateFolder,
  onUpload,
  onViewAll,
  onSelectFolder,
  onPinFolder,
  onFavoriteFolder,
  onFolderAction,
  onEditFolder,
  onSelectMedia,
  onOpenMedia,
  onShareMedia,
  onEditMedia,
  onMediaAction,
  onBatchAction,
  onOpenBatchShare,
  onMove,
  onClearSelection,
  onLayoutChange,
  onFiltersChange,
  onNotice,
}: {
  folders: DocumentaryFolder[];
  featuredFolders: DocumentaryFolder[];
  selectedFolder: DocumentaryFolder | null;
  libraryView: LibraryView;
  search: string;
  canManage: boolean;
  layoutMode: LayoutMode;
  filters: MediaFiltersState;
  selectedMediaIds: number[];
  batchTargetFolder: string;
  mediaLoading: boolean;
  visibleMedia: DocumentaryMedia[];
  uploadProgressByMediaId?: Record<number, number>;
  onCreateFolder: () => void;
  onUpload: () => void;
  onViewAll: () => void;
  onSelectFolder: (folder: DocumentaryFolder) => void;
  onPinFolder: (folder: DocumentaryFolder) => void;
  onFavoriteFolder: (folder: DocumentaryFolder) => void;
  onFolderAction: (id: number, action: "archive" | "delete") => void;
  onEditFolder: (folder: DocumentaryFolder) => void;
  onSelectMedia: (id: number) => void;
  onOpenMedia: (media: DocumentaryMedia) => void;
  onShareMedia: (media: DocumentaryMedia) => void;
  onEditMedia: (media: DocumentaryMedia) => void;
  onMediaAction: (media: DocumentaryMedia, action: MediaAction) => void;
  onBatchAction: (action: MediaAction) => void;
  onOpenBatchShare: () => void;
  onMove: (folderId: string) => void;
  onClearSelection: () => void;
  onLayoutChange: (mode: LayoutMode) => void;
  onFiltersChange: (filters: MediaFiltersState) => void;
  onNotice: (type: "error" | "success", text: string) => void;
}) {
  const showLibraryOverview = !selectedFolder && libraryView === "home";
  const showFilters = libraryView === "all" || !!selectedFolder;
  const mediaSectionHeading = selectedFolder
    ? { title: selectedFolder.name, description: `${selectedFolder.media_count} videos in this space` }
    : libraryView === "home"
      ? search
        ? { title: `Results for “${search}”`, description: "" }
        : { title: "Latest videos", description: "" }
      : search
        ? { title: `Results for “${search}”`, description: "" }
        : null;

  return (
    <>
      {showLibraryOverview && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>Pinned access</h2>
              <p>Start with the spaces your team returns to most.</p>
            </div>
            <button className="text-button" onClick={onViewAll}>
              View all <ArrowLeft size={14} className="rotate-180" />
            </button>
          </div>
          <div className="featured-grid">
            {featuredFolders.map((folder, index) => (
              <FeaturedFolder key={folder.id} folder={folder} tint={index} onClick={() => onSelectFolder(folder)} onPin={() => onPinFolder(folder)} canManage={canManage} />
            ))}
            {!featuredFolders.length && (
              <EmptyState title="Create your first library" description="Organize company stories and training into a shared space." action={canManage ? "Create a folder" : undefined} onAction={onCreateFolder} />
            )}
          </div>
        </section>
      )}
      {showLibraryOverview && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>Folders</h2>
              <p>A simple, calm place to keep every story together.</p>
            </div>
          </div>
          <div className="folder-grid">
            {folders.map((folder) => (
              <FolderCard key={folder.id} folder={folder} canManage={canManage} onOpen={() => onSelectFolder(folder)} onAction={onFolderAction} onEdit={() => onEditFolder(folder)} onPin={() => onPinFolder(folder)} />
            ))}
            {!folders.length && (
              <EmptyState title="No folders yet" description="A folder gives every upload a clear home." action={canManage ? "Create a folder" : undefined} onAction={onCreateFolder} />
            )}
          </div>
        </section>
      )}
      <section className="section-block media-section">
        <div className="section-heading">
          {mediaSectionHeading ? (
            <div>
              <h2>{mediaSectionHeading.title}</h2>
              {mediaSectionHeading.description ? <p>{mediaSectionHeading.description}</p> : null}
            </div>
          ) : <div />}
          <div className="section-heading-actions">
            {selectedFolder && (
              <div className="folder-quick-actions">
                <button
                  type="button"
                  className={`folder-quick-action${selectedFolder.favorite ? " active" : ""}`}
                  onClick={() => onFavoriteFolder(selectedFolder)}
                  aria-label={selectedFolder.favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={15} fill={selectedFolder.favorite ? "currentColor" : "none"} />
                  Favorite
                </button>
                <button
                  type="button"
                  className={`folder-quick-action${selectedFolder.is_pinned ? " active" : ""}`}
                  onClick={() => onPinFolder(selectedFolder)}
                  aria-label={selectedFolder.is_pinned ? "Unpin folder" : "Pin folder"}
                >
                  <Pin size={15} fill={selectedFolder.is_pinned ? "currentColor" : "none"} />
                  Pin
                </button>
              </div>
            )}
            <div className="view-toggle">
              <button className={layoutMode === "grid" ? "active" : ""} onClick={() => onLayoutChange("grid")} aria-label="Grid view"><LayoutGrid size={16} /></button>
              <button className={layoutMode === "list" ? "active" : ""} onClick={() => onLayoutChange("list")} aria-label="List view"><List size={16} /></button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div className="filter-toolbar">
            <Filter size={15} />
            <select value={filters.processing_state || ""} onChange={(e) => onFiltersChange({ ...filters, processing_state: e.target.value || undefined })}>
              <option value="">All statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="uploading">Uploading</option>
              <option value="failed">Failed</option>
            </select>
            <select value={filters.approval_status || ""} onChange={(e) => onFiltersChange({ ...filters, approval_status: e.target.value || undefined })}>
              <option value="">All approval states</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="rejected">Rejected</option>
            </select>
            <label className="filter-check">
              <input type="checkbox" checked={Boolean(filters.mandatory)} onChange={(e) => onFiltersChange({ ...filters, mandatory: e.target.checked || undefined })} />
              Mandatory only
            </label>
            <button className="text-button" onClick={() => onFiltersChange({})}>Clear filters</button>
          </div>
        )}
        {canManage && selectedMediaIds.length > 0 && (
          <div className="batch-toolbar">
            <span><Check size={15} /> {selectedMediaIds.length} selected</span>
            <button onClick={() => onBatchAction("favorite")}><Star size={14} /> Favorite</button>
            <button onClick={() => onBatchAction("archive")}><Archive size={14} /> Archive</button>
            <button onClick={onOpenBatchShare}><ShieldCheck size={14} /> Share</button>
            <select value={batchTargetFolder} onChange={(event) => onMove(event.target.value)} aria-label="Move selected videos">
              <option value="">Move to…</option>
              {folders.filter((folder) => folder.can_edit).map((folder) => (
                <option value={folder.id} key={folder.id}>{folder.name}</option>
              ))}
            </select>
            <button className="danger" onClick={() => onBatchAction("delete")}><Trash2 size={14} /> Recycle</button>
            <button className="batch-clear" onClick={onClearSelection}>Clear</button>
          </div>
        )}
        <div className={layoutMode === "list" ? "media-list" : "media-grid"}>
          {mediaLoading && <LoadingState />}
          {!mediaLoading && visibleMedia.map((item, index) => (
            <MediaCard key={item.id} media={item} index={index} layoutMode={layoutMode} canManage={canManage} selected={selectedMediaIds.includes(item.id)} uploadProgress={uploadProgressByMediaId?.[item.id]} onOpen={() => onOpenMedia(item)} onEdit={() => onEditMedia(item)} onShare={() => onShareMedia(item)} onSelect={() => onSelectMedia(item.id)} onAction={onMediaAction} />
          ))}
          {!mediaLoading && !visibleMedia.length && (
            <EmptyState
              title={search ? "No videos found" : libraryView === "favorites" ? "No favorites yet" : libraryView === "recent" ? "Nothing to continue" : "Your video library is ready"}
              description={search ? "Try a different title, filename, or tag." : libraryView === "recent" ? "Start watching a video to see it here." : "Upload a video to make your company knowledge easy to revisit."}
              action={canManage && !selectedFolder ? "Create a folder first" : canManage ? "Upload a video" : undefined}
              onAction={selectedFolder ? onUpload : onCreateFolder}
            />
          )}
        </div>
      </section>
    </>
  );
}
