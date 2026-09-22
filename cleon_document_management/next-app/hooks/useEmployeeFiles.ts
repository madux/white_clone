import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../lib/employeeFileListPageSize";

export const EMPLOYEE_FILES_KEYS = {
  config: ["employee-files", "config"],
  stats: ["employee-files", "stats"],
  groups: (params: Record<string, string | boolean | undefined>) => [
    "employee-files",
    "groups",
    params,
  ],
  group: (id: number) => ["employee-files", "group", id],
  files: (params: {
    search?: string;
    limit?: number;
    offset?: number;
    department_id?: string;
    order?: string;
  }) => ["employee-files", "files", params],
  groupMembers: (
    groupId: number,
    params: { search?: string; limit?: number; offset?: number },
  ) => ["employee-files", "group-members", groupId, params],
  issues: (
    category: string,
    params: { search?: string; limit?: number; offset?: number },
  ) => ["employee-files", "issues", category, params],
  dimensions: ["employee-files", "dimensions"],
  exclusions: (reason?: string) => ["employee-files", "exclusions", reason ?? "all"],
  fileDocuments: (employeeId: number) => [
    "employee-files",
    "file-documents",
    employeeId,
  ],
  fileActivity: (employeeId: number) => [
    "employee-files",
    "file-activity",
    employeeId,
  ],
  documentSearch: (params: Record<string, unknown>) => [
    "employee-files",
    "document-search",
    params,
  ],
  documentRelations: (documentId: number) => [
    "employee-files",
    "document-relations",
    documentId,
  ],
};

export function useEmployeeFilesConfig() {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.config,
    queryFn: api.getEmployeeFilesConfig,
  });
}

export function useEmployeeFilesHomeStats() {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.stats,
    queryFn: api.getEmployeeFilesHomeStats,
  });
}

export function useEmployeeFileDimensions() {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.dimensions,
    queryFn: api.getEmployeeFilesDimensions,
  });
}

export function useEmployeeFileExclusions(reason?: string) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.exclusions(reason),
    queryFn: () => api.listEmployeeFileExclusions(reason),
  });
}

export function useAddEmployeeFileExclusions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeIds,
      justification,
    }: {
      employeeIds: number[];
      justification?: string;
    }) => api.addEmployeeFileExclusions(employeeIds, justification),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-files", "exclusions"] });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.stats });
    },
  });
}

export function useRemoveEmployeeFileExclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.removeEmployeeFileExclusion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-files", "exclusions"] });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.stats });
    },
  });
}

export function useEmployeeFileGroups(
  params: {
    group_kind?: string;
    dimension?: string;
    search?: string;
    for_home?: boolean;
    include_all_custom?: boolean;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.groups(params),
    queryFn: () => api.listEmployeeFileGroups(params),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateEmployeeFileGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateEmployeeFileGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-files", "groups"] });
    },
  });
}

export function useEmployeeFileGroup(id: number) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.group(id),
    queryFn: () => api.getEmployeeFileGroup(id),
    enabled: id > 0,
  });
}

export function useEmployeeFileSummaries(
  params: {
    search?: string;
    page?: number;
    pageSize?: number;
    departmentId?: string;
    order?: string;
    enabled?: boolean;
  } = {},
) {
  const {
    search,
    page = 1,
    pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
    departmentId,
    order,
    enabled = true,
  } = params;
  const offset = (Math.max(page, 1) - 1) * pageSize;
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.files({
      search,
      limit: pageSize,
      offset,
      department_id: departmentId,
      order,
    }),
    queryFn: () =>
      api.listEmployeeFileSummaries({
        search,
        limit: pageSize,
        offset,
        department_id: departmentId !== "all" ? departmentId : undefined,
        order,
      }),
    enabled,
  });
}

export function useEmployeeFilesDocumentSearch(
  params: {
    query?: string;
    category?: string;
    documentTypeId?: string;
    departmentId?: string;
    source?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    order?: string;
    enabled?: boolean;
  },
) {
  const {
    query,
    category,
    documentTypeId,
    departmentId,
    source,
    status,
    page = 1,
    pageSize = 25,
    order,
    enabled = true,
  } = params;
  const offset = (Math.max(page, 1) - 1) * pageSize;
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.documentSearch({
      query,
      category,
      documentTypeId,
      departmentId,
      source,
      status,
      limit: pageSize,
      offset,
      order,
    }),
    queryFn: () =>
      api.searchEmployeeFilesDocuments({
        query: query || undefined,
        category: category !== "all" ? category : undefined,
        document_type_id: documentTypeId !== "all" ? documentTypeId : undefined,
        department_id: departmentId !== "all" ? departmentId : undefined,
        source: source !== "all" ? source : undefined,
        status: status !== "all" ? status : undefined,
        limit: pageSize,
        offset,
        order,
      }),
    enabled,
  });
}

export function useEmployeeGroupMembers(
  groupId: number,
  search?: string,
  page = 1,
  pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
  enabled = true,
) {
  const offset = (Math.max(page, 1) - 1) * pageSize;
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.groupMembers(groupId, {
      search,
      limit: pageSize,
      offset,
    }),
    queryFn: () =>
      api.listEmployeeGroupMembers(groupId, { search, limit: pageSize, offset }),
    enabled: enabled && groupId > 0,
  });
}

export function useEmployeeFileIssues(
  category = "all",
  page = 1,
  pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
  search?: string,
) {
  const offset = (Math.max(page, 1) - 1) * pageSize;
  const trimmedSearch = search?.trim() || undefined;
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.issues(category, {
      search: trimmedSearch,
      limit: pageSize,
      offset,
    }),
    queryFn: () =>
      api.listEmployeeFileIssues(category, {
        search: trimmedSearch,
        limit: pageSize,
        offset,
      }),
  });
}

export function useConfirmEmployeeFilesSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.confirmEmployeeFilesSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-files"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useSaveEmployeeFilesConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveEmployeeFilesConfig,
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(EMPLOYEE_FILES_KEYS.config, data);
      }
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.config });
      queryClient.invalidateQueries({ queryKey: ["employee-files", "groups"] });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: ["employee-files", "summary"] });
    },
  });
}

export function useSaveEmployeeFilesHeaderFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveEmployeeFilesHeaderFields,
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(EMPLOYEE_FILES_KEYS.config, data);
      }
      queryClient.invalidateQueries({ queryKey: ["employee-files", "summary"] });
    },
  });
}

export function useEmployeeFileSummary(employeeId: number) {
  return useQuery({
    queryKey: ["employee-files", "summary", employeeId],
    queryFn: () => api.getEmployeeFileSummary(employeeId),
    enabled: employeeId > 0,
  });
}

export function useEmployeeFileDocuments(employeeId: number) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.fileDocuments(employeeId),
    queryFn: () => api.getEmployeeFileDocuments(employeeId),
    enabled: employeeId > 0,
  });
}

export function useEmployeeFileActivity(employeeId: number) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.fileActivity(employeeId),
    queryFn: () => api.getEmployeeFileActivity(employeeId),
    enabled: employeeId > 0,
  });
}

export function useRemoveEmployeeFilesFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      employeeFileIds,
    }: {
      groupId: number;
      employeeFileIds: number[];
    }) => api.removeEmployeeFilesFromGroup(groupId, employeeFileIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee-files", "groups"] });
      queryClient.invalidateQueries({ queryKey: ["employee-files", "summary"] });
      queryClient.invalidateQueries({
        queryKey: EMPLOYEE_FILES_KEYS.group(variables.groupId),
      });
      queryClient.invalidateQueries({ queryKey: ["employee-files", "group-members"] });
    },
  });
}

export function useEmployeeDocumentRelations(documentId: number, enabled = true) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.documentRelations(documentId),
    queryFn: () => api.getEmployeeDocumentRelations(documentId),
    enabled: enabled && documentId > 0,
  });
}

export function useAddEmployeeDocumentRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addEmployeeDocumentRelation,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: EMPLOYEE_FILES_KEYS.documentRelations(
          variables.source_document_id,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: EMPLOYEE_FILES_KEYS.documentRelations(
          variables.target_document_id,
        ),
      });
    },
  });
}

export function useRemoveEmployeeDocumentRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { relationId: number; documentIds: number[] }) =>
      api.removeEmployeeDocumentRelation(payload.relationId),
    onSuccess: (_data, variables) => {
      variables.documentIds.forEach((documentId) => {
        queryClient.invalidateQueries({
          queryKey: EMPLOYEE_FILES_KEYS.documentRelations(documentId),
        });
      });
    },
  });
}

export function useEmployeeFileIssueAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action?: string }) =>
      api.employeeFileIssueAction(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-files", "issues"] });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.stats });
    },
  });
}
