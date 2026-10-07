"use client";

import QueryRedirect from "@/app/components/QueryRedirect";
import { reviewQueueHref } from "../../../../lib/reviewQueue";

export default function MyVerificationsRoute() {
  return <QueryRedirect href={() => reviewQueueHref("compliance")} />;
}
