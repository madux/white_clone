"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function QuickAccessRoute() {
  return (
    <QueryRedirect href={() => myWorkspaceHref("quick-access")} />
  );
}
