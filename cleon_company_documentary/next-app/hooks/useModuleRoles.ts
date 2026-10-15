"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ModuleRoleAssignment } from "../lib/types";

export function useModuleRoleDefinitions(enabled = true) {
  return useQuery({
    queryKey: ["company-documentary", "roles", "definitions"],
    queryFn: api.roleDefinitions,
    enabled,
  });
}

export function useModuleRoleMembers(
  search = "",
  enabled = true,
  limit = 5,
  offset = 0,
) {
  return useQuery({
    queryKey: ["company-documentary", "roles", "members", search, limit, offset],
    queryFn: () => api.roleMembers(search, limit, offset),
    enabled,
  });
}

export function useModuleRoleMemberStats(enabled = true) {
  return useQuery({
    queryKey: ["company-documentary", "roles", "member-stats"],
    queryFn: api.roleMemberStats,
    enabled,
  });
}

export function useAssignModuleRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employee_id: number;
      assignments: ModuleRoleAssignment[];
    }) => api.assignRoles(payload.employee_id, payload.assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-documentary", "roles", "members"],
      });
      queryClient.invalidateQueries({
        queryKey: ["company-documentary", "roles", "member-stats"],
      });
    },
  });
}
