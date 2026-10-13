"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { tenantModulesFromUser } from "../../../hooks/useTenantModules";
import { canViewComplianceModule } from "../../../lib/dmsAccess";
import { isTenantModuleEnabled } from "../../../lib/tenantModuleCatalog";

export default function ComplianceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const allowed =
    canViewComplianceModule(user.data) &&
    isTenantModuleEnabled(tenantModulesFromUser(user.data), "compliance");

  useEffect(() => {
    if (user.isPending || allowed) return;
    router.replace("/pages/my-workspace");
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
