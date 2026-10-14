"use client";

import {
  Archive,
  ArrowLeft,
  Check,
  Clock3,
  LayoutGrid,
  List,
  Pencil,
  Pin,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { DocumentaryHomeHero } from "../home/DocumentaryHomeHero";
import { HomeFolderRow } from "../home/HomeFolderRow";
import { PinnedSpaceCard } from "../home/PinnedSpaceCard";
import { LibraryPageToolbar } from "./LibraryPageToolbar";
import type { DocumentaryFolder, DocumentaryMedia } from "../../../../lib/types";
import type { LayoutMode, LibraryView, MediaFiltersState } from "./libraryTypes";
import {
  FolderCard,
  MediaCard,
  EmptyState,
  LoadingState,
} from "./LibraryCards";
type MediaAction = "favorite" | "archive" | "delete";

export function LibraryContent({
  folders,
  favoriteFolders = [],
  featuredFolders,
  heroMedia,
  heroLoading,
  continueWatching,
  continueWatchingLoading,
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
  favoriteFolders?: DocumentaryFolder[];
  featuredFolders: DocumentaryFolder[];
  heroMedia: DocumentaryMedia | null;
  heroLoading: boolean;
  continueWatching: DocumentaryMedia[];
  continueWatchingLoading: boolean;
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
  const showLibraryOverview = !selectedFolder && libraryView === "home" && !search.trim();
  const showHomeMediaGrid = libraryView === "home" && (Boolean(selectedFolder) || Boolean(search.trim()));
  const hideMainMediaSection = showLibraryOverview && !showHomeMediaGrid;
  const showFavoriteFolders = !selectedFolder && libraryView === "favorites";
  const showFilters = libraryView === "all" || !!selectedFolder;
  const showLibraryChrome = showFilters;
  const libraryPageTitle = selectedFolder
    ? selectedFolder.name
    : search.trim()
      ? `Results for “${search}”`
      : "Documentary Library";
  const libraryPageDescription = selectedFolder
    ? `${selectedFolder.media_count} videos in this space`
    : search.trim()
      ? "Videos matching your search in the documentary library."
      : "Browse corporate videos, executive messages, and HR recordings in one place.";
  const mediaSectionHeading = showLibraryChrome
    ? null
    : libraryView === "home" && search.trim()
      ? { title: `Results for “${search}”`, description: "" }
      : libraryView === "favorites"
        ? search
          ? { title: `Results for “${search}”`, description: "" }
          : { title: "Favorite videos", description: "Videos you bookmarked across the library." }
        : search
          ? { title: `Results for “${search}”`, description: "" }
          : null;

  const confirmFolderDelete = (folder: DocumentaryFolder) => {
    if (!window.confirm(`Move “${folder.name}” to the recycle bin?`)) return;
    onFolderAction(folder.id, "delete");
  };

  return (
    <>
      {showLibraryOverview && heroMedia && (
        <DocumentaryHomeHero
          media={heroMedia}
          onOpen={() => onOpenMedia(heroMedia)}
          onToggleFavorite={() => onMediaAction(heroMedia, "favorite")}
        />
      )}
      {showLibraryOverview && heroLoading && !heroMedia && <LoadingState />}
      {showLibraryOverview && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2><Pin size={16} className="section-title-icon" /> Pinned access</h2>
              <p>Start with the spaces your team returns to most.</p>
            </div>
            <button type="button" className="text-button" onClick={onViewAll}>
              View all videos <ArrowLeft size={14} className="rotate-180" />
            </button>
          </div>
          <div className="pinned-spaces-grid">
            {featuredFolders.map((folder) => (
              <PinnedSpaceCard
                key={folder.id}
                folder={folder}
                onOpen={() => onSelectFolder(folder)}
              />
            ))}
            {!featuredFolders.length && (
              <EmptyState
                title="No pinned folders yet"
                description="Pin a folder from the list below to feature it here for quick access."
              />
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
            {canManage ? (
              <button type="button" className="secondary-button small" onClick={onCreateFolder}>
                <Plus size={16} /> New folder
              </button>
            ) : null}
          </div>
          <div className="home-folder-list">
            {folders.map((folder) => (
              <HomeFolderRow
                key={folder.id}
                folder={folder}
                onOpen={() => onSelectFolder(folder)}
                onPin={() => onPinFolder(folder)}
                onFavorite={() => onFavoriteFolder(folder)}
              />
            ))}
            {!folders.length && (
              <EmptyState title="No folders yet" description="A folder gives every upload a clear home." action={canManage ? "Create a folder" : undefined} onAction={onCreateFolder} />
            )}
          </div>
        </section>
      )}
      {showLibraryOverview && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2><Clock3 size={16} className="section-title-icon" /> Continue watching</h2>
              <p>Pick up where you left off.</p>
            </div>
          </div>
          {continueWatchingLoading && <LoadingState />}
          {!continueWatchingLoading && continueWatching.length > 0 && (
            <div className="continue-watching-rail">
              {continueWatching.map((item, index) => (
                <div key={item.id} className="continue-watching-item">
                  <MediaCard
                    media={item}
                    index={index}
                    layoutMode="grid"
                    canManage={canManage}
                    selected={false}
                    onOpen={() => onOpenMedia(item)}
                    onEdit={() => onEditMedia(item)}
                    onShare={() => onShareMedia(item)}
                    onSelect={() => {}}
                    onAction={onMediaAction}
                  />
                </div>
              ))}
            </div>
          )}
          {!continueWatchingLoading && !continueWatching.length && (
            <EmptyState
              title="Nothing to continue"
              description="Start watching a video to see it here."
            />
          )}
        </section>
      )}
      {showFavoriteFolders && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>Favorite folders</h2>
              <p>Spaces you marked for quick access.</p>
            </div>
          </div>
          <div className="folder-grid">
            {favoriteFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                canManage={canManage}
                onOpen={() => onSelectFolder(folder)}
                onAction={onFolderAction}
                onEdit={() => onEditFolder(folder)}
                onPin={() => onPinFolder(folder)}
                onFavorite={() => onFavoriteFolder(folder)}
              />
            ))}
            {!favoriteFolders.length && (
              <EmptyState
                title="No favorite folders"
                description="Open a folder and tap Favorite to save it here."
              />
            )}
          </div>
        </section>
      )}
      {showLibraryChrome && (
        <LibraryPageToolbar
          title={libraryPageTitle}
          description={libraryPageDescription}
          canManage={canManage}
          layoutMode={layoutMode}
          filters={filters}
          onCreateFolder={onCreateFolder}
          onUpload={onUpload}
          onLayoutChange={onLayoutChange}
          onFiltersChange={onFiltersChange}
        />
      )}
      {!hideMainMediaSection && (
      <section className="section-block media-section">
        {(mediaSectionHeading || (selectedFolder && showLibraryChrome)) && (
        <div className="section-heading">
          {mediaSectionHeading ? (
            <div>
              <h2>{mediaSectionHeading.title}</h2>
              {mediaSectionHeading.description ? <p>{mediaSectionHeading.description}</p> : null}
            </div>
          ) : <div />}
          <div className="section-heading-actions">
            {selectedFolder && showLibraryChrome && (
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
                {canManage && selectedFolder.can_edit && (
                  <>
                    <button
                      type="button"
                      className="folder-quick-action"
                      onClick={() => onEditFolder(selectedFolder)}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="folder-quick-action danger"
                      onClick={() => confirmFolderDelete(selectedFolder)}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
            {!showLibraryChrome && (
              <div className="view-toggle">
                <button type="button" className={layoutMode === "grid" ? "active" : ""} onClick={() => onLayoutChange("grid")} aria-label="Grid view"><LayoutGrid size={16} /></button>
                <button type="button" className={layoutMode === "list" ? "active" : ""} onClick={() => onLayoutChange("list")} aria-label="List view"><List size={16} /></button>
              </div>
            )}
          </div>
        </div>
        )}
        {canManage && selectedMediaIds.length > 0 && (
          <div className="batch-toolbar">
            <span><Check size={15} /> {selectedMediaIds.length} selected</span>
            <button onClick={() => onBatchAction("favorite")}><Star size={14} /> Favorite</button>
            <button onClick={() => onBatchAction("archive")}><Archive size={14} /> Archive</button>
            <button onClick={onOpenBatchShare}><ShieldCheck size={14} /> Share</button>
            <select className="doc-select doc-select--compact" value={batchTargetFolder} onChange={(event) => onMove(event.target.value)} aria-label="Move selected videos">
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
      )}
    </>
  );
}
