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
  lifecycleDocuments: (lifecycle: string) => ["documents", lifecycle],
  document: (id: number) => ["documents", id],
  documentTypes: ["documentTypes"],
  documentVersions: (id: number) => ["documents", id, "versions"],
  policies: ["policies"],
  complianceTargets: ["complianceTargets"],
  exceptions: ["compliance", "exceptions"],
  evaluations: ["compliance", "evaluations"],
  evaluationRuns: ["compliance", "evaluation-runs"],
  approvalInbox: ["admin", "approval-inbox"],
  pendingEmployeeUploads: ["admin", "pending-employee-uploads"],
  myPendingUploads: ["documents", "my-pending-uploads"],
  myCompliance: ["documents", "my-compliance"],
  onboarding: ["user", "onboarding"],
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

export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.stats,
    queryFn: api.dashboardStats,
    enabled,
  });
}

export function useFolders() {
  return useQuery({
    queryKey: QUERY_KEYS.folders,
    queryFn: api.getFolders,
  });
}

export function useDocuments(
  folderId?: number | null,
  includeInactive = false,
  enabled = true,
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.documents(folderId), includeInactive],
    queryFn: () => api.getDocuments(folderId, includeInactive),
    enabled,
  });
}

export function useMyDocuments() {
  return useQuery({
    queryKey: ["documents", "mine"],
    queryFn: () => api.getMyDocuments().then((result) => result.data),
  });
}

export function useMyWorkspace() {
  return useQuery({
    queryKey: ["documents", "workspace"],
    queryFn: () => api.getMyWorkspace().then((result) => result.data),
  });
}

export function useMyPendingUploads() {
  return useQuery({
    queryKey: QUERY_KEYS.myPendingUploads,
    queryFn: () => api.getMyPendingUploads().then((result) => result.data),
    refetchInterval: 30000,
  });
}

export function useMyCompliance() {
  return useQuery({
    queryKey: QUERY_KEYS.myCompliance,
    queryFn: () => api.getMyCompliance().then((result) => result.data),
  });
}

export function useAdminAttention(enabled = true) {
  return useQuery({ queryKey: ["admin", "attention"], queryFn: () => api.getAdminAttention().then((result) => result.data), enabled, refetchInterval: 30000 });
}

export function useApprovalInbox(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.approvalInbox,
    queryFn: () => api.getApprovalInbox().then((result) => result.data),
    enabled,
    refetchInterval: 30000,
  });
}

export function usePendingEmployeeUploads(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.pendingEmployeeUploads,
    queryFn: () => api.getPendingEmployeeUploads().then((result) => result.data),
    enabled,
    refetchInterval: 30000,
  });
}

export function useOnboarding() {
  return useQuery({
    queryKey: QUERY_KEYS.onboarding,
    queryFn: () => api.getOnboarding().then((result) => result.data),
  });
}

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateOnboarding,
    onSuccess: (result) => {
      if (result.success && result.data) {
        queryClient.setQueryData(QUERY_KEYS.onboarding, result.data);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.onboarding });
    },
  });
}

export function useQuickAccess() {
  return useQuery({ queryKey: ["quick-access"], queryFn: () => api.getQuickAccess().then((result) => result.data) });
}

export function useDocumentLifecycle(lifecycle: "archived" | "recycle_bin") {
  return useQuery({
    queryKey: QUERY_KEYS.lifecycleDocuments(lifecycle),
    queryFn: () => api.getDocumentLifecycle(lifecycle).then((result) => result.data),
  });
}

export function useFolderLifecycle(lifecycle: "archived" | "recycle_bin") {
  return useQuery({
    queryKey: ["folders", lifecycle],
    queryFn: () => api.getFolderLifecycle(lifecycle).then((result) => result.data),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["document-settings"],
    queryFn: () => api.getSettings().then((result) => result.data),
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document-settings"] }),
  });
}

export function useSaveSettingsDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveSettingsDocumentType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-settings"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentTypes });
    },
  });
}

export function useToggleSettingsDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.toggleSettingsDocumentType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-settings"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentTypes });
    },
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: QUERY_KEYS.documentTypes,
    queryFn: api.getDocumentTypes,
  });
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createDocumentType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentTypes }),
  });
}

export function useDocumentVersions(documentId?: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.documentVersions(documentId ?? 0),
    queryFn: () => api.getDocumentVersions(documentId as number),
    enabled: Boolean(documentId && documentId > 0),
  });
}

export function usePolicies(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.policies,
    queryFn: api.getPolicies,
    enabled,
  });
}

export function usePolicyTypes() {
  return useQuery({
    queryKey: ["policyTypes"],
    queryFn: api.getPolicyTypes,
  });
}

export function useComplianceTargets(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.complianceTargets,
    queryFn: api.getComplianceTargets,
    enabled,
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

export function useApproveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.approveException,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations });
    },
  });
}

export function useRejectException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.rejectException,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations });
    },
  });
}

export function useCreateException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.createException, onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations }); } });
}

export function useDeactivateException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.deactivateException, onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations }); } });
}

export function useReactivateException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.reactivateException, onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations }); } });
}

export function useDeleteException() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.deleteException, onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations }); } });
}

export function useEvaluations(employeeId?: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.evaluations, employeeId ?? "all"],
    queryFn: () => api.getEvaluations(employeeId),
  });
}

export function useEvaluationRuns(policyId?: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.evaluationRuns, policyId ?? "all"],
    queryFn: () => api.getEvaluationRuns(policyId),
  });
}

export function useEvaluatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.evaluatePolicy, onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluationRuns }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies }); } });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingEmployeeUploads });
    },
  });
}

export function useAddEmployeesToFolder() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.addEmployeesToFolder, onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders }) });
}

export function useRemoveEmployeesFromFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeEmployeesFromFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useMoveEmployeesBetweenFolders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.moveEmployeesBetweenFolders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      invalidateDocumentQueries(queryClient);
    },
  });
}

function invalidateDocumentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["documents"] });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
  queryClient.invalidateQueries({ queryKey: ["documents", "workspace"] });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
  queryClient.invalidateQueries({ queryKey: ["quick-access"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "attention"] });
}

export function useFolderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.folderAction,
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingEmployeeUploads });
      queryClient.invalidateQueries({ queryKey: ["folders", "recycle_bin"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "recycle_bin"] });
    },
  });
}

export function useMoveRecycledFolderDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.moveRecycledFolderDocuments,
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingEmployeeUploads });
      queryClient.invalidateQueries({ queryKey: ["folders", "recycle_bin"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "recycle_bin"] });
    },
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
      invalidateDocumentQueries(queryClient);
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadDocument,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(variables.folder_id) });
      invalidateDocumentQueries(queryClient);
    },
  });
}

export function useUploadMyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadMyDocument,
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingEmployeeUploads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPendingUploads });
    },
  });
}

export function useUploadEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadEmployeeDocument,
    onSuccess: () => invalidateDocumentQueries(queryClient),
  });
}

export function useRequestDocumentApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.requestDocumentApproval,
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.approvalInbox });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingEmployeeUploads });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => invalidateDocumentQueries(queryClient),
  });
}

export function useDocumentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.documentAction,
    onSuccess: () => invalidateDocumentQueries(queryClient),
  });
}

export function useMoveDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.moveDocuments,
    onSuccess: () => invalidateDocumentQueries(queryClient),
  });
}

export function useAcknowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.acknowledgeDocument,
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPendingUploads });
    },
  });
}

export function useReviewDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reviewDocument,
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.approvalInbox });
      queryClient.invalidateQueries({ queryKey: ["admin", "attention"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingEmployeeUploads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
    },
  });
}
