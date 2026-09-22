import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ModuleRoleAssignment, ModuleRoleMember } from "../lib/types";

export function useModuleRoleDefinitions(enabled = true) {
  return useQuery({
    queryKey: ["document-management", "roles", "definitions"],
    queryFn: api.getModuleRoleDefinitions,
    enabled,
  });
}

export function useModuleRoleMembers(search = "", enabled = true) {
  return useQuery({
    queryKey: ["document-management", "roles", "members", search],
    queryFn: () => api.getModuleRoleMembers(search),
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
