"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function ArchivedDocumentsRoute() {
  return (
    <QueryRedirect href={() => myWorkspaceHref("archived")} />
  );
}
