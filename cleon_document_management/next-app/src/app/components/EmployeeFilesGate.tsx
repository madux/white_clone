"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { canAccessEmployeeFilesAdmin } from "../../../lib/employeeFilesAccess";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";

export default function EmployeeFilesGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const allowed = canAccessEmployeeFilesAdmin(user.data);

  useEffect(() => {
    if (user.isPending || allowed) return;
    router.replace(
      canAccessOrgLibrary(user.data) ? "/pages/organization" : "/pages/my-workspace",
    );
  }, [allowed, router, user.data, user.isPending]);

  if (user.isPending || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
        Loading workspace...
      </div>
    );
  }
  return <>{children}</>;
}
