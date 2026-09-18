"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  buildCreateFolderHref,
  storeCreateFolderIntent,
} from "../../../lib/createFolderIntent";
import {
  useApprovalInbox,
  usePendingEmployeeUploads,
} from "../../../hooks/useDocuments";
import type { PendingEmployeeUpload } from "../../../lib/types";
import SectionTabs from "./SectionTabs";

const statusMeta = {
  pending_review: {
    label: "Pending review",
    className: "bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  awaiting_folder: {
    label: "Awaiting folder",
    className: "bg-sky-50 text-sky-700",
    icon: AlertCircle,
  },
  awaiting_folder_restore: {
    label: "Restore folder to reassign",
    className: "bg-violet-50 text-violet-700",
    icon: AlertCircle,
  },
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value.replace(" ", "T")));
}

function actionForItem(item: PendingEmployeeUpload) {
  if (item.status === "pending_review") {
    return {
      href: `/pages/employee/profile?employee=${item.employee_id}&doc=${item.id}`,
      label: "Review",
      hint: "Approve or reject this upload",
    };
  }
  if (item.status === "awaiting_folder_restore") {
    return {
      href: "/pages/recycle-bin",
      label: "Manage in recycle bin",
      hint: "Restore the folder or move files before permanent delete",
    };
  }
  return {
    href: buildCreateFolderHref(item),
    label: "Create folder",
    hint: "Opens the create-folder flow with this employee's department prefilled",
    secondaryHref: `/pages/employee/profile?employee=${item.employee_id}`,
    secondaryLabel: "View employee",
    openCreateFolder: true,
  };
}

export default function EmployeeFilesPendingApprovalsPanel() {
  const router = useRouter();
  const uploads = usePendingEmployeeUploads(true);
  const approvalInbox = useApprovalInbox(true);
  const [filter, setFilter] = useState<
    "all" | "pending_review" | "awaiting_folder" | "awaiting_folder_restore"
  >("all");

  const uploadItems = uploads.data?.items ?? [];
  const inboxDocumentIds = new Set(
    (approvalInbox.data?.items ?? []).map((item) => item.document_id),
  );

  const items = useMemo(() => {
    const rows = uploadItems.filter(
      (item) => !inboxDocumentIds.has(item.id) || item.status !== "pending_review",
    );
    if (filter === "all") return rows;
    return rows.filter((item) => item.status === filter);
  }, [filter, uploadItems, inboxDocumentIds]);

  const counts = useMemo(() => {
    const rows = uploadItems.filter(
      (item) => !inboxDocumentIds.has(item.id) || item.status !== "pending_review",
    );
    return {
      all: rows.length + (approvalInbox.data?.count ?? 0),
      pending_review:
        rows.filter((item) => item.status === "pending_review").length +
        (approvalInbox.data?.count ?? 0),
      awaiting_folder: rows.filter((item) => item.status === "awaiting_folder")
        .length,
      awaiting_folder_restore: rows.filter(
        (item) => item.status === "awaiting_folder_restore",
      ).length,
    };
  }, [uploadItems, approvalInbox.data?.count, inboxDocumentIds]);

  const showInbox =
    filter === "all" || filter === "pending_review"
      ? approvalInbox.data?.items ?? []
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-2xl font-bold text-brand-text">{counts.all}</p>
          <p className="text-xs font-semibold text-slate-400">open items</p>
        </div>
      </div>

      <SectionTabs
        items={[
          { id: "all", label: "All", count: counts.all },
          {
            id: "pending_review",
            label: "Pending approval",
            count: counts.pending_review,
          },
          {
            id: "awaiting_folder",
            label: "Awaiting folder",
            count: counts.awaiting_folder,
          },
          {
            id: "awaiting_folder_restore",
            label: "Awaiting restore",
            count: counts.awaiting_folder_restore,
          },
        ]}
        value={filter}
        onChange={setFilter}
        ariaLabel="Pending approval filters"
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {uploads.isLoading || approvalInbox.isLoading ? (
          <div className="p-10 text-center text-sm font-semibold text-slate-400">
            Loading pending approvals…
          </div>
        ) : showInbox.length || items.length ? (
          <div className="overflow-x-auto">
            <table className="dms-table min-w-full">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th className="dms-col-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {showInbox.map((item) => (
                  <tr
                    key={`inbox-${item.approval_id}`}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.document}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.document_type}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {item.employee}
                    </td>
                    <td className="px-5 py-4 text-slate-600">—</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        <Clock3 className="h-3.5 w-3.5" />
                        Pending approval
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDate(String(item.created_at))}
                    </td>
                    <td className="dms-col-actions">
                      <Link
                        href={`/pages/employee/profile?employee=${item.employee_id ?? 0}&doc=${item.document_id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        Review
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.map((item: PendingEmployeeUpload) => {
                  const meta = statusMeta[item.status];
                  const StatusIcon = meta.icon;
                  const action = actionForItem(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/30"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.document_type}
                              {item.origin_folder_name
                                ? ` · from ${item.origin_folder_name}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">
                        {item.employee_name}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {item.department || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="dms-col-actions">
                        <div className="flex flex-col items-end gap-1.5">
                          {"openCreateFolder" in action && action.openCreateFolder ? (
                            <button
                              type="button"
                              onClick={() => {
                                storeCreateFolderIntent({
                                  employeeId: item.employee_id,
                                  departmentId: item.department_id || undefined,
                                  folderName: item.department || "",
                                });
                                router.push(action.href);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                              title={action.hint}
                            >
                              {action.label}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <Link
                              href={action.href}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                              title={action.hint}
                            >
                              {action.label}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {"secondaryHref" in action && action.secondaryHref ? (
                            <Link
                              href={action.secondaryHref}
                              className="text-xs font-semibold text-brand-pink hover:underline"
                            >
                              {action.secondaryLabel}
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="mt-4 text-sm font-semibold text-slate-800">
              No pending approvals
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Uploads awaiting your decision will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
