import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { intelligenceApi, intelligenceDatasetApi } from "../lib/intelligence-api";

export const INTELLIGENCE_KEYS = {
  types: ["intelligence", "document-types"] as const,
  profiles: ["intelligence", "profiles"] as const,
  datasets: ["intelligence", "datasets"] as const,
  dataset: (id: number) => ["intelligence", "dataset", id] as const,
  reviewQueue: ["intelligence", "review-queue"] as const,
};

export function useIntelligenceTypes() {
  return useQuery({
    queryKey: INTELLIGENCE_KEYS.types,
    queryFn: () => intelligenceApi.getDocumentTypes(false),
  });
}

export function useIntelligenceProfiles() {
  return useQuery({
    queryKey: INTELLIGENCE_KEYS.profiles,
    queryFn: () => intelligenceApi.getProfiles(),
  });
}

export function useCreateIntelligenceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceApi.createDocumentType,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.types }),
  });
}

export function useUpdateIntelligenceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceApi.updateDocumentType,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.types }),
  });
}

export function useCreateIntelligenceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceApi.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.profiles });
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.types });
    },
  });
}

export function useUpdateIntelligenceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.profiles });
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.types });
    },
  });
}

export function useArchiveIntelligenceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      intelligenceApi.archiveProfile(id, active),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.profiles }),
  });
}

export function useNewIntelligenceProfileVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceApi.newProfileVersion,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.profiles }),
  });
}

export function useIntelligenceDatasets() {
  return useQuery({
    queryKey: INTELLIGENCE_KEYS.datasets,
    queryFn: intelligenceDatasetApi.list,
    refetchInterval: (query) => {
      const rows = query.state.data || [];
      return rows.some((row) =>
        ["queued", "running"].includes(row.state),
      )
        ? 4000
        : false;
    },
  });
}

export function useIntelligenceWizardOptions() {
  return useQuery({
    queryKey: ["intelligence", "wizard-options"],
    queryFn: intelligenceDatasetApi.wizardOptions,
  });
}

export function useIntelligenceWizardEstimate(payload: {
  source: string;
  scope_kind: string;
  scope_ids: number[];
  document_type_ids: number[];
  auto_classify: boolean;
}) {
  return useQuery({
    queryKey: ["intelligence", "wizard-estimate", payload],
    queryFn: () => intelligenceDatasetApi.wizardEstimate(payload),
    enabled: Boolean(payload.source && payload.source !== "external"),
  });
}

export function useIntelligenceDataset(id?: number) {
  return useQuery({
    queryKey: id ? INTELLIGENCE_KEYS.dataset(id) : ["intelligence", "dataset", "none"],
    queryFn: () => intelligenceDatasetApi.get(id as number),
    enabled: Boolean(id),
  });
}

export function useSaveIntelligenceDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceDatasetApi.save,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.datasets }),
  });
}

export function useDeleteIntelligenceDatasets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => intelligenceDatasetApi.delete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.datasets });
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.reviewQueue });
    },
  });
}

export function useRunIntelligenceDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceDatasetApi.run,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.datasets }),
  });
}

export function useIntelligenceReviewQueue(datasetId?: number) {
  return useQuery({
    queryKey: [...INTELLIGENCE_KEYS.reviewQueue, datasetId || "all"],
    queryFn: () => intelligenceDatasetApi.reviewQueue(datasetId),
    refetchInterval: (query) => {
      const rows = query.state.data || [];
      return rows.some((row) => row.review_status === "extracted") ? 4000 : false;
    },
  });
}

function invalidateReview(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.reviewQueue });
  queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.datasets });
}

export function useReviewIntelligenceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      id,
      reason,
      comment,
      field_key,
      value,
      issue_id,
    }: {
      action:
        | "approve"
        | "reject"
        | "override"
        | "correct"
        | "resolve"
        | "comment";
      id: number;
      reason?: string;
      comment?: string;
      field_key?: string;
      value?: string;
      issue_id?: number;
    }) => {
      if (action === "approve") {
        return intelligenceDatasetApi.approveRecord(id, reason);
      }
      if (action === "reject") {
        return intelligenceDatasetApi.rejectRecord(id, reason || "");
      }
      if (action === "override") {
        return intelligenceDatasetApi.overrideRecord(id, reason || "");
      }
      if (action === "correct") {
        return intelligenceDatasetApi.correctField({
          id,
          field_key: field_key || "",
          value: value || "",
          reason: reason || "",
        });
      }
      if (action === "resolve") {
        return intelligenceDatasetApi.resolveIssue({
          id,
          issue_id: issue_id || 0,
          reason,
        });
      }
      return intelligenceDatasetApi.commentRecord(id, comment || "");
    },
    onSuccess: () => invalidateReview(queryClient),
  });
}

export function useBulkApproveSafeRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: number[]) => intelligenceDatasetApi.bulkApproveSafe(ids),
    onSuccess: () => invalidateReview(queryClient),
  });
}

export function useIntelligenceAsk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => intelligenceDatasetApi.ask(question),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["intelligence", "ask-history"] }),
  });
}

export function useIntelligenceHealth() {
  return useQuery({
    queryKey: ["intelligence", "health"],
    queryFn: intelligenceDatasetApi.settingsHealth,
  });
}

export function useIntelligenceAuditLogs(category?: string) {
  return useQuery({
    queryKey: ["intelligence", "audit", category || "all"],
    queryFn: () =>
      intelligenceDatasetApi.auditLogs(category ? { category } : {}),
  });
}

export function useIntelligenceAskHistory() {
  return useQuery({
    queryKey: ["intelligence", "ask-history"],
    queryFn: intelligenceDatasetApi.askHistory,
  });
}

export function useIntelligenceConversations(saved?: boolean, search?: string) {
  return useQuery({
    queryKey: ["intelligence", "conversations", saved ? "saved" : "recent", search || ""],
    queryFn: () =>
      intelligenceDatasetApi.conversations({
        ...(saved ? { saved: true } : {}),
        ...(search ? { search } : {}),
      }),
  });
}

export function useIntelligenceOverview() {
  return useQuery({
    queryKey: ["intelligence", "overview"],
    queryFn: intelligenceDatasetApi.overview,
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs || [];
      return jobs.some((job) => ["queued", "running"].includes(job.state))
        ? 4000
        : false;
    },
  });
}

export function useControlIntelligenceJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      id,
    }: {
      action: "pause" | "resume" | "retry";
      id: number;
    }) => {
      if (action === "pause") {
        return intelligenceDatasetApi.pauseJob(id);
      }
      if (action === "resume") {
        return intelligenceDatasetApi.resumeJob(id);
      }
      return intelligenceDatasetApi.retryJob(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.datasets });
      queryClient.invalidateQueries({ queryKey: ["intelligence", "overview"] });
    },
  });
}
