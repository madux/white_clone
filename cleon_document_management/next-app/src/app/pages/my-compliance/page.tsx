"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function MyComplianceRoute() {
  return (
    <QueryRedirect href={() => myWorkspaceHref("compliance")} />
  );
}
