"use client";

import { useSettings } from "../../../hooks/useDocuments";

export default function OutOfOfficeBanner() {
  const settings = useSettings();
  const data = settings.data?.settings;
  const delegateId = data?.org_approval_delegate_user_id;
  const until = data?.org_approval_delegate_until;
  if (!delegateId) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Out of office:</strong> approvals are delegated
      {until ? ` until ${until}` : ""}. Remote workspace access is separate from this banner.
    </div>
  );
}
