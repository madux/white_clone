"use client";

import { useState } from "react";
import {
  useEmployeeFileExclusions,
  useRemoveEmployeeFileExclusion,
} from "../../../hooks/useEmployeeFiles";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../hooks/useToast";
import EmployeeFilesExclusionDialog from "./EmployeeFilesExclusionDialog";

const REASON_LABELS: Record<string, string> = {
  manual: "Manually excluded",
  inactive: "Inactive (per configuration)",
  test_employee: "Test employee (per configuration)",
  init_failed: "Initialization failed",
  awaiting_processing: "Awaiting processing",
  unresolved_data: "Unresolved data issue",
};

export default function EmployeeFilesExclusionsSettings() {
  const exclusions = useEmployeeFileExclusions("manual");
  const remove = useRemoveEmployeeFileExclusion();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<"select" | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-files", "exclusions"] });
  };

  const onRemove = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      showToast("Employee removed from exclusions.");
    } catch (error: any) {
      showToast(error?.message || "Unable to remove exclusion.", "error");
    }
  };

  const rows = exclusions.data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <h4 className="text-sm font-bold text-slate-900">Employee exclusions</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          EMS employees listed here will not receive an Employee File during setup or sync. Add or
          remove exclusions without re-running the setup wizard. Inactive and test-employee rules are
          controlled on the General tab.
        </p>
        <p className="mt-4 text-sm font-semibold text-slate-800">
          {rows.length} employee{rows.length === 1 ? "" : "s"} excluded manually
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-pink-200 hover:bg-pink-50/30"
          onClick={() => setDialog("select")}
        >
          Select employees
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Excluded on</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{row.employee_name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.department_name || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {REASON_LABELS[row.reason] ?? row.reason}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {row.date_identified
                    ? new Date(row.date_identified).toLocaleDateString()
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={remove.isPending}
                    className="text-sm font-semibold text-slate-500 hover:text-brand-pink"
                    onClick={() => onRemove(row.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !exclusions.isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No manually excluded employees. Use Select employees to add exclusions.
          </p>
        ) : null}
        {exclusions.isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading exclusions…</p>
        ) : null}
      </div>

      {dialog === "select" ? (
        <EmployeeFilesExclusionDialog
          mode="select"
          exclusions={rows}
          onClose={() => setDialog(null)}
          onSaved={() => {
            refresh();
            showToast("Exclusions updated.");
          }}
          onRemoved={refresh}
        />
      ) : null}
    </div>
  );
}
