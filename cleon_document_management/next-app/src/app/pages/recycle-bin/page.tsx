"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function RecycleBinRoute() {
  return (
    <QueryRedirect href={() => myWorkspaceHref("recycle")} />
  );
}
