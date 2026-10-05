"use client";

import { ShieldOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { canApproveEmployeeDocuments } from "../../../lib/employeeFilesAccess";
import { canApproveOrgRequests } from "../../../lib/organizationalFilesAccess";
import { useCurrentUser } from "../../../hooks/useDocuments";
import EmployeeFilesPendingApprovalsPanel from "./EmployeeFilesPendingApprovalsPanel";
import OrganizationalApprovalRequestsPage from "./OrganizationalApprovalRequestsPage";
import SectionTabs from "./SectionTabs";
import EmptyState from "./EmptyState";

export type ApprovalRequestsKind = "all" | "employee" | "organizational";

function kindFromParam(value: string | null): ApprovalRequestsKind {
  if (value === "employee" || value === "organizational") return value;
  return "all";
}

export default function ApprovalRequestsPage({
  defaultKind = "all",
}: {
  defaultKind?: ApprovalRequestsKind;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser().data;
  const canEmployee = canApproveEmployeeDocuments(user);
  const canOrg = canApproveOrgRequests(user);

  const kind = useMemo(() => {
    const param = searchParams.get("kind");
    if (param) return kindFromParam(param);
    return defaultKind;
  }, [searchParams, defaultKind]);

  const setKind = useCallback(
    (next: ApprovalRequestsKind) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("kind");
      else params.set("kind", next);
      const query = params.toString();
      router.replace(
        query ? `/pages/approvals?${query}` : "/pages/approvals",
        { scroll: false },
      );
    },
    [router, searchParams],
  );

  const tabItems = useMemo(() => {
    const items: { id: ApprovalRequestsKind; label: string }[] = [];
    if (canEmployee && canOrg) {
      items.push({ id: "all", label: "All" });
    }
    if (canEmployee) {
      items.push({ id: "employee", label: "Employee files" });
    }
    if (canOrg) {
      items.push({ id: "organizational", label: "Organisational files" });
    }
    if (!items.length) {
      items.push({ id: "all", label: "Approvals" });
    }
    return items;
  }, [canEmployee, canOrg]);

  const activeKind =
    tabItems.some((item) => item.id === kind) ? kind : tabItems[0]?.id ?? "all";

  const showEmployee = activeKind === "all" || activeKind === "employee";
  const showOrg = activeKind === "all" || activeKind === "organizational";

  return (
    <div className="app-page space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Approval requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Review employee file uploads and organisational change requests in one place.
        </p>
      </header>

      {tabItems.length > 1 ? (
        <SectionTabs
          ariaLabel="Approval types"
          level="page"
          value={activeKind}
          onChange={(value) => setKind(value as ApprovalRequestsKind)}
          items={tabItems}
        />
      ) : null}

      {showEmployee && canEmployee ? (
        <section className="space-y-3">
          {activeKind === "all" ? (
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Employee files
            </h2>
          ) : null}
          <EmployeeFilesPendingApprovalsPanel />
        </section>
      ) : null}

      {showOrg && canOrg ? (
        <section className="space-y-3">
          {activeKind === "all" ? (
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Organisational files
            </h2>
          ) : null}
          <OrganizationalApprovalRequestsPage embedded />
        </section>
      ) : null}

      {!canEmployee && !canOrg ? (
        <section className="app-page-body">
          <EmptyState
            icon={ShieldOff}
            title="No access to approval requests"
            description="You do not have permission to review employee or organisational approval queues. Contact an administrator if you need approver access."
          />
        </section>
      ) : null}
    </div>
  );
}
