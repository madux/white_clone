"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import type { GalleryMedia, LayoutMode } from "@/lib/types";
import { api } from "@/lib/api";
import type { GalleryStatusFilter } from "./gallery/GalleryLibraryChrome";
import Sidebar from "./layout/Sidebar";
import { GalleryHeader } from "./layout/GalleryHeader";
import DashboardView from "./views/DashboardView";
import AlbumsView from "./views/AlbumsView";
import GalleryFeedView from "./views/GalleryViews";
import AlbumDetailView from "./views/AlbumDetailView";
import SettingsView from "./views/SettingsView";
import {
  AuditLogView, ContributionsView, PendingReviewView, RecycleBinView, UploadHistoryView,
} from "./views/AdminViews";
import MediaDetailModal from "./modals/MediaDetailModal";
import CreateAlbumModal from "./modals/CreateAlbumModal";
import UploadModal from "./modals/UploadModal";
import { LoadingState } from "./shared/LoadingState";
import { QueryError } from "./shared/QueryError";
import type { GalleryView } from "@/lib/types";
import { useNavigationHistory } from "@/hooks/useNavigationHistory";
import {
  normalizeLayout, useGalleryAlbums,
  useGalleryDashboard, useGalleryMedia, useGalleryPending,
  galleryKeys,
  useGalleryRecycle, useGallerySettings, useGalleryUploadHistory, useGalleryUser,
} from "@/hooks/useSocialGallery";
import {
  canAccessGalleryView,
  canCreateAlbum,
  canShowListUploadButton,
  defaultGalleryViewForTier,
  resolveGalleryTier,
} from "@/lib/galleryAccess";

type GalleryNavState = {
  activeView: GalleryView;
  selectedAlbumId: number | null;
};

const VIEW_LABELS: Record<GalleryView, string> = {
  dashboard: "Dashboard",
  albums: "Albums",
  gallery: "Gallery",
  pending: "Pending Review",
  recycle: "Recycle Bin",
  contributions: "My Contributions",
  "upload-history": "Upload History",
  audit: "Audit Log",
  settings: "Settings",
};

export default function SocialGalleryPage() {
  const [activeView, setActiveView] = useState<GalleryView>("dashboard");
  const [search, setSearch] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<GalleryMedia | null>(null);
  const [browseList, setBrowseList] = useState<GalleryMedia[]>([]);
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [galleryAlbumFilter, setGalleryAlbumFilter] = useState<number | null>(null);
  const [galleryStatus, setGalleryStatus] = useState<GalleryStatusFilter>("");
  const [gallerySort, setGallerySort] = useState("newest");
  const [mobileNav, setMobileNav] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const userQuery = useGalleryUser();
  const user = userQuery.data;
  const roleTier = resolveGalleryTier(user);
  const isManager = roleTier !== "employee";
  const isAdmin = roleTier === "administrator";
  const isEmployee = roleTier === "employee";
  const isSystemAdmin = !!user?.is_admin;

  const dashboardQuery = useGalleryDashboard(canAccessGalleryView(roleTier, "dashboard"));
  const albumsQuery = useGalleryAlbums(search);
  const mediaParams = useMemo(() => {
    if (activeView === "gallery") {
      return {
        search,
        album_id: galleryAlbumFilter || undefined,
        approval_status: isManager ? (galleryStatus || undefined) : "approved",
        sort: gallerySort,
      };
    }
    return {
      search,
      album_id: selectedAlbumId || undefined,
      approval_status: selectedAlbumId ? "approved" : undefined,
    };
  }, [search, selectedAlbumId, activeView, galleryAlbumFilter, galleryStatus, gallerySort, isManager]);
  const mediaQuery = useGalleryMedia(mediaParams);
  const pendingQuery = useGalleryPending(canAccessGalleryView(roleTier, "pending"));
  const recycleQuery = useGalleryRecycle(canAccessGalleryView(roleTier, "recycle"));
  const uploadHistoryQuery = useGalleryUploadHistory(true);
  const queryClient = useQueryClient();
  const settingsQuery = useGallerySettings(isAdmin);
  const { trackNavigation, registerRestore } = useNavigationHistory<GalleryNavState>();

  const pendingPayload = pendingQuery.data;
  const pendingMedia = pendingPayload?.media || [];
  const pendingAlbums = pendingPayload?.albums || [];
  const pendingCount = pendingPayload?.actionable_count ?? pendingMedia.length;

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!user) return;
    setActiveView(defaultGalleryViewForTier(roleTier));
  }, [user?.id, roleTier]);

  useEffect(() => {
    if (!user) return;
    if (!canAccessGalleryView(roleTier, activeView)) {
      setActiveView(defaultGalleryViewForTier(roleTier));
    }
  }, [user, roleTier, activeView]);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setLayout(normalizeLayout(settingsQuery.data.default_layout));
  }, [settingsQuery.data]);

  const openMedia = (item: GalleryMedia, list: GalleryMedia[] = []) => {
    setSelectedMedia(item);
    setBrowseList(list.length ? list : [item]);
  };

  const openMediaById = async (mediaId: number) => {
    try {
      const item = await api.mediaGet(mediaId);
      openMedia(item, [item]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Media is not available", true);
    }
  };

  const refreshAll = () => {
    if (!isEmployee) dashboardQuery.refetch();
    albumsQuery.refetch();
    mediaQuery.refetch();
    if (isManager) {
      pendingQuery.refetch();
      recycleQuery.refetch();
    }
    if (isAdmin) queryClient.invalidateQueries({ queryKey: galleryKeys.audit });
    uploadHistoryQuery.refetch();
    if (isAdmin) settingsQuery.refetch();
  };

  const selectedAlbum = useMemo(() => {
    if (!selectedAlbumId) return null;
    return albumsQuery.items.find((a) => a.id === selectedAlbumId)
      || dashboardQuery.data?.recent_albums?.find((a) => a.id === selectedAlbumId)
      || null;
  }, [selectedAlbumId, albumsQuery.items, dashboardQuery.data]);

  const headerTitle = selectedAlbum
    ? `Albums › ${selectedAlbum.name}`
    : VIEW_LABELS[activeView];

  const showEmployeeUpload = !selectedAlbumId
    && canShowListUploadButton(roleTier)
    && (activeView === "albums" || activeView === "gallery");
  const showCreateAlbumAction = !selectedAlbumId
    && canCreateAlbum(roleTier)
    && activeView === "albums";

  useEffect(() => {
    registerRestore((state) => {
      setActiveView(state.activeView);
      setSelectedAlbumId(state.selectedAlbumId);
      setMobileNav(false);
    });
  }, [registerRestore]);

  useEffect(() => {
    const navKey = `${activeView}:${selectedAlbumId ?? ""}`;
    trackNavigation({ activeView, selectedAlbumId }, headerTitle, navKey);
  }, [activeView, selectedAlbumId, headerTitle, trackNavigation]);

  const navigate = (view: GalleryView) => {
    setActiveView(view);
    setSelectedAlbumId(null);
    setMobileNav(false);
    if (view === "gallery") {
      setLayout("grid");
      setGalleryAlbumFilter(null);
    }
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
          media={mediaQuery.items}
          loading={mediaQuery.isLoading}
          albums={albumsQuery.items}
          layout={layout}
          onLayoutChange={setLayout}
          onOpenMedia={(item) => openMedia(item, mediaQuery.items)}
          onRefresh={refreshAll}
          onUpload={isManager ? () => setShowUpload(true) : undefined}
          total={mediaQuery.total}
          onLoadMore={() => mediaQuery.fetchNextPage()}
          loadingMore={mediaQuery.isFetchingNextPage}
          canManage={isManager}
          onError={(msg) => showToast(msg, true)}
        />
      );
    }

    switch (activeView) {
      case "dashboard":
        if (!canAccessGalleryView(roleTier, "dashboard")) {
          return null;
        }
        if (dashboardQuery.isError) {
          return <QueryError message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : undefined} onRetry={() => dashboardQuery.refetch()} />;
        }
        return (
          <DashboardView
            data={dashboardQuery.data}
            loading={dashboardQuery.isLoading}
            userName={user?.name}
            isManager={isManager}
            pendingCount={pendingCount}
            onOpenPending={() => navigate("pending")}
            onOpenAlbum={openAlbum}
            onOpenMedia={(item, list) => openMedia(item, list || [])}
            onBrowseGallery={() => navigate("gallery")}
            onCreateAlbum={canCreateAlbum(roleTier) ? () => setShowCreateAlbum(true) : undefined}
          />
        );
      case "albums":
        if (albumsQuery.isError) {
          return <QueryError message={albumsQuery.error instanceof Error ? albumsQuery.error.message : undefined} onRetry={() => albumsQuery.refetch()} />;
        }
        return (
          <AlbumsView
            albums={albumsQuery.items}
            loading={albumsQuery.isLoading}
            total={albumsQuery.total}
            onLoadMore={() => albumsQuery.fetchNextPage()}
            loadingMore={albumsQuery.isFetchingNextPage}
            onOpenAlbum={openAlbum}
            onRefresh={refreshAll}
            onCreateAlbum={canCreateAlbum(roleTier) ? () => setShowCreateAlbum(true) : undefined}
            isManager={isManager}
            isAdmin={isAdmin}
          />
        );
      case "gallery":
        if (mediaQuery.isError) {
          return <QueryError message={mediaQuery.error instanceof Error ? mediaQuery.error.message : undefined} onRetry={() => mediaQuery.refetch()} />;
        }
        return (
          <GalleryFeedView
            media={mediaQuery.items}
            loading={mediaQuery.isLoading}
            layout={layout}
            onLayoutChange={setLayout}
            onOpenMedia={(item) => openMedia(item, mediaQuery.items)}
            albums={albumsQuery.items}
            onRefresh={refreshAll}
            onUpload={canShowListUploadButton(roleTier) ? () => setShowUpload(true) : undefined}
            total={mediaQuery.total}
            onLoadMore={() => mediaQuery.fetchNextPage()}
            loadingMore={mediaQuery.isFetchingNextPage}
            canManage={isManager}
            onError={(msg) => showToast(msg, true)}
            libraryMode
            albumFilterId={galleryAlbumFilter}
            onAlbumFilter={setGalleryAlbumFilter}
            statusFilter={galleryStatus}
            onStatusFilter={setGalleryStatus}
            sort={gallerySort}
            onSort={setGallerySort}
            onCreateAlbum={canCreateAlbum(roleTier) ? () => setShowCreateAlbum(true) : undefined}
            statusCounts={{
              all: mediaQuery.total,
              approved: mediaQuery.total,
              pending: pendingCount,
              rejected: 0,
            }}
            search={search}
            onSearch={setSearch}
          />
        );
      case "pending":
        return (
          <PendingReviewView
            media={pendingMedia}
            pendingAlbums={pendingAlbums}
            loading={pendingQuery.isLoading}
            error={pendingQuery.isError ? (pendingQuery.error instanceof Error ? pendingQuery.error.message : "Failed to load") : undefined}
            albums={albumsQuery.items}
            isAdmin={isAdmin}
            onRefresh={() => { refreshAll(); showToast("Review updated"); }}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "recycle":
        return (
          <RecycleBinView
            payload={recycleQuery.data}
            loading={recycleQuery.isLoading}
            isAdmin={isAdmin}
            onRefresh={() => { refreshAll(); showToast("Recycle bin updated"); }}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "contributions":
        if (!canAccessGalleryView(roleTier, "contributions")) return null;
        return (
          <ContributionsView
            onOpenMedia={(item) => openMedia(item, [])}
            onRefresh={() => { refreshAll(); showToast("Contributions updated"); }}
            onError={(msg) => showToast(msg, true)}
          />
        );
      case "upload-history":
        return (
          <UploadHistoryView
            history={uploadHistoryQuery.data || []}
            loading={uploadHistoryQuery.isLoading}
            onOpenMedia={(item) => openMedia(item, [])}
          />
        );
      case "audit":
        if (!canAccessGalleryView(roleTier, "audit")) return null;
        return (
          <AuditLogView
            enabled={isAdmin}
            onOpenAlbum={openAlbum}
            onOpenMedia={openMediaById}
            onCopied={() => showToast("Copied to clipboard")}
          />
        );
      case "settings":
        if (!canAccessGalleryView(roleTier, "settings")) return null;
        return (
          <SettingsView
            settings={settingsQuery.data}
            loading={settingsQuery.isLoading}
            albums={albumsQuery.items}
            onRefresh={() => { settingsQuery.refetch(); showToast("Settings saved"); }}
            onError={(msg) => showToast(msg, true)}
            isSystemAdmin={isSystemAdmin}
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
        roleTier={roleTier}
        mobileNav={mobileNav}
        onClose={() => setMobileNav(false)}
      />
      <div className="gallery-content">
        <div className="gallery-header-wrap">
          <GalleryHeader
            pageTitle={headerTitle}
            search={search}
            userName={user?.name}
            companyName={user?.company_name}
            searchPlaceholder="Search albums and media"
            onSearch={setSearch}
            hideSearch={activeView === "gallery"}
            onOpenMobileNav={() => setMobileNav(true)}
          />
        </div>
        <div className="content-scroll">
          {(showEmployeeUpload || showCreateAlbumAction) && (
            <div className="page-actions-row">
              <div className="primary-actions">
                {showCreateAlbumAction && (
                  <button type="button" className="secondary-button" onClick={() => setShowCreateAlbum(true)}>
                    <Plus size={16} />
                    Create Album
                  </button>
                )}
                {showEmployeeUpload && (
                  <button type="button" className="primary-button" onClick={() => setShowUpload(true)}>
                    <Upload size={16} />
                    Upload Media
                  </button>
                )}
              </div>
            </div>
          )}
          {renderContent()}
        </div>
      </div>

      {selectedMedia && (
        <MediaDetailModal
          media={selectedMedia}
          albums={albumsQuery.items}
          userId={user?.id}
          isManager={isManager}
          onClose={() => { setSelectedMedia(null); setBrowseList([]); }}
          onRefresh={refreshAll}
          onError={(msg) => showToast(msg, true)}
          hasPrev={browseList.findIndex((item) => item.id === selectedMedia.id) > 0}
          hasNext={browseList.findIndex((item) => item.id === selectedMedia.id) < browseList.length - 1}
          onPrev={() => {
            const index = browseList.findIndex((item) => item.id === selectedMedia.id);
            if (index > 0) setSelectedMedia(browseList[index - 1]);
          }}
          onNext={() => {
            const index = browseList.findIndex((item) => item.id === selectedMedia.id);
            if (index < browseList.length - 1) setSelectedMedia(browseList[index + 1]);
          }}
        />
      )}
      {showCreateAlbum && canCreateAlbum(roleTier) && (
        <CreateAlbumModal
          onClose={() => setShowCreateAlbum(false)}
          onCreated={() => { setShowCreateAlbum(false); refreshAll(); showToast("Album created"); }}
        />
      )}
      {showUpload && (
        <UploadModal
          albumId={selectedAlbumId || undefined}
          albums={albumsQuery.items}
          employeeMode={isEmployee}
          lockedAlbumId={selectedAlbumId && isManager ? selectedAlbumId : undefined}
          onClose={() => setShowUpload(false)}
          onComplete={() => { setShowUpload(false); refreshAll(); showToast("Uploads complete"); }}
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
