"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  buildCreateFolderHref,
  storeCreateFolderIntent,
} from "../../../lib/createFolderIntent";
import {
  useCurrentUser,
  usePendingEmployeeUploads,
} from "../../../hooks/useDocuments";
import type { PendingEmployeeUpload } from "../../../lib/types";

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
      href: `/pages/employee/profile?employee=${item.employee_id}`,
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

export default function PendingUploadsPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isAdmin = Boolean(currentUser.data?.is_document_manager);
  const uploads = usePendingEmployeeUploads(isAdmin);
  const [filter, setFilter] = useState<
    "all" | "pending_review" | "awaiting_folder" | "awaiting_folder_restore"
  >("all");

  const items = useMemo(() => {
    const rows = uploads.data?.items ?? [];
    if (filter === "all") return rows;
    return rows.filter((item) => item.status === filter);
  }, [filter, uploads.data?.items]);

  const counts = useMemo(() => {
    const rows = uploads.data?.items ?? [];
    return {
      all: rows.length,
      pending_review: rows.filter((item) => item.status === "pending_review")
        .length,
      awaiting_folder: rows.filter((item) => item.status === "awaiting_folder")
        .length,
      awaiting_folder_restore: rows.filter(
        (item) => item.status === "awaiting_folder_restore",
      ).length,
    };
  }, [uploads.data?.items]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[1650px] p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Document manager access is required to view pending employee uploads.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-2xl font-bold text-brand-text">{counts.all}</p>
          <p className="text-xs font-semibold text-slate-400">open items</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["pending_review", "Pending review"],
            ["awaiting_folder", "Awaiting folder"],
            ["awaiting_folder_restore", "Awaiting restore"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === value
                ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-md shadow-pink-200"
                : "bg-white text-slate-500 hover:bg-pink-50"
            }`}
          >
            {label}
            <span className="ml-1 opacity-80">{counts[value]}</span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {uploads.isLoading ? (
          <div className="p-10 text-center text-sm font-semibold text-slate-400">
            Loading pending uploads...
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Document</th>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Submitted</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
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
                      <td className="px-5 py-4 text-right">
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
                          {action.secondaryHref && (
                            <Link
                              href={action.secondaryHref}
                              className="text-xs font-semibold text-slate-500 hover:text-brand-text"
                            >
                              {action.secondaryLabel}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 text-base font-semibold text-slate-800">
              No pending employee uploads
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {filter === "all"
                ? "New employee submissions will appear here for review."
                : "Nothing matches this filter right now."}
            </p>
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink" />
          <div>
            <p className="font-semibold text-slate-800">How assignment works</p>
            <ul className="mt-2 space-y-2 leading-relaxed text-slate-500">
              <li>
                <strong className="text-slate-700">Pending review:</strong> open the
                employee profile to approve or reject.
              </li>
              <li>
                <strong className="text-slate-700">Awaiting folder:</strong> the
                upload is already submitted — create a department folder (prefilled from
                pending uploads) and the document will be assigned and approved
                automatically.
              </li>
              <li>
                <strong className="text-slate-700">Awaiting restore:</strong> the
                source folder was deleted — restore it from the recycle bin or move
                the files before permanently deleting the folder.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
