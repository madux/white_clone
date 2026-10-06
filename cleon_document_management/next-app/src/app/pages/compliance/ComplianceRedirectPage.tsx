"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../../hooks/useDocuments";
import {
  canViewComplianceModule,
  userHasDmsPermission,
} from "../../../../lib/dmsAccess";
import { myWorkspaceHref } from "../../../../lib/workspaceRoutes";

export default function ComplianceRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const data = user.data;
    const canPolicies =
      canViewComplianceModule(data) &&
      (userHasDmsPermission(data, "compliance_manage_policies") ||
        userHasDmsPermission(data, "compliance_view"));
    if (canPolicies) {
      params.set("tab", "compliance");
      router.replace(`/pages/employee?${params.toString()}`);
      return;
    }
    router.replace(myWorkspaceHref("compliance"));
  }, [router, searchParams, user.data]);

  return (
    <div className="app-page">
      <p className="text-sm text-slate-500">Opening compliance…</p>
    </div>
  );
}
