import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  templatesFormsApi,
  type LibraryQuery,
} from "../lib/templates-forms-api";

export const TEMPLATE_KEYS = {
  categories: ["templates-forms", "categories"] as const,
  library: (query: LibraryQuery) => ["templates-forms", "library", query] as const,
  document: (id: number) => ["templates-forms", "document", id] as const,
  employees: (query: Record<string, unknown>) =>
    ["templates-forms", "employees", query] as const,
};

export function useTemplateCategories() {
  return useQuery({
    queryKey: TEMPLATE_KEYS.categories,
    queryFn: templatesFormsApi.categories,
  });
}

export function useTemplatesLibrary(query: LibraryQuery) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.library(query),
    queryFn: () => templatesFormsApi.list(query),
  });
}

export function useTemplateDocument(id: number) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.document(id),
    queryFn: () => templatesFormsApi.getDocument(id),
    enabled: id > 0,
  });
}

export function useTemplateEmployees(query: Record<string, unknown>) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.employees(query),
    queryFn: () => templatesFormsApi.employees(query),
  });
}

export function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["templates-forms"] });
}

export function usePatchTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      templatesFormsApi.patch(id, payload),
    onSuccess: invalidate,
  });
}

export function useUploadTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: templatesFormsApi.upload,
    onSuccess: invalidate,
  });
}
