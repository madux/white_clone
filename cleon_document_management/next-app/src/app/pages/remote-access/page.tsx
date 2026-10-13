"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function RemoteAccessRoute() {
  return <QueryRedirect href={() => myWorkspaceHref("sharing")} />;
}
