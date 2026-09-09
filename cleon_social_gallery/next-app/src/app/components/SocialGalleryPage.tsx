"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import type { GalleryMedia, GalleryView, LayoutMode } from "@/lib/types";
import { api } from "@/lib/api";
import Sidebar from "./layout/Sidebar";
import { GalleryHeader } from "./layout/GalleryHeader";
import DashboardView from "./views/DashboardView";
import AlbumsView from "./views/AlbumsView";
import GalleryFeedView, { AlbumDetailView } from "./views/GalleryViews";
import SettingsView from "./views/SettingsView";
import {
  AuditLogView, ContributionsView, DuplicateScanView, FlaggedContentView,
  PendingAIReviewView, PendingReviewView, RecycleBinView, UploadHistoryView,
} from "./views/AdminViews";
import MediaDetailModal from "./modals/MediaDetailModal";
import CreateAlbumModal from "./modals/CreateAlbumModal";
import UploadModal from "./modals/UploadModal";
import { LoadingState } from "./shared/LoadingState";
import { QueryError } from "./shared/QueryError";
import {
  applyGalleryTheme, isValidLayout, useGalleryAlbums, useGalleryAudit,
  useGalleryDashboard, useGalleryDuplicates, useGalleryFlagged, useGalleryMedia, useGalleryPending,
  useGalleryPendingAi, useGalleryRecycle, useGallerySettings, useGalleryUploadHistory, useGalleryUser,
} from "@/hooks/useSocialGallery";

const VIEW_LABELS: Record<GalleryView, string> = {
  dashboard: "Dashboard",
  albums: "Albums",
  gallery: "Gallery",
  pending: "Pending Review",
  "pending-ai": "Pending AI Review",
  flagged: "Flagged Content",
  recycle: "Recycle Bin",
  contributions: "My Contributions",
  "upload-history": "Upload History",
  duplicates: "Duplicate Media Manager",
  audit: "Audit Log",
  settings: "Settings",
};

export default function SocialGalleryPage() {
  const [activeView, setActiveView] = useState<GalleryView>("dashboard");
  const [search, setSearch] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<GalleryMedia | null>(null);
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [mobileNav, setMobileNav] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const userQuery = useGalleryUser();
  const user = userQuery.data;
  const isManager = !!(user?.is_gallery_manager || user?.is_gallery_admin || user?.is_admin);
  const isAdmin = !!(user?.is_gallery_admin || user?.is_admin);

  const dashboardQuery = useGalleryDashboard();
  const albumsQuery = useGalleryAlbums(search);
  const mediaParams = useMemo(() => ({
    search,
    album_id: selectedAlbumId || undefined,
    approval_status: activeView === "gallery" || selectedAlbumId ? "approved" : undefined,
  }), [search, selectedAlbumId, activeView]);
  const mediaQuery = useGalleryMedia(mediaParams);
  const pendingQuery = useGalleryPending(isManager);
  const pendingAiQuery = useGalleryPendingAi(isManager);
  const flaggedQuery = useGalleryFlagged(isManager);
  const recycleQuery = useGalleryRecycle(isManager);
  const uploadHistoryQuery = useGalleryUploadHistory(true);
  const auditQuery = useGalleryAudit({}, isManager);
  const settingsQuery = useGallerySettings(isAdmin);
  const duplicatesQuery = useGalleryDuplicates(activeView === "duplicates" && isManager);

  const pendingCount = pendingQuery.data?.length || 0;
  const aiReviewCount = pendingAiQuery.data?.length || 0;
  const flaggedReports = Array.isArray(flaggedQuery.data) ? flaggedQuery.data : [];
  const flaggedCount = flaggedReports.length;

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!settingsQuery.data) return;
    applyGalleryTheme(settingsQuery.data.theme_color);
    if (isValidLayout(settingsQuery.data.default_layout)) {
      setLayout(settingsQuery.data.default_layout);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("share");
    if (!token) return;
    api.shareResolve(token)
      .then((result) => {
        if (result.type === "media") {
          setSelectedMedia(result.media);
        } else {
          setActiveView("albums");
          setSelectedAlbumId(result.album.id);
        }
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Invalid share link", true));
  }, []);

  const refreshAll = () => {
    dashboardQuery.refetch();
    albumsQuery.refetch();
    mediaQuery.refetch();
    if (isManager) {
      pendingQuery.refetch();
      pendingAiQuery.refetch();
      flaggedQuery.refetch();
      recycleQuery.refetch();
      auditQuery.refetch();
      if (activeView === "duplicates") duplicatesQuery.refetch();
    }
    uploadHistoryQuery.refetch();
    if (isAdmin) settingsQuery.refetch();
  };

  const selectedAlbum = useMemo(() => {
    if (!selectedAlbumId) return null;
    return albumsQuery.data?.find((a) => a.id === selectedAlbumId)
      || dashboardQuery.data?.recent_albums?.find((a) => a.id === selectedAlbumId)
      || null;
  }, [selectedAlbumId, albumsQuery.data, dashboardQuery.data]);

  const headerTitle = selectedAlbum
    ? `Albums › ${selectedAlbum.name}`
    : VIEW_LABELS[activeView];
  const showUploadActions = !selectedAlbumId && (activeView === "albums" || activeView === "gallery");

  const navigate = (view: GalleryView) => {
    setActiveView(view);
    setSelectedAlbumId(null);
    setMobileNav(false);
  };

  const openAlbum = (id: number) => {
    setActiveView("albums");
    setSelectedAlbumId(id);
    setMobileNav(false);
  };

  const renderContent = () => {
    if (userQuery.isLoading) return <LoadingState message="Loading workspace…" />;
    if (userQuery.isError) {
      return <QueryError message={userQuery.error instanceof Error ? userQuery.error.message : undefined} onRetry={() => userQuery.refetch()} />;
    }

    if (selectedAlbumId) {
      if (albumsQuery.isLoading && !selectedAlbum) {
        return <LoadingState message="Loading album…" />;
      }
      if (!selectedAlbum) {
        return <QueryError message="Album not found." onRetry={() => { setSelectedAlbumId(null); albumsQuery.refetch(); }} />;
      }
      if (mediaQuery.isError) {
        return <QueryError message={mediaQuery.error instanceof Error ? mediaQuery.error.message : undefined} onRetry={() => mediaQuery.refetch()} />;
      }
      return (
        <AlbumDetailView
          album={selectedAlbum}
          media={mediaQuery.data || []}
          loading={mediaQuery.isLoading}
          layout={layout}
          onLayoutChange={setLayout}
          onOpenMedia={setSelectedMedia}
          onBack={() => setSelectedAlbumId(null)}
          onRefresh={refreshAll}
          onUpload={() => setShowUpload(true)}
          fromDashboard={activeView === "dashboard"}
        />
      );
    }

    switch (activeView) {
      case "dashboard":
        if (dashboardQuery.isError) {
          return <QueryError message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : undefined} onRetry={() => dashboardQuery.refetch()} />;
        }
        return (
          <DashboardView
            data={dashboardQuery.data}
            loading={dashboardQuery.isLoading}
            onOpenPending={() => navigate("pending")}
            onOpenAlbum={openAlbum}
          />
        );
      case "albums":
        if (albumsQuery.isError) {
          return <QueryError message={albumsQuery.error instanceof Error ? albumsQuery.error.message : undefined} onRetry={() => albumsQuery.refetch()} />;
        }
        return (
          <AlbumsView
            albums={albumsQuery.data || []}
            loading={albumsQuery.isLoading}
            onOpenAlbum={openAlbum}
            onRefresh={refreshAll}
            onCreateAlbum={() => setShowCreateAlbum(true)}
            isManager={isManager}
          />
        );
      case "gallery":
        if (mediaQuery.isError) {
          return <QueryError message={mediaQuery.error instanceof Error ? mediaQuery.error.message : undefined} onRetry={() => mediaQuery.refetch()} />;
        }
        return (
          <GalleryFeedView
            media={mediaQuery.data || []}
            loading={mediaQuery.isLoading}
            layout={layout}
            onLayoutChange={setLayout}
            onOpenMedia={setSelectedMedia}
            albums={albumsQuery.data}
            onRefresh={refreshAll}
            onUpload={() => setShowUpload(true)}
          />
        );
      case "pending":
        return (
          <PendingReviewView
            media={pendingQuery.data || []}
            loading={pendingQuery.isLoading}
            error={pendingQuery.isError ? (pendingQuery.error instanceof Error ? pendingQuery.error.message : "Failed to load") : undefined}
            albums={(albumsQuery.data || []).map((a) => ({ id: a.id, name: a.name }))}
            onRefresh={() => { refreshAll(); showToast("Review updated"); }}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "pending-ai":
        return (
          <PendingAIReviewView
            media={pendingAiQuery.data || []}
            loading={pendingAiQuery.isLoading}
            onRefresh={refreshAll}
            onOpenMedia={setSelectedMedia}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "flagged":
        return (
          <FlaggedContentView
            reports={flaggedReports}
            loading={flaggedQuery.isLoading}
            onRefresh={() => { refreshAll(); showToast("Flag resolved"); }}
            onOpenMedia={setSelectedMedia}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "recycle":
        return (
          <RecycleBinView
            media={recycleQuery.data || []}
            loading={recycleQuery.isLoading}
            isAdmin={isAdmin}
            onRefresh={() => { refreshAll(); showToast("Recycle bin updated"); }}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "contributions":
        return <ContributionsView onOpenMedia={setSelectedMedia} />;
      case "upload-history":
        return <UploadHistoryView history={uploadHistoryQuery.data || []} loading={uploadHistoryQuery.isLoading} onOpenMedia={setSelectedMedia} />;
      case "duplicates":
        return <DuplicateScanView groups={duplicatesQuery.data || []} loading={duplicatesQuery.isLoading} onRefresh={refreshAll} onError={(msg) => showToast(msg, true)} />;
      case "audit":
        return <AuditLogView logs={auditQuery.data || []} loading={auditQuery.isLoading} />;
      case "settings":
        return (
          <SettingsView
            settings={settingsQuery.data}
            loading={settingsQuery.isLoading}
            albums={albumsQuery.data || []}
            onRefresh={() => { settingsQuery.refetch(); showToast("Settings saved"); }}
            onError={(msg) => showToast(msg, true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="gallery-app">
      {mobileNav && <div className="mobile-overlay" onClick={() => setMobileNav(false)} role="presentation" />}
      <Sidebar
        activeView={activeView}
        onNavigate={navigate}
        pendingCount={pendingCount}
        aiReviewCount={aiReviewCount}
        flaggedCount={flaggedCount}
        isManager={isManager}
        isAdmin={isAdmin}
        mobileNav={mobileNav}
        onClose={() => setMobileNav(false)}
      />
      <div className="gallery-content">
        <div className="gallery-header-wrap">
          <GalleryHeader
            pageTitle={headerTitle}
            search={search}
            userName={user?.name}
            onSearch={setSearch}
            onOpenMobileNav={() => setMobileNav(true)}
          />
        </div>
        <div className="content-scroll">
          {showUploadActions && (
            <div className="page-actions-row">
              <div className="primary-actions">
                <button type="button" className="secondary-button" onClick={() => setShowCreateAlbum(true)}>
                  <Plus size={16} />
                  Create Album
                </button>
                <button type="button" className="primary-button" onClick={() => setShowUpload(true)}>
                  <Upload size={16} />
                  Upload Media
                </button>
              </div>
            </div>
          )}
          {renderContent()}
        </div>
      </div>

      {selectedMedia && (
        <MediaDetailModal
          media={selectedMedia}
          albums={albumsQuery.data || []}
          userId={user?.id}
          isManager={isManager}
          allowExternalShare={settingsQuery.data?.allow_external_share}
          onClose={() => setSelectedMedia(null)}
          onRefresh={refreshAll}
          onError={(msg) => showToast(msg, true)}
        />
      )}
      {showCreateAlbum && (
        <CreateAlbumModal
          onClose={() => setShowCreateAlbum(false)}
          onCreated={() => { setShowCreateAlbum(false); refreshAll(); showToast("Album created"); }}
        />
      )}
      {showUpload && (
        <UploadModal
          albumId={selectedAlbumId || undefined}
          albums={albumsQuery.data}
          onClose={() => setShowUpload(false)}
          onComplete={() => { setShowUpload(false); refreshAll(); showToast("Upload complete"); }}
        />
      )}
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`}>
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
