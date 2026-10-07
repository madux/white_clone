"use client";

import { AlertCircle, Clock3, ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useApprovalInbox,
  usePendingEmployeeUploads,
} from "../../../hooks/useDocuments";
import type { PendingEmployeeUpload } from "../../../lib/types";
import { approvalInboxHref } from "../../../lib/documentLinks";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import EmptyState from "./EmptyState";
import PersonCell from "./PersonCell";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";
import { FileTypeIcon } from "./FileTypeIcon";

function ApprovalDocumentIcon({
  name,
  document_type,
  mime_type,
  source_url,
}: {
  name: string;
  document_type?: string;
  mime_type?: string;
  source_url?: string;
}) {
  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full">
      <FileTypeIcon
        name={name}
        document_type={document_type}
        mime_type={mime_type}
        source_url={source_url}
      />
    </span>
  );
}

const statusMeta = {
  pending_review: {
    label: "Pending review",
    className: "bg-amber-50 text-amber-700",
    icon: Clock3,
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
      href: myWorkspaceHref("recycle"),
      label: "Manage in recycle bin",
      hint: "Restore the folder or move files before permanent delete",
    };
  }
  return {
    href: `/pages/employee/profile?employee=${item.employee_id}&doc=${item.id}`,
    label: "Review",
    hint: "Open the employee file to continue",
  };
}

export default function EmployeeFilesPendingApprovalsPanel({
  excludeDocumentIds,
}: {
  excludeDocumentIds?: Set<number>;
} = {}) {
  const uploads = usePendingEmployeeUploads(true);
  const approvalInbox = useApprovalInbox(true);
  const [filter, setFilter] = useState<
    "all" | "pending_review" | "awaiting_folder_restore"
  >("all");

  const uploadItems = uploads.data?.items ?? [];
  const inboxItems = (approvalInbox.data?.items ?? []).filter(
    (item) =>
      item.folder_type !== "organizational" &&
      !(excludeDocumentIds?.has(item.document_id) ?? false),
  );
  const inboxDocumentIds = new Set(inboxItems.map((item) => item.document_id));

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
      all: rows.length + inboxItems.length,
      pending_review:
        rows.filter((item) => item.status === "pending_review").length +
        inboxItems.length,
      awaiting_folder_restore: rows.filter(
        (item) => item.status === "awaiting_folder_restore",
      ).length,
    };
  }, [uploadItems, inboxItems.length, inboxDocumentIds]);

  const showInbox =
    filter === "all" || filter === "pending_review" ? inboxItems : [];

  return (
    <div className="space-y-6">
      <SectionTabs
        level="nested"
        ariaLabel="Pending approval filters"
        value={filter}
        onChange={(value) =>
          setFilter(
            value as "all" | "pending_review" | "awaiting_folder_restore",
          )
        }
        items={[
          { id: "all", label: "All", count: counts.all },
          { id: "pending_review", label: "Pending approval", count: counts.pending_review },
          {
            id: "awaiting_folder_restore",
            label: "Awaiting restore",
            count: counts.awaiting_folder_restore,
          },
        ]}
      />

      <section className="app-page-body ef-table">
        {uploads.isLoading || approvalInbox.isLoading ? (
          <EmptyState title="Loading pending approvals…" loading />
        ) : showInbox.length || items.length ? (
          <div className="overflow-x-auto">
            <table className="dms-table ef-table min-w-full">
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
                        <ApprovalDocumentIcon
                          name={item.document}
                          document_type={item.document_type}
                          mime_type={item.mime_type}
                          source_url={item.source_url}
                        />
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
                    <td>
                      <PersonCell
                        name={item.employee || "—"}
                        subtitle={item.document_type || undefined}
                      />
                    </td>
                    <td>—</td>
                    <td>
                      <StatusPill label="Pending approval" tone="pending" />
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDate(String(item.created_at))}
                    </td>
                    <td className="dms-col-actions">
                      <Link
                        href={approvalInboxHref({
                          id: item.document_id,
                          document_id: item.document_id,
                          folder_id: item.folder_id,
                          employee_id: item.employee_id,
                          folder_type: item.folder_type,
                        })}
                        className="app-btn app-btn-primary"
                      >
                        Review
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.map((item: PendingEmployeeUpload) => {
                  const meta = statusMeta[item.status];
                  const action = actionForItem(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/30"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <ApprovalDocumentIcon
                            name={item.name}
                            document_type={item.document_type}
                            mime_type={item.mime_type}
                            source_url={item.source_url}
                          />
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
                      <td>
                        <PersonCell
                          name={item.employee_name || "—"}
                          subtitle={item.department || undefined}
                          href={
                            item.employee_id
                              ? `/pages/employee/profile?employee=${item.employee_id}`
                              : undefined
                          }
                        />
                      </td>
                      <td>{item.department || "—"}</td>
                      <td>
                        <StatusPill label={meta.label} />
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="dms-col-actions">
                        <Link
                          href={action.href}
                          className="app-btn app-btn-primary"
                          title={action.hint}
                        >
                          {action.label}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title="No pending approvals"
            description="Employee uploads and inbox items awaiting your decision will appear here."
          />
        )}
      </section>
    </div>
  );
}
