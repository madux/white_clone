"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  ComplianceReport,
  DocumentaryAnalyticsDashboard,
  DocumentarySettings,
  MediaFilters,
  RecycleBinData,
} from "../lib/types";

export const documentaryKeys = {
  user: ["company-documentary", "user"],
  folders: (search: string) => ["company-documentary", "folders", search],
  media: (folderId: number | null, search: string, filters: MediaFilters) => [
    "company-documentary",
    "media",
    folderId,
    search,
    filters,
  ],
  continueWatching: ["company-documentary", "continue-watching"],
  homeHero: ["company-documentary", "home-hero"],
  recycleBin: ["company-documentary", "recycle-bin"],
  settings: ["company-documentary", "settings"],
  audience: (search: string) => ["company-documentary", "audience", search],
  analytics: (filters: Record<string, unknown>) => ["company-documentary", "analytics", filters],
  compliance: (filters: Record<string, unknown>) => ["company-documentary", "compliance", filters],
  comments: (mediaId: number) => ["company-documentary", "comments", mediaId],
  mediaVersions: (mediaId: number) => ["company-documentary", "media-versions", mediaId],
  mediaAudit: (mediaId: number) => ["company-documentary", "media-audit", mediaId],
};

export function useDocumentaryUser() {
  return useQuery({ queryKey: documentaryKeys.user, queryFn: api.me });
}

export function useDocumentaryFolders(search: string) {
  return useQuery({ queryKey: documentaryKeys.folders(search), queryFn: () => api.folders({ search }) });
}

export function useDocumentaryMedia(
  folderId: number | null,
  search: string,
  filters: MediaFilters = {},
) {
  return useQuery({
    queryKey: documentaryKeys.media(folderId, search, filters),
    queryFn: () =>
      api.media({
        folder_id: folderId || undefined,
        search,
        ...filters,
      }),
  });
}

export function useContinueWatching() {
  return useQuery({
    queryKey: documentaryKeys.continueWatching,
    queryFn: api.continueWatching,
  });
}

export function useHomeHero(enabled = true) {
  return useQuery({
    queryKey: documentaryKeys.homeHero,
    queryFn: api.homeHero,
    enabled,
  });
}

export function useRecycleBin(enabled: boolean) {
  return useQuery<RecycleBinData>({
    queryKey: documentaryKeys.recycleBin,
    queryFn: api.recycleBin,
    enabled,
  });
}

export function useDocumentarySettings(enabled: boolean) {
  return useQuery<DocumentarySettings>({
    queryKey: documentaryKeys.settings,
    queryFn: () => api.settings(),
    enabled,
  });
}

export function useDocumentaryAudience(search: string, enabled: boolean) {
  return useQuery({ queryKey: documentaryKeys.audience(search), queryFn: () => api.audience(search), enabled });
}

export function useDocumentaryAnalytics(
  filters: { date_from?: string; date_to?: string; department_id?: number; folder_id?: number; media_id?: number },
  enabled: boolean,
) {
  return useQuery<DocumentaryAnalyticsDashboard>({
    queryKey: documentaryKeys.analytics(filters),
    queryFn: () => api.analytics(filters),
    enabled,
  });
}

export function useDocumentaryCompliance(
  filters: {
    department_id?: number;
    folder_id?: number;
    media_id?: number;
    mandatory?: "all" | "mandatory" | "optional";
    status?: "all" | "not_started" | "in_progress" | "completed";
    search?: string;
    page?: number;
    page_size?: number;
  },
  enabled: boolean,
) {
  return useQuery<ComplianceReport>({
    queryKey: documentaryKeys.compliance(filters),
    queryFn: () => api.complianceReport(filters),
    enabled,
  });
}

export function useDocumentaryFolderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.folderAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-documentary", "folders"] });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.recycleBin });
    },
  });
}

export function useDocumentaryMediaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.mediaAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.recycleBin });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.continueWatching });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.homeHero });
    },
  });
}

export function useCreateDocumentaryFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "folders"] }),
  });
}

export function useUpdateDocumentaryFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "folders"] }),
  });
}

export function useDocumentaryMediaBatchAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.mediaBatchAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.recycleBin });
    },
  });
}

export function usePinFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.pinFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "folders"] }),
  });
}

export function useFavoriteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.favoriteFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "folders"] }),
  });
}

export function useMediaApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.mediaApproval,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.homeHero });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.mediaVersions(variables.id) });
      queryClient.invalidateQueries({ queryKey: documentaryKeys.mediaAudit(variables.id) });
    },
  });
}

export function useDocumentaryVersions(mediaId: number, enabled = true) {
  return useQuery({
    queryKey: documentaryKeys.mediaVersions(mediaId),
    queryFn: () => api.mediaVersions(mediaId),
    enabled: enabled && mediaId > 0,
  });
}

export function useDocumentaryAuditLog(mediaId: number, enabled = true) {
  return useQuery({
    queryKey: documentaryKeys.mediaAudit(mediaId),
    queryFn: () => api.auditLog(mediaId),
    enabled: enabled && mediaId > 0,
  });
}

export function useSaveDocumentarySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentaryKeys.settings }),
  });
}

export function useDocumentaryComments(mediaId: number) {
  return useQuery({
    queryKey: documentaryKeys.comments(mediaId),
    queryFn: () => api.comments(mediaId, "list") as Promise<import("../lib/types").DocumentaryComment[]>,
    enabled: mediaId > 0,
  });
}

export function useDocumentaryMutations() {
  const queryClient = useQueryClient();
  const invalidateMedia = () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] });

  return {
    postComment: useMutation({
      mutationFn: (payload: { media_id: number; body: string; parent_id?: number }) =>
        api.comments(payload.media_id, "create", payload.body, undefined, payload.parent_id),
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: documentaryKeys.comments(vars.media_id) });
        invalidateMedia();
      },
    }),
    deleteComment: useMutation({
      mutationFn: (payload: { media_id: number; comment_id: number }) =>
        api.comments(payload.media_id, "delete", undefined, payload.comment_id),
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: documentaryKeys.comments(vars.media_id) });
        invalidateMedia();
      },
    }),
    toggleLike: useMutation({
      mutationFn: (media_id: number) => api.likes(media_id),
      onSuccess: invalidateMedia,
    }),
  };
}
