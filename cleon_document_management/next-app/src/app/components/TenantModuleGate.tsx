"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { tenantModulesFromUser } from "../../../hooks/useTenantModules";
import {
  isTenantModuleEnabled,
  type TenantModuleKey,
} from "../../../lib/tenantModuleCatalog";

type Props = {
  moduleKeys: TenantModuleKey[];
  children: React.ReactNode;
  fallbackHref?: string;
};

export default function TenantModuleGate({
  moduleKeys,
  children,
  fallbackHref = "/pages/my-workspace",
}: Props) {
  const user = useCurrentUser();
  const router = useRouter();
  const modules = tenantModulesFromUser(user.data);
  const allowed = moduleKeys.every((key) => isTenantModuleEnabled(modules, key));

  useEffect(() => {
    if (user.isPending || allowed) return;
    router.replace(fallbackHref);
  }, [allowed, fallbackHref, router, user.isPending]);

  if (user.isPending || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
        Loading workspace...
      </div>
    );
  }
  return <>{children}</>;
}
