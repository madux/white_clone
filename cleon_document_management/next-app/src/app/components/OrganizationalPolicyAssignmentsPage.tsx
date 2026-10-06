"use client";

import Link from "next/link";
import { UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import EmptyState from "./EmptyState";
import LibraryBreadcrumb from "./LibraryBreadcrumb";

type AssignmentRow = {
  id: number;
  policy_id: number;
  policy_name: string;
  employee_id: number;
  employee_name: string;
  document_id?: number | false;
  requested_signature?: boolean;
};

export default function OrganizationalPolicyAssignmentsPage() {
  const { showAlert } = useAppDialog();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.organizationalPolicyAssignments({ limit: 200 });
      if (!result.success) {
        throw new Error(result.message || "Unable to load assignments.");
      }
      setRows((result.data?.items ?? []) as AssignmentRow[]);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load assignments.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="app-page space-y-4">
      <LibraryBreadcrumb
        items={[
          { label: "Organizational Files", href: "/pages/organization" },
          { label: "Policy assignments" },
        ]}
      />
      <header className="px-4">
        <h1 className="text-lg font-semibold">Policy assignments</h1>
        <p className="text-sm text-muted-foreground">
          Organisational policies assigned to employee files. Assign from a policy document menu
          or compliance workflows.
        </p>
      </header>
      <section className="app-page-body mx-4 overflow-hidden rounded-xl border border-slate-200">
        {loading ? (
          <EmptyState title="Loading assignments…" loading />
        ) : !rows.length ? (
          <EmptyState
            icon={UserCheck}
            title="No assignments yet"
            description="Use Assign policy on an organisational policy document to queue employee assignments."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Policy</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Signature requested</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{row.policy_name || `#${row.policy_id}`}</td>
                  <td className="p-3">
                    <Link
                      href={`/pages/employee?employee_id=${row.employee_id}`}
                      className="text-brand-pink hover:underline"
                    >
                      {row.employee_name}
                    </Link>
                  </td>
                  <td className="p-3">{row.requested_signature ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
