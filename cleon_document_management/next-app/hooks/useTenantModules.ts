"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { dmsContractsApi } from "../lib/dmsContractsApi";
import {
  DEFAULT_TENANT_MODULES,
  mergeTenantModules,
  type TenantModuleKey,
  type TenantModulesMap,
} from "../lib/tenantModuleCatalog";
import { useCurrentUser } from "./useDocuments";

const QUERY_KEY = ["tenant", "modules"];

export function useTenantModules() {
  const user = useCurrentUser();
  const fromUser = mergeTenantModules(user.data?.tenant_modules);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const result = await dmsContractsApi.settingsRead();
      return mergeTenantModules(result.data?.modules);
    },
    enabled: Boolean(user.data),
    staleTime: 60_000,
    initialData: fromUser,
  });

  return {
    modules: query.data ?? fromUser,
    isLoading: user.isPending || query.isLoading,
    refetch: query.refetch,
  };
}

export function useSaveTenantModules() {
  const queryClient = useQueryClient();
  return useCallback(
    async (modules: Record<TenantModuleKey, boolean>) => {
      const result = await dmsContractsApi.tenantModulesSave(modules);
      if (!result.success) {
        throw new Error(result.message || "Could not save modules.");
      }
      const merged = mergeTenantModules(result.data?.modules);
      queryClient.setQueryData(QUERY_KEY, merged);
      await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      return {
        modules: merged,
        notes: result.data?.notes ?? [],
      };
    },
    [queryClient],
  );
}

export function tenantModulesFromUser(
  user?: { tenant_modules?: TenantModulesMap } | null,
) {
  return mergeTenantModules(user?.tenant_modules);
}
