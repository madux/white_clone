"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Dashboard from "./Dashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ActivityPage from "./ActivityPage";
import SectionTabs from "./SectionTabs";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { canAccessEmployeeFilesAdmin } from "../../../lib/employeeFilesAccess";
import { canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";

export default function HomePage() {
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEmployeeFiles = canAccessEmployeeFilesAdmin(user.data);
  const canOrgFiles = canAccessOrgLibrary(user.data);
  const isAdmin =
    user.data?.is_document_admin === true || user.data?.is_admin === true;
  const tab =
    searchParams.get("tab") === "activity" && isAdmin ? "activity" : "overview";

  useEffect(() => {
    if (user.isPending || canEmployeeFiles || !canOrgFiles) return;
    router.replace("/pages/organization");
  }, [canEmployeeFiles, canOrgFiles, router, user.isPending]);

  if (user.isPending || (!canEmployeeFiles && canOrgFiles)) {
    return (
      <div className="app-page text-sm text-slate-500">Loading home…</div>
    );
  }

  return (
    <div className="app-page space-y-4">
      <SectionTabs
        items={[
          { id: "overview", label: "Overview" },
          ...(isAdmin ? [{ id: "activity", label: "Activity" }] : []),
        ]}
        value={tab}
        onChange={(next) =>
          router.replace(
            next === "activity"
              ? "/pages/dashboard/?tab=activity"
              : "/pages/dashboard/",
          )
        }
        level="page"
        ariaLabel="Home sections"
      />
      {tab === "overview" ? (
        canEmployeeFiles ? <Dashboard /> : <EmployeeDashboard />
      ) : canEmployeeFiles ? (
        <ActivityPage embedded />
      ) : (
        <EmployeeDashboard showActivity />
      )}
    </div>
  );
}
