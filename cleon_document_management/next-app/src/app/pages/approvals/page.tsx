"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { reviewQueueHref } from "../../../../lib/reviewQueue";

export default function ApprovalsRoute() {
  return (
    <QueryRedirect
      href={(search) => {
        const kind = search.get("kind");
        if (kind === "organizational") {
          return reviewQueueHref("org");
        }
        return reviewQueueHref("employee");
      }}
    />
  );
}
