import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../lib/employeeFileListPageSize";
import type { ModuleRoleAssignment } from "../lib/types";

export function useModuleRoleDefinitions(enabled = true) {
  return useQuery({
    queryKey: ["document-management", "roles", "definitions"],
    queryFn: api.getModuleRoleDefinitions,
    enabled,
  });
}

export function useModuleRoleMembers(
  search = "",
  page = 1,
  enabled = true,
  pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
) {
  return useQuery({
    queryKey: ["document-management", "roles", "members", search, page, pageSize],
    queryFn: () => api.getModuleRoleMembers(search, page, pageSize),
    enabled,
  });
}

export function useAssignModuleRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employee_id: number;
      assignments: ModuleRoleAssignment[];
    }) => api.assignModuleRoles(payload.employee_id, payload.assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["document-management", "roles", "members"],
      });
    },
  });
}
