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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.profiles }),
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

export function useRunIntelligenceDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: intelligenceDatasetApi.run,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTELLIGENCE_KEYS.datasets }),
  });
}

export function useIntelligenceReviewQueue() {
  return useQuery({
    queryKey: INTELLIGENCE_KEYS.reviewQueue,
    queryFn: () => intelligenceDatasetApi.reviewQueue(),
    refetchInterval: (query) => {
      const rows = query.state.data || [];
      return rows.some((row) => row.review_status === "extracted") ? 4000 : false;
    },
  });
}
