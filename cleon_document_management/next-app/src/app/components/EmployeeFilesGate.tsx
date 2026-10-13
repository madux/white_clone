"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { tenantModulesFromUser } from "../../../hooks/useTenantModules";
import { canAccessEmployeeFilesAdmin } from "../../../lib/employeeFilesAccess";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";
import { isTenantModuleEnabled } from "../../../lib/tenantModuleCatalog";

export default function EmployeeFilesGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const allowed =
    canAccessEmployeeFilesAdmin(user.data) &&
    isTenantModuleEnabled(tenantModulesFromUser(user.data), "employee_files");

  useEffect(() => {
    if (user.isPending || allowed) return;
    const modules = tenantModulesFromUser(user.data);
    const orgRoute =
      canAccessOrgLibrary(user.data) &&
      isTenantModuleEnabled(modules, "organizational_files");
    router.replace(orgRoute ? "/pages/organization" : "/pages/my-workspace");
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
