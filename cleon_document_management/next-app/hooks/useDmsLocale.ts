"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { dmsContractsApi } from "../lib/dmsContractsApi";
import {
  type DmsDateFormatKey,
  setDmsLocaleSnapshot,
} from "../lib/dmsLocale";

export function useDmsLocale(enabled = true) {
  const query = useQuery({
    queryKey: ["dms-locale"],
    queryFn: async () => {
      const result = await dmsContractsApi.settingsRead();
      if (!result.success) {
        throw new Error("Could not load organisation locale.");
      }
      const general = result.data?.general || {};
      return {
        dateFormat: (general.date_format as DmsDateFormatKey) || "d_mmm_yyyy",
        timeZone: String(general.timezone || "UTC"),
        language: String(general.language || "en_GB"),
      };
    },
    enabled,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (query.data) {
      setDmsLocaleSnapshot(query.data);
    }
  }, [query.data]);

  return query;
}

export function useInvalidateDmsLocale() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["dms-locale"] });
}
