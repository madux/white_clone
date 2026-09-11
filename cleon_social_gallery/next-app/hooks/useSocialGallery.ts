"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LayoutMode } from "@/lib/types";

export const galleryKeys = {
  user: ["social-gallery", "user"] as const,
  albums: (search?: string) => ["social-gallery", "albums", search] as const,
  media: (params?: Record<string, unknown>) => ["social-gallery", "media", params] as const,
  dashboard: ["social-gallery", "dashboard"] as const,
  pending: ["social-gallery", "pending"] as const,
  pendingAi: ["social-gallery", "pending-ai"] as const,
  flagged: ["social-gallery", "flagged"] as const,
  recycle: ["social-gallery", "recycle"] as const,
  contributions: (status?: string) => ["social-gallery", "contributions", status] as const,
  uploadHistory: ["social-gallery", "upload-history"] as const,
  audit: ["social-gallery", "audit"] as const,
  settings: ["social-gallery", "settings"] as const,
  duplicates: ["social-gallery", "duplicates"] as const,
  comments: (mediaId: number) => ["social-gallery", "comments", mediaId] as const,
  tags: ["social-gallery", "tags"] as const,
  trustedUsers: ["social-gallery", "trusted-users"] as const,
  userSearch: (search: string) => ["social-gallery", "user-search", search] as const,
};

export function useGalleryUser() {
  return useQuery({ queryKey: galleryKeys.user, queryFn: () => api.me() });
}

export function useGalleryAlbums(search = "", sort = "newest") {
  const query = useInfiniteQuery({
    queryKey: [...galleryKeys.albums(search), sort],
    queryFn: ({ pageParam = 0 }) => api.albums({ search, sort, offset: pageParam, limit: 48 }),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.items.length;
      return next < lastPage.total ? next : undefined;
    },
    initialPageParam: 0,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? items.length;
  return { ...query, items, total };
}

export function useGalleryMedia(params: Record<string, unknown> = {}) {
  const query = useInfiniteQuery({
    queryKey: galleryKeys.media(params),
    queryFn: ({ pageParam = 0 }) => api.media({ ...params, offset: pageParam, limit: 48 }),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.items.length;
      return next < lastPage.total ? next : undefined;
    },
    initialPageParam: 0,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? items.length;
  return { ...query, items, total };
}

export function useGalleryDashboard(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.dashboard,
    queryFn: () => api.dashboard(),
    enabled,
  });
}

export function useGalleryPending(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.pending,
    queryFn: () => api.pending(),
    enabled,
  });
}

export function useGalleryPendingAi(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.pendingAi,
    queryFn: () => api.pendingAi(),
    enabled,
  });
}

export function useGalleryFlagged(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.flagged,
    queryFn: () => api.flagged(),
    enabled,
  });
}

export function useGalleryRecycle(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.recycle,
    queryFn: () => api.recycleBin(),
    enabled,
  });
}

export function useGalleryContributions(status = "", enabled = true) {
  return useQuery({
    queryKey: galleryKeys.contributions(status),
    queryFn: () => api.contributions(status === "all" ? "" : status),
    enabled,
  });
}

export function useGalleryUploadHistory(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.uploadHistory,
    queryFn: () => api.uploadHistory(),
    enabled,
  });
}

export function useGalleryAudit(params: Record<string, unknown> = {}, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [...galleryKeys.audit, params],
    queryFn: ({ pageParam = 0 }) => api.audit({ ...params, offset: pageParam, limit: 100 }),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.items.length;
      return next < lastPage.total ? next : undefined;
    },
    initialPageParam: 0,
    enabled,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? items.length;
  return { ...query, items, total };
}

export function useGallerySettings(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.settings,
    queryFn: () => api.settings(),
    enabled,
  });
}

export function useGalleryDuplicates(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.duplicates,
    queryFn: () => api.duplicateScan(),
    enabled,
  });
}

export function useGalleryTrustedUsers(enabled = true) {
  return useQuery({
    queryKey: galleryKeys.trustedUsers,
    queryFn: () => api.trustedUsers("list") as Promise<import("@/lib/types").TrustedUser[]>,
    enabled,
  });
}

export function useGalleryUserSearch(search = "", enabled = true) {
  return useQuery({
    queryKey: galleryKeys.userSearch(search),
    queryFn: () => api.searchUsers(search),
    enabled,
  });
}

export function useGalleryComments(mediaId: number) {
  return useQuery({
    queryKey: galleryKeys.comments(mediaId),
    queryFn: () => api.comments(mediaId) as Promise<import("@/lib/types").GalleryComment[]>,
    enabled: mediaId > 0,
  });
}

export function useGalleryTags() {
  return useQuery({ queryKey: galleryKeys.tags, queryFn: () => api.tags() as Promise<import("@/lib/types").GalleryTag[]> });
}

export function useGalleryMutations() {
  const queryClient = useQueryClient();
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ["social-gallery"] });

  return {
    createAlbum: useMutation({
      mutationFn: api.createAlbum,
      onSuccess: invalidateAll,
    }),
    updateAlbum: useMutation({
      mutationFn: api.updateAlbum,
      onSuccess: invalidateAll,
    }),
    albumAction: useMutation({
      mutationFn: api.albumAction,
      onSuccess: invalidateAll,
    }),
    pinAlbum: useMutation({
      mutationFn: api.pinAlbum,
      onSuccess: invalidateAll,
    }),
    updateMedia: useMutation({
      mutationFn: api.updateMedia,
      onSuccess: invalidateAll,
    }),
    mediaAction: useMutation({
      mutationFn: api.mediaAction,
      onSuccess: invalidateAll,
    }),
    mediaApproval: useMutation({
      mutationFn: api.mediaApproval,
      onSuccess: invalidateAll,
    }),
    mediaBatchAction: useMutation({
      mutationFn: api.mediaBatchAction,
      onSuccess: invalidateAll,
    }),
    saveSettings: useMutation({
      mutationFn: api.saveSettings,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: galleryKeys.settings }),
    }),
    postComment: useMutation({
      mutationFn: (payload: { media_id: number; body: string; parent_id?: number }) =>
        api.comments(payload.media_id, "create", payload),
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: galleryKeys.comments(vars.media_id) });
        queryClient.invalidateQueries({ queryKey: ["social-gallery", "media"] });
      },
    }),
    editComment: useMutation({
      mutationFn: (payload: { media_id: number; comment_id: number; body: string }) =>
        api.comments(payload.media_id, "edit", payload),
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: galleryKeys.comments(vars.media_id) });
        queryClient.invalidateQueries({ queryKey: ["social-gallery", "media"] });
      },
    }),
    deleteComment: useMutation({
      mutationFn: (payload: { media_id: number; comment_id: number }) =>
        api.comments(payload.media_id, "delete", payload),
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: galleryKeys.comments(vars.media_id) });
        queryClient.invalidateQueries({ queryKey: ["social-gallery", "media"] });
      },
    }),
    toggleLike: useMutation({
      mutationFn: (media_id: number) => api.likes(media_id),
      onSuccess: invalidateAll,
    }),
    resolveFlag: useMutation({
      mutationFn: (payload: { report_id: number; action: string }) => api.flagged(payload.action, payload),
      onSuccess: invalidateAll,
    }),
    flaggedBatchAction: useMutation({
      mutationFn: (payload: { action: "batch_dismiss" | "batch_remove"; report_ids: number[] }) =>
        api.flagged(payload.action, { report_ids: payload.report_ids }),
      onSuccess: invalidateAll,
    }),
    recycleClear: useMutation({
      mutationFn: (ids: number[]) => api.recycleBinClear(ids),
      onSuccess: invalidateAll,
    }),
    duplicateAction: useMutation({
      mutationFn: (payload: { ids: number[]; action?: string }) => api.duplicateAction(payload.ids, payload.action),
      onSuccess: invalidateAll,
    }),
    exportBrand: useMutation({
      mutationFn: (album_ids: number[]) => api.exportBrand(album_ids),
    }),
    trustedUsers: useMutation({
      mutationFn: (payload: { action: string; user_id?: number; notes?: string }) =>
        api.trustedUsers(payload.action, payload),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: galleryKeys.trustedUsers }),
    }),
    createTag: useMutation({
      mutationFn: (name: string) => api.tags("create", { name }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: galleryKeys.tags }),
    }),
  };
}

export function isValidLayout(value?: string): value is LayoutMode {
  return value === "grid" || value === "list" || value === "masonry";
}
