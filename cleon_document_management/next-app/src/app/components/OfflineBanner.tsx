"use client";

import { useOnlineStatus } from "../../../lib/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="offline-banner border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900"
    >
      You&apos;re offline. Actions that change files require an internet
      connection. Reconnect and try again.
    </div>
  );
}
