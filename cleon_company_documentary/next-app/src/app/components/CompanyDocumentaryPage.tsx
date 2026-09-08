"use client";

import { Check, Plus, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocumentaryFolder, DocumentaryMedia } from "../../../lib/types";
import { api } from "../../../lib/api";
import {
  useCreateDocumentaryFolder,
  useDocumentaryFolderAction,
  useDocumentaryFolders,
  useDocumentaryMedia,
  useDocumentaryMediaAction,
  useDocumentaryMediaBatchAction,
  useDocumentaryUser,
  useUpdateDocumentaryFolder,
} from "../../../hooks/useDocumentary";
import { AnalyticsDashboard } from "./analytics/AnalyticsDashboard";
import { DocumentaryHeader } from "./layout/DocumentaryHeader";
import { DocumentarySidebar } from "./layout/DocumentarySidebar";
import { LibraryContent } from "./library/LibraryContent";
import type { LibraryView } from "./library/libraryTypes";
import {
  BatchShareModal,
  CreateFolderModal,
  type FolderSaveValues,
} from "./modals/FolderModals";
import { MediaEditModal, StorageSettingsModal } from "./modals/MediaModals";
import { UploadModal } from "./modals/UploadModal";
import { VideoModal } from "./modals/VideoModal";

export default function CompanyDocumentaryPage() {
  const [search, setSearch] = useState("");
  const [libraryView, setLibraryView] = useState<LibraryView>("home");
  const [selectedFolder, setSelectedFolder] =
    useState<DocumentaryFolder | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DocumentaryFolder | null>(
    null,
  );
  const [showUpload, setShowUpload] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<DocumentaryMedia | null>(
    null,
  );
  const [editingMedia, setEditingMedia] = useState<DocumentaryMedia | null>(
    null,
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [batchTargetFolder, setBatchTargetFolder] = useState("");
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [notice, setNotice] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const foldersQuery = useDocumentaryFolders(search);
  const mediaQuery = useDocumentaryMedia(selectedFolder?.id || null, search);
  const userQuery = useDocumentaryUser();
  const createFolder = useCreateDocumentaryFolder();
  const updateFolder = useUpdateDocumentaryFolder();
  const folderAction = useDocumentaryFolderAction();
  const mediaAction = useDocumentaryMediaAction();
  const mediaBatchAction = useDocumentaryMediaBatchAction();
  const folders = useMemo(() => foldersQuery.data ?? [], [foldersQuery.data]);
  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const featuredFolders = useMemo(
    () => folders.filter((folder) => folder.media_count > 0).slice(0, 4),
    [folders],
  );
  const visibleMedia = useMemo(() => {
    if (libraryView === "favorites")
      return media.filter((item) => item.favorite);
    if (libraryView === "recent")
      return [...media].sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime(),
      );
    return media;
  }, [libraryView, media]);
  const canManage = Boolean(
    userQuery.data?.is_admin || userQuery.data?.is_document_manager,
  );
  const isAdmin = Boolean(userQuery.data?.is_admin);

  function showNotice(type: "error" | "success", text: string) {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 4200);
  }

  function navigate(view: LibraryView) {
    setLibraryView(view);
    setSelectedFolder(null);
    setMobileNav(false);
  }

  function openFolder(folder: DocumentaryFolder) {
    setLibraryView("home");
    setSelectedFolder(folder);
    setMobileNav(false);
  }

  async function handleFolderAction(id: number, action: "archive" | "delete") {
    try {
      await folderAction.mutateAsync({ id, action });
      if (selectedFolder?.id === id) setSelectedFolder(null);
      showNotice(
        "success",
        action === "archive"
          ? "Folder archived."
          : "Folder moved to the recycle bin.",
      );
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error ? error.message : "The folder action failed.",
      );
    }
  }

  async function handleMediaAction(
    item: DocumentaryMedia,
    action: "favorite" | "archive" | "delete",
  ) {
    try {
      await mediaAction.mutateAsync({ id: item.id, action });
      showNotice(
        "success",
        action === "favorite"
          ? item.favorite
            ? "Removed from favorites."
            : "Added to favorites."
          : "Video updated.",
      );
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error ? error.message : "The video action failed.",
      );
    }
  }

  async function handleSaveFolder(values: FolderSaveValues) {
    try {
      if (values.id)
        await updateFolder.mutateAsync(
          values as { id: number; name: string; description: string },
        );
      else
        await createFolder.mutateAsync({
          ...values,
          parent_id: values.parent_id ?? selectedFolder?.id,
        });
      setShowCreateFolder(false);
      setEditingFolder(null);
      showNotice("success", values.id ? "Folder updated." : "Folder created.");
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error
          ? error.message
          : "The folder could not be saved.",
      );
    }
  }

  function toggleMediaSelection(id: number) {
    setSelectedMediaIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function handleBatchAction(action: "favorite" | "archive" | "delete") {
    if (!selectedMediaIds.length) return;
    try {
      await mediaBatchAction.mutateAsync({ ids: selectedMediaIds, action });
      setSelectedMediaIds([]);
      showNotice(
        "success",
        action === "favorite"
          ? "Favorites updated."
          : action === "archive"
            ? "Videos archived."
            : "Videos moved to the recycle bin.",
      );
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error ? error.message : "The batch action failed.",
      );
    }
  }

  async function handleBatchMove(folderId: string) {
    setBatchTargetFolder(folderId);
    if (!selectedMediaIds.length || !folderId) return;
    try {
      await mediaBatchAction.mutateAsync({
        ids: selectedMediaIds,
        action: "move",
        target_folder_id: Number(folderId),
      });
      setSelectedMediaIds([]);
      setBatchTargetFolder("");
      showNotice("success", "Videos moved to the selected folder.");
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error
          ? error.message
          : "The videos could not be moved.",
      );
    }
  }

  async function handleBatchShare(
    scope: string,
    departmentIds: number[],
    gradeIds: number[],
    employeeIds: number[],
  ) {
    try {
      for (const id of selectedMediaIds)
        await api.updateMedia({
          id,
          scope_mode: scope === "company" ? "inherited" : "override",
          access_scope: scope,
          department_ids: scope === "department" ? departmentIds : [],
          grade_ids: scope === "grade" ? gradeIds : [],
          employee_ids: scope === "employee" ? employeeIds : [],
        });
      setSelectedMediaIds([]);
      setShowBatchShare(false);
      await mediaQuery.refetch();
      showNotice("success", "Access updated for the selected videos.");
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error
          ? error.message
          : "The selected videos could not be shared.",
      );
    }
  }

  const pageTitle =
    selectedFolder?.name ||
    {
      home: "Company Documentary",
      all: "All videos",
      favorites: "Favorites",
      recent: "Recently watched",
    }[libraryView];
  const pageDescription =
    selectedFolder?.description ||
    {
      home: "A considered home for the stories, training, and knowledge that shape your company.",
      all: "Every video you can access, in one calm and searchable library.",
      favorites: "The videos your team has chosen to keep close.",
      recent: "Pick up where you left off across the company library.",
    }[libraryView];

  return (
    <main className="documentary-app">
      <DocumentarySidebar
        folders={folders}
        selectedFolder={selectedFolder}
        libraryView={libraryView}
        mediaCount={mediaQuery.data?.length || 0}
        canManage={canManage}
        isAdmin={isAdmin}
        mobileNav={mobileNav}
        userName={userQuery.data?.name}
        companyName={userQuery.data?.company_name}
        onNavigate={navigate}
        onOpenFolder={openFolder}
        onAnalytics={() => setShowAnalytics(true)}
        onStorage={() => setShowStorageSettings(true)}
        onClose={() => setMobileNav(false)}
      />
      <section className="documentary-content">
        <DocumentaryHeader
          pageTitle={pageTitle}
          search={search}
          userName={userQuery.data?.name}
          onSearch={setSearch}
          onOpenMobileNav={() => setMobileNav(true)}
        />
        <div className="content-scroll">
          <div className="page-heading-row">
            <div>
              <div className="eyebrow">Company Documentary</div>
              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>
            {canManage && (
              <div className="primary-actions">
                <button
                  className="secondary-button"
                  onClick={() => setShowCreateFolder(true)}
                >
                  <Plus size={17} /> New folder
                </button>
                <button
                  className="primary-button"
                  onClick={() => setShowUpload(true)}
                >
                  <UploadCloud size={17} /> Upload video
                </button>
              </div>
            )}
          </div>
          <LibraryContent
            folders={folders}
            featuredFolders={featuredFolders}
            selectedFolder={selectedFolder}
            libraryView={libraryView}
            pageTitle={pageTitle}
            search={search}
            canManage={canManage}
            selectedMediaIds={selectedMediaIds}
            batchTargetFolder={batchTargetFolder}
            mediaLoading={mediaQuery.isLoading}
            visibleMedia={visibleMedia}
            onCreateFolder={() => setShowCreateFolder(true)}
            onUpload={() => setShowUpload(true)}
            onViewAll={() => navigate("all")}
            onSelectFolder={openFolder}
            onBackToHome={() => navigate("home")}
            onFolderAction={handleFolderAction}
            onEditFolder={setEditingFolder}
            onSelectMedia={toggleMediaSelection}
            onOpenMedia={setSelectedMedia}
            onEditMedia={setEditingMedia}
            onMediaAction={handleMediaAction}
            onBatchAction={handleBatchAction}
            onOpenBatchShare={() => setShowBatchShare(true)}
            onMove={(folderId) => void handleBatchMove(folderId)}
            onClearSelection={() => setSelectedMediaIds([])}
            onNotice={showNotice}
          />
        </div>
      </section>
      {notice && (
        <div className={`toast ${notice.type}`}>
          <span>
            {notice.type === "success" ? <Check size={16} /> : <X size={16} />}
          </span>
          {notice.text}
        </div>
      )}
      {showCreateFolder && (
        <CreateFolderModal
          folders={folders}
          loading={createFolder.isPending}
          parentName={selectedFolder?.name}
          defaultParentId={selectedFolder?.id}
          onSave={handleSaveFolder}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
      {editingFolder && (
        <CreateFolderModal
          key={editingFolder.id}
          folders={folders}
          loading={updateFolder.isPending}
          initialFolder={editingFolder}
          onSave={handleSaveFolder}
          onClose={() => setEditingFolder(null)}
        />
      )}
      {showUpload && (
        <UploadModal
          folders={folders}
          selectedFolder={selectedFolder}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            void mediaQuery.refetch();
            showNotice("success", "Video uploaded and ready to process.");
          }}
          onError={(message) => showNotice("error", message)}
        />
      )}
      {selectedMedia && (
        <VideoModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onError={(message) => showNotice("error", message)}
        />
      )}
      {editingMedia && (
        <MediaEditModal
          media={editingMedia}
          onClose={() => setEditingMedia(null)}
          onSaved={() => {
            setEditingMedia(null);
            void mediaQuery.refetch();
            showNotice("success", "Video settings updated.");
          }}
          onError={(message) => showNotice("error", message)}
        />
      )}
      {showBatchShare && (
        <BatchShareModal
          count={selectedMediaIds.length}
          onClose={() => setShowBatchShare(false)}
          onSave={handleBatchShare}
        />
      )}
      {showAnalytics && (
        <AnalyticsDashboard
          folders={folders}
          onClose={() => setShowAnalytics(false)}
        />
      )}
      {showStorageSettings && (
        <StorageSettingsModal
          onClose={() => setShowStorageSettings(false)}
          onError={(message) => showNotice("error", message)}
          onSuccess={(message) => showNotice("success", message)}
        />
      )}
    </main>
  );
}
