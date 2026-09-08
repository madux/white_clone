"use client";

import {
  Archive,
  ArrowLeft,
  Check,
  FolderOpen,
  Library,
  Menu,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import type {
  DocumentaryFolder,
  DocumentaryMedia,
} from "../../../../lib/types";
import type { LibraryView } from "./libraryTypes";
import {
  FeaturedFolder,
  FolderCard,
  MediaCard,
  EmptyState,
  LoadingState,
} from "./LibraryCards";
import { scopeLabel } from "../documentaryUtils";

type MediaAction = "favorite" | "archive" | "delete";

export function LibraryContent({
  folders,
  featuredFolders,
  selectedFolder,
  libraryView,
  pageTitle,
  search,
  canManage,
  selectedMediaIds,
  batchTargetFolder,
  mediaLoading,
  visibleMedia,
  onCreateFolder,
  onUpload,
  onViewAll,
  onSelectFolder,
  onBackToHome,
  onFolderAction,
  onEditFolder,
  onSelectMedia,
  onOpenMedia,
  onEditMedia,
  onMediaAction,
  onBatchAction,
  onOpenBatchShare,
  onMove,
  onClearSelection,
  onNotice,
}: {
  folders: DocumentaryFolder[];
  featuredFolders: DocumentaryFolder[];
  selectedFolder: DocumentaryFolder | null;
  libraryView: LibraryView;
  pageTitle: string;
  search: string;
  canManage: boolean;
  selectedMediaIds: number[];
  batchTargetFolder: string;
  mediaLoading: boolean;
  visibleMedia: DocumentaryMedia[];
  onCreateFolder: () => void;
  onUpload: () => void;
  onViewAll: () => void;
  onSelectFolder: (folder: DocumentaryFolder) => void;
  onBackToHome: () => void;
  onFolderAction: (id: number, action: "archive" | "delete") => void;
  onEditFolder: (folder: DocumentaryFolder) => void;
  onSelectMedia: (id: number) => void;
  onOpenMedia: (media: DocumentaryMedia) => void;
  onEditMedia: (media: DocumentaryMedia) => void;
  onMediaAction: (media: DocumentaryMedia, action: MediaAction) => void;
  onBatchAction: (action: MediaAction) => void;
  onOpenBatchShare: () => void;
  onMove: (folderId: string) => void;
  onClearSelection: () => void;
  onNotice: (type: "error" | "success", text: string) => void;
}) {
  const showLibraryOverview = !selectedFolder && libraryView === "home";
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
              <FeaturedFolder
                key={folder.id}
                folder={folder}
                tint={index}
                onClick={() => onSelectFolder(folder)}
              />
            ))}
            {!featuredFolders.length && (
              <EmptyState
                title="Create your first library"
                description="Organize company stories and training into a shared space."
                action={canManage ? "Create a folder" : undefined}
                onAction={onCreateFolder}
              />
            )}
          </div>
        </section>
      )}
      {(selectedFolder || showLibraryOverview) && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>{selectedFolder ? "Folder contents" : "Folders"}</h2>
              <p>
                {selectedFolder
                  ? `${folders.find((item) => item.id === selectedFolder.id)?.media_count || 0} videos in this space`
                  : "A simple, calm place to keep every story together."}
              </p>
            </div>
            {selectedFolder && (
              <button className="text-button" onClick={onBackToHome}>
                <ArrowLeft size={14} /> All folders
              </button>
            )}
          </div>
          <div className="folder-grid">
            {!selectedFolder &&
              folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  canManage={canManage}
                  onOpen={() => onSelectFolder(folder)}
                  onAction={onFolderAction}
                  onEdit={() => onEditFolder(folder)}
                />
              ))}
            {selectedFolder && (
              <div className="folder-context-card">
                <div className="folder-icon large">
                  <FolderOpen size={25} />
                </div>
                <div>
                  <strong>{selectedFolder.name}</strong>
                  <span>
                    {scopeLabel(selectedFolder.access_scope)} ·{" "}
                    {selectedFolder.media_count} videos
                  </span>
                </div>
                <button
                  className="icon-button"
                  onClick={onBackToHome}
                  aria-label="Go back"
                >
                  <ArrowLeft size={17} />
                </button>
              </div>
            )}
            {!selectedFolder && !folders.length && (
              <EmptyState
                title="No folders yet"
                description="A folder gives every upload a clear home."
                action={canManage ? "Create a folder" : undefined}
                onAction={onCreateFolder}
              />
            )}
          </div>
        </section>
      )}
      <section className="section-block media-section">
        <div className="section-heading">
          <div>
            <h2>
              {selectedFolder
                ? selectedFolder.name
                : libraryView === "home"
                  ? "Latest videos"
                  : pageTitle}
            </h2>
            <p>
              {search
                ? `Results matching “${search}”`
                : "The latest additions to your company library."}
            </p>
          </div>
          <div className="view-toggle">
            <button className="active" aria-label="Grid view">
              <Library size={16} />
            </button>
            <button
              onClick={() =>
                onNotice("success", "Grid view is the default library layout.")
              }
              aria-label="List view"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
        {canManage && selectedMediaIds.length > 0 && (
          <div className="batch-toolbar">
            <span>
              <Check size={15} /> {selectedMediaIds.length} selected
            </span>
            <button onClick={() => onBatchAction("favorite")}>
              <Star size={14} /> Favorite
            </button>
            <button onClick={() => onBatchAction("archive")}>
              <Archive size={14} /> Archive
            </button>
            <button onClick={onOpenBatchShare}>
              <ShieldCheck size={14} /> Share
            </button>
            <select
              value={batchTargetFolder}
              onChange={(event) => onMove(event.target.value)}
              aria-label="Move selected videos"
            >
              <option value="">Move to…</option>
              {folders
                .filter((folder) => folder.can_edit)
                .map((folder) => (
                  <option value={folder.id} key={folder.id}>
                    {folder.name}
                  </option>
                ))}
            </select>
            <button className="danger" onClick={() => onBatchAction("delete")}>
              <Trash2 size={14} /> Recycle
            </button>
            <button className="batch-clear" onClick={onClearSelection}>
              Clear
            </button>
          </div>
        )}
        <div className="media-grid">
          {mediaLoading && <LoadingState />}
          {!mediaLoading &&
            visibleMedia.map((item, index) => (
              <MediaCard
                key={item.id}
                media={item}
                index={index}
                canManage={canManage}
                selected={selectedMediaIds.includes(item.id)}
                onOpen={() => onOpenMedia(item)}
                onEdit={() => onEditMedia(item)}
                onSelect={() => onSelectMedia(item.id)}
                onAction={onMediaAction}
              />
            ))}
          {!mediaLoading && !visibleMedia.length && (
            <EmptyState
              title={
                search
                  ? "No videos found"
                  : libraryView === "favorites"
                    ? "No favorites yet"
                    : "Your video library is ready"
              }
              description={
                search
                  ? "Try a different title, filename, or tag."
                  : "Upload a video to make your company knowledge easy to revisit."
              }
              action={
                canManage && !selectedFolder
                  ? "Create a folder first"
                  : canManage
                    ? "Upload a video"
                    : undefined
              }
              onAction={selectedFolder ? onUpload : onCreateFolder}
            />
          )}
        </div>
      </section>
    </>
  );
}
