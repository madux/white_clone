"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { tenantModulesFromUser } from "../../../hooks/useTenantModules";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";
import { isTenantModuleEnabled } from "../../../lib/tenantModuleCatalog";

export default function OrganizationalLibraryGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const allowed =
    canAccessOrgLibrary(user.data) &&
    isTenantModuleEnabled(
      tenantModulesFromUser(user.data),
      "organizational_files",
    );

  useEffect(() => {
    if (!user.isPending && !allowed) {
      router.replace("/pages/my-workspace");
    }
  }, [allowed, router, user.isPending]);

  if (user.isPending || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
        Loading workspace...
      </div>
    );
  }
  return <>{children}</>;
}
