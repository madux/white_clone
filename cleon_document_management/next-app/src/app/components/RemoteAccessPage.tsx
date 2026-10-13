"use client";

import WorkspaceSharingPanel from "./WorkspaceSharingPanel";

/** @deprecated Use My Workspace → Workspace sharing */
export default function RemoteAccessPage() {
  return <WorkspaceSharingPanel embedded={false} />;
}
