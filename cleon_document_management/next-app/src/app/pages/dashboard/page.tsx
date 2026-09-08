"use client";

import Dashboard from "@/app/components/Dashboard";
import EmployeeDashboard from "@/app/components/EmployeeDashboard";
import { useCurrentUser } from "../../../../hooks/useDocuments";

export default function DashboardPage() {
  const user = useCurrentUser();
  const isAdmin = user.data?.is_document_manager === true;

  if (user.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return isAdmin ? <Dashboard /> : <EmployeeDashboard />;
}
