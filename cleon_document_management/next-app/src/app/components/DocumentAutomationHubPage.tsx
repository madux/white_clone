"use client";

import Link from "next/link";
import { Workflow } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  documentAutomations,
  documentAutomationHub,
  type AutomationLibrary,
} from "../../../lib/documentAutomationApi";
import {
  automationActionLabel,
  automationTriggerLabel,
} from "../../../lib/orgAutomateCatalog";
import type { OrgDocumentAutomationRule } from "../../../lib/types";
import { useAppDialog } from "../../../hooks/useAppDialog";
import AutomationRuleEditor from "./AutomationRuleEditor";
import EmptyState from "./EmptyState";
import LibraryBreadcrumb from "./LibraryBreadcrumb";

type AutomationRow = OrgDocumentAutomationRule & {
  document_name: string;
  folder_id: number;
  folder_name: string;
  employee_id?: number;
  employee_name?: string;
};

const COPY: Record<
  AutomationLibrary,
  {
    breadcrumbRoot: { label: string; href: string };
    breadcrumbCurrent: string;
    title: string;
    description: string;
    emptyDescription: string;
    employeeColumn: boolean;
  }
> = {
  organizational: {
    breadcrumbRoot: { label: "Organizational Files", href: "/pages/organization" },
    breadcrumbCurrent: "Automation hub",
    title: "Automation hub",
    description:
      "Document automations across the organisational library. Open a rule to configure it or review run history.",
    emptyDescription:
      "Open a document menu → Lifecycle → Automate to add expiry and notification rules.",
    employeeColumn: false,
  },
  employee: {
    breadcrumbRoot: { label: "Employee Files", href: "/pages/employee" },
    breadcrumbCurrent: "Automation hub",
    title: "Employee files automation",
    description:
      "Document automations across employee files. Open a rule to configure it or review run history.",
    emptyDescription:
      "Open a document menu → Lifecycle → Automate on an employee file document.",
    employeeColumn: true,
  },
};

export default function DocumentAutomationHubPage({
  library = "organizational",
}: {
  library?: AutomationLibrary;
}) {
  const copy = COPY[library];
  const { showAlert } = useAppDialog();
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<AutomationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentAutomationHub(library);
      if (!result.success) {
        throw new Error(result.message || "Unable to load automations.");
      }
      setRows((result.data?.items ?? []) as unknown as AutomationRow[]);
      setCanManage(result.data?.can_manage === true);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load automations.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [library, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRule = async (row: AutomationRow) => {
    try {
      const result = await documentAutomations(library, {
        op: "get_by_id",
        id: row.id,
      });
      if (!result.success || !result.data) {
        throw new Error(result.message || "Unable to open rule.");
      }
      setEditing({
        ...(result.data as unknown as OrgDocumentAutomationRule),
        document_name: row.document_name,
        folder_id: row.folder_id,
        folder_name: row.folder_name,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
      } as AutomationRow);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to open rule.",
      );
    }
  };

  const documentHref = (row: AutomationRow) => {
    if (library === "employee" && row.employee_id) {
      return `/pages/employee/profile?employee=${row.employee_id}&doc=${row.document_id}`;
    }
    return `/pages/organization/folder?folder=${row.folder_id}&doc=${row.document_id}`;
  };

  return (
    <div className="app-page space-y-4">
      <LibraryBreadcrumb
        items={[copy.breadcrumbRoot, { label: copy.breadcrumbCurrent }]}
      />
      <header className="px-4">
        <h1 className="text-lg font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? copy.description
            : "Rules you can see on documents in your scope. Configuration is read-only; run history is available when you open a rule."}
        </p>
      </header>
      <section className="app-page-body mx-4 overflow-hidden rounded-xl border border-slate-200">
        {loading ? (
          <EmptyState title="Loading automations…" loading />
        ) : !rows.length ? (
          <EmptyState
            icon={Workflow}
            title="No automations yet"
            description={copy.emptyDescription}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Rule</th>
                {copy.employeeColumn ? <th className="p-3">Employee</th> : null}
                <th className="p-3">Document</th>
                <th className="p-3">Folder</th>
                <th className="p-3">Trigger</th>
                <th className="p-3">Action</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">
                    <button
                      type="button"
                      onClick={() => void openRule(row)}
                      className="text-left text-brand-text hover:underline"
                    >
                      {row.name}
                    </button>
                  </td>
                  {copy.employeeColumn ? (
                    <td className="p-3">
                      {row.employee_id ? (
                        <Link
                          href={`/pages/employee/profile?employee=${row.employee_id}`}
                          className="text-brand-pink hover:underline"
                        >
                          {row.employee_name || `Employee #${row.employee_id}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  <td className="p-3">
                    <Link href={documentHref(row)} className="text-brand-pink hover:underline">
                      {row.document_name}
                    </Link>
                  </td>
                  <td className="p-3">{row.folder_name}</td>
                  <td className="p-3">{automationTriggerLabel(row.trigger)}</td>
                  <td className="p-3">{automationActionLabel(row.action)}</td>
                  <td className="p-3 capitalize">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing ? (
        <AutomationRuleEditor
          library={library}
          documentId={editing.document_id}
          documentName={editing.document_name}
          ruleId={editing.id}
          readOnly={!canManage}
          zIndex={130}
          onClose={() => setEditing(null)}
          onSaved={(rule) => {
            setRows((current) =>
              current.map((row) =>
                row.id === rule.id
                  ? {
                      ...row,
                      ...rule,
                      document_name: editing.document_name,
                      folder_id: editing.folder_id,
                      folder_name: editing.folder_name,
                      employee_id: editing.employee_id,
                      employee_name: editing.employee_name,
                    }
                  : row,
              ),
            );
          }}
          onDeleted={() => {
            setRows((current) => current.filter((row) => row.id !== editing.id));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
