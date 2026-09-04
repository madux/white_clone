// cleon_document_management/next-app/hooks/useDocuments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

export const QUERY_KEYS = {
  me: ["user", "me"],
  stats: ["dashboard", "stats"],
  folders: ["folders"],
  folder: (id: number) => ["folders", id],
  documents: (folderId?: number | null) => ["documents", { folderId }],
  document: (id: number) => ["documents", id],
  documentTypes: ["documentTypes"],
  policies: ["policies"],
  complianceTargets: ["complianceTargets"],
  exceptions: ["compliance", "exceptions"],
  evaluations: ["compliance", "evaluations"],
};

export function useCurrentUser() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Re-check after mount in case Odoo's injected script ran after hydration.
    const user = api.injectedUser();
    if (user) {
      queryClient.setQueryData(QUERY_KEYS.me, user);
    }
  }, [queryClient]);

  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: api.me,
    initialData: api.injectedUser,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: QUERY_KEYS.stats,
    queryFn: api.dashboardStats,
  });
}

export function useFolders() {
  return useQuery({
    queryKey: QUERY_KEYS.folders,
    queryFn: api.getFolders,
  });
}

export function useDocuments(folderId?: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.documents(folderId),
    queryFn: () => api.getDocuments(folderId),
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: QUERY_KEYS.documentTypes,
    queryFn: api.getDocumentTypes,
  });
}

export function usePolicies() {
  return useQuery({
    queryKey: QUERY_KEYS.policies,
    queryFn: api.getPolicies,
  });
}

export function usePolicyTypes() {
  return useQuery({
    queryKey: ["policyTypes"],
    queryFn: api.getPolicyTypes,
  });
}

export function useComplianceTargets() {
  return useQuery({
    queryKey: QUERY_KEYS.complianceTargets,
    queryFn: api.getComplianceTargets,
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.updatePolicy, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies }) });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.deletePolicy, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies }) });
}

export function useExceptions() {
  return useQuery({ queryKey: QUERY_KEYS.exceptions, queryFn: api.getExceptions });
}

export function useCreateException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.createException, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }) });
}

export function useDeactivateException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.deactivateException, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }) });
}

export function useReactivateException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.reactivateException, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }) });
}

export function useDeleteException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.deleteException, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }) });
}

export function useEvaluations() {
  return useQuery({ queryKey: QUERY_KEYS.evaluations, queryFn: api.getEvaluations });
}

export function useEvaluatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.evaluatePolicy, onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }); } });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
    },
  });
}

export function useAddEmployeesToFolder() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.addEmployeesToFolder, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders }) });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders }),
  });
}

export function useFolderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.folderAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders }),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createDocument,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(variables.folder_id),
      });
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadDocument,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(variables.folder_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDocumentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.documentAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}
