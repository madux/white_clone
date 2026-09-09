"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
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
  recycleBin: ["company-documentary", "recycle-bin"],
  settings: ["company-documentary", "settings"],
  audience: (search: string) => ["company-documentary", "audience", search],
  analytics: (filters: Record<string, unknown>) => ["company-documentary", "analytics", filters],
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
  filters: { date_from?: string; date_to?: string; department_id?: number; folder_id?: number },
  enabled: boolean,
) {
  return useQuery<DocumentaryAnalyticsDashboard>({
    queryKey: documentaryKeys.analytics(filters),
    queryFn: () => api.analytics(filters),
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

export function useMediaApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.mediaApproval,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] }),
  });
}

export function useSaveDocumentarySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentaryKeys.settings }),
  });
}
