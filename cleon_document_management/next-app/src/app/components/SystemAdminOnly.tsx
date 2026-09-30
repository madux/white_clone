"use client";

import { useCurrentUser } from "../../../hooks/useDocuments";

export default function SystemAdminOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();

  if (user.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
        Loading workspace...
      </div>
    );
  }

  if (user.data?.is_admin !== true) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm font-semibold text-red-700">
        Super Admin is restricted to system administrators.
      </div>
    );
  }

  return <>{children}</>;
}
