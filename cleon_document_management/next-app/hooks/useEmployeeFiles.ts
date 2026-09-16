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
  }) => ["employee-files", "files", params],
  groupMembers: (
    groupId: number,
    params: { search?: string; limit?: number; offset?: number },
  ) => ["employee-files", "group-members", groupId, params],
  issues: (category: string, params: { limit?: number; offset?: number }) => [
    "employee-files",
    "issues",
    category,
    params,
  ],
  dimensions: ["employee-files", "dimensions"],
  exclusions: (reason?: string) => ["employee-files", "exclusions", reason ?? "all"],
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

export function useEmployeeFileGroups(params: {
  group_kind?: string;
  dimension?: string;
  search?: string;
  for_home?: boolean;
  include_all_custom?: boolean;
}) {
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.groups(params),
    queryFn: () => api.listEmployeeFileGroups(params),
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
  search?: string,
  page = 1,
  pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
  enabled = true,
) {
  const offset = (Math.max(page, 1) - 1) * pageSize;
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.files({ search, limit: pageSize, offset }),
    queryFn: () =>
      api.listEmployeeFileSummaries({ search, limit: pageSize, offset }),
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
) {
  const offset = (Math.max(page, 1) - 1) * pageSize;
  return useQuery({
    queryKey: EMPLOYEE_FILES_KEYS.issues(category, { limit: pageSize, offset }),
    queryFn: () => api.listEmployeeFileIssues(category, { limit: pageSize, offset }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.config });
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
