"use client";

import EmptyState from "./EmptyState";

export default function WorkspaceMyRequestsTab() {
  return (
    <EmptyState
      title="No outgoing requests"
      description="Signature requests, template requests, and uploads you submitted for approval will appear here once the work item and signature services are connected."
    />
  );
}
