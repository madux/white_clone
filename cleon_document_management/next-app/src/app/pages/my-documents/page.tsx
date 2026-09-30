"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import {
  mapLegacyDocumentsParams,
  myWorkspaceHref,
} from "../../../../lib/workspaceRoutes";

export default function MyDocumentsRoute() {
  return (
    <QueryRedirect
      href={(search) => {
        if (search.get("tab") === "activity") {
          return "/pages/dashboard/?tab=activity";
        }
        if (search.get("tab") === "dashboard") {
          return "/pages/dashboard/";
        }
        const mapped = mapLegacyDocumentsParams(search);
        const extra = Object.fromEntries(mapped.entries());
        return myWorkspaceHref("documents", extra);
      }}
    />
  );
}
