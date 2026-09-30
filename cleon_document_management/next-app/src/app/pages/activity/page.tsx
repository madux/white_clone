"use client";

import QueryRedirect from "@/app/components/QueryRedirect";

export default function ActivityRoute() {
  return (
    <QueryRedirect href={() => "/pages/dashboard/?tab=activity"} />
  );
}
