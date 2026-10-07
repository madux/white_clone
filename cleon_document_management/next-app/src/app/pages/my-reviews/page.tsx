"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function MyReviewsRoute() {
  return <QueryRedirect href={() => myWorkspaceHref("reviews")} />;
}
