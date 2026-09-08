"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DocumentaryAnalyticsDashboard } from "../lib/types";

export const documentaryKeys = {
  user: ["company-documentary", "user"],
  folders: (search: string) => ["company-documentary", "folders", search],
  media: (folderId: number | null, search: string) => ["company-documentary", "media", folderId, search],
  audience: (search: string) => ["company-documentary", "audience", search],
  analytics: (filters: Record<string, unknown>) => ["company-documentary", "analytics", filters],
};

export function useDocumentaryUser() {
  return useQuery({ queryKey: documentaryKeys.user, queryFn: api.me });
}

export function useDocumentaryFolders(search: string) {
  return useQuery({ queryKey: documentaryKeys.folders(search), queryFn: () => api.folders({ search }) });
}

export function useDocumentaryMedia(folderId: number | null, search: string) {
  return useQuery({ queryKey: documentaryKeys.media(folderId, search), queryFn: () => api.media({ folder_id: folderId || undefined, search }) });
}

export function useDocumentaryAudience(search: string, enabled: boolean) {
  return useQuery({ queryKey: documentaryKeys.audience(search), queryFn: () => api.audience(search), enabled });
}

export function useDocumentaryAnalytics(filters: { date_from?: string; date_to?: string; department_id?: number; folder_id?: number }, enabled: boolean) {
  return useQuery<DocumentaryAnalyticsDashboard>({ queryKey: documentaryKeys.analytics(filters), queryFn: () => api.analytics(filters), enabled });
}

export function useDocumentaryFolderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.folderAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "folders"] }),
  });
}

export function useDocumentaryMediaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.mediaAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-documentary", "media"] }),
  });
}
