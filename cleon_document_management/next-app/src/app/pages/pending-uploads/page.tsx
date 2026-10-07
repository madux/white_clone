"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { reviewQueueHref } from "../../../../lib/reviewQueue";

export default function PendingUploadsRoute() {
  return <QueryRedirect href={() => reviewQueueHref("employee")} />;
}
