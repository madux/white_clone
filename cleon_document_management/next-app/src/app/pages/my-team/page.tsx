"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function MyTeamRoute() {
  return <QueryRedirect href={() => myWorkspaceHref("team")} />;
}
