import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { EmployeeFilesRole } from "../lib/types";

const baseKey = ["employee-files", "roles"];

export function useEmployeeFilesRoles(enabled = true) {
  return useQuery({
    queryKey: [...baseKey, "list"],
    queryFn: api.listEmployeeFilesRoles,
    enabled,
  });
}

export function useEmployeeFilesRoleMembers(search = "", enabled = true) {
  return useQuery({
    queryKey: [...baseKey, "members", search],
    queryFn: () => api.getEmployeeFilesRoleMembers(search),
    enabled,
  });
}

export function useEmployeeFilesRoleDocumentTypes(enabled = true) {
  return useQuery({
    queryKey: [...baseKey, "document-types"],
    queryFn: api.listEmployeeFilesRoleDocumentTypes,
    enabled,
  });
}

export function useSaveEmployeeFilesRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: EmployeeFilesRole) => api.saveEmployeeFilesRole(role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}

export function useDeleteEmployeeFilesRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => api.deleteEmployeeFilesRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}

export function useAssignEmployeeFilesRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: number; role_ids: number[] }) =>
      api.assignEmployeeFilesRoles(payload.user_id, payload.role_ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}
