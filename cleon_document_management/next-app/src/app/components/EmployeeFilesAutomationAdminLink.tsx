"use client";

import Link from "next/link";
import { ChevronRight, Workflow } from "lucide-react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import {
  canAccessEmployeeFilesAdmin,
  canAutomateEmployeeDocuments,
} from "../../../lib/employeeFilesAccess";

export default function EmployeeFilesAutomationAdminLink() {
  const user = useCurrentUser();
  if (!canAccessEmployeeFilesAdmin(user.data)) return null;
  const canManage = canAutomateEmployeeDocuments(user.data);

  return (
    <nav aria-label="Employee files tools" className="px-4">
      <Link
        href="/pages/employee/automation"
        className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-brand-text to-brand-pink text-white"
        >
          <Workflow className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
            Automation hub
            <ChevronRight
              className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-pink"
              aria-hidden
            />
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-slate-600">
            {canManage
              ? "View and manage employee file document rules for expiry, reminders, and notifications."
              : "Review automation rules and run history across employee files you can access."}
          </span>
        </span>
      </Link>
    </nav>
  );
}
