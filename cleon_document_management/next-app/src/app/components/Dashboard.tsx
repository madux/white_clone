"use client";

import { FolderPlus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { documentViewHref, approvalInboxHref } from "../../../lib/documentLinks";
import {
  useAdminAttention,
  useApprovalInbox,
  useDashboardStats,
  usePendingEmployeeUploads,
  useWorkspaceActivity,
} from "../../../hooks/useDocuments";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import NewMenu from "./NewMenu";
import StatusPill from "./StatusPill";
import { Button } from "@/components/ui/button";

function TableHeading({
  title,
  href,
  hrefLabel,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {href ? (
        <Button variant="link" size="sm" render={<Link href={href} />}>
          {hrefLabel || "View all"}
        </Button>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const stats = useDashboardStats();
  const approvals = useApprovalInbox();
  const pendingUploads = usePendingEmployeeUploads();
  const attention = useAdminAttention();
  const activity = useWorkspaceActivity();

  const expiring = stats.data?.expiring_items ?? [];
  const approvalItems = approvals.data?.items ?? [];
  const uploadItems = pendingUploads.data?.items ?? [];
  const attentionItems = attention.data?.notifications ?? [];
  const activityEvents = activity.data?.activity_log ?? [];

  const suggested: LibraryFileRow[] = [
    ...approvalItems.slice(0, 6).map((item) => ({
      id: `approval-${item.approval_id}`,
      kind: "file" as const,
      name: item.document,
      subtitle: item.document_type || item.message || "Waiting for review",
      href: approvalInboxHref(item),
      owner: item.employee || "—",
      ownerHref: item.employee_id
        ? `/pages/employee/profile?employee=${item.employee_id}`
        : undefined,
      modified: formatDocumentDate(item.created_at),
      status: <StatusPill label="Approval" tone="pending" />,
    })),
    ...uploadItems.slice(0, 6).map((item) => ({
      id: `upload-${item.id}`,
      kind: "file" as const,
      name: item.name,
      subtitle: item.document_type || item.department || undefined,
      href: item.employee_id
        ? `/pages/employee/profile/?employee=${item.employee_id}`
        : "/pages/approvals?kind=employee",
      owner: item.employee_name || "—",
      ownerHref: item.employee_id
        ? `/pages/employee/profile/?employee=${item.employee_id}`
        : undefined,
      status: (
        <StatusPill
          label={
            item.status === "awaiting_folder"
              ? "Awaiting folder"
              : item.status === "awaiting_folder_restore"
                ? "Awaiting restore"
                : "Employee upload"
          }
          tone="pending"
        />
      ),
    })),
    ...attentionItems.slice(0, 4).map((item) => ({
      id: `attention-${item.id}`,
      kind: "file" as const,
      name: item.document,
      subtitle: item.message,
      href: documentViewHref(
        { id: item.document_id, employee_id: item.employee_id },
        true,
      ),
      owner: item.employee || "—",
      status: <StatusPill label="Alert" tone="attention" />,
    })),
    ...expiring.slice(0, 4).map((item) => ({
      id: `expiring-${item.id}`,
      kind: "file" as const,
      name: item.name,
      subtitle: item.expiry_date || "soon",
      href: documentViewHref(item, true),
      owner: "—",
      status: <StatusPill label="Expiring" tone="attention" />,
    })),
  ];

  const recent: LibraryFileRow[] = activityEvents.slice(0, 12).map((event) => ({
    id: `${event.id}-${event.occurred_at}`,
    kind: "file" as const,
    name: event.message || event.kind,
    subtitle: event.document_name || event.folder_name || undefined,
    owner: event.actor_name || "—",
    modified: formatDocumentDate(event.occurred_at),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LibraryBreadcrumbSafe />
        <NewMenu
          items={[
            {
              label: "Folder",
              icon: FolderPlus,
              onSelect: () => router.push("/pages/organization?create=1"),
            },
            {
              label: "File upload",
              icon: Upload,
              onSelect: () =>
                router.push(myWorkspaceHref("documents", { upload: "1" })),
            },
          ]}
        />
      </div>

      {stats.isError ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Some home data could not be loaded.
        </p>
      ) : null}

      <div>
        <TableHeading
          title="Suggested"
          href="/pages/approvals?kind=employee"
          hrefLabel="Open queue"
        />
        <div className="app-page-body">
          <LibraryFileTable
            rows={suggested}
            loading={
              approvals.isLoading || pendingUploads.isLoading || attention.isLoading
            }
            showStatus
            showModified={false}
            emptyTitle="Nothing waiting"
            emptyDescription="Approvals, uploads, and expiries will show up here."
          />
        </div>
      </div>

      <div>
        <TableHeading title="Recent" href="/pages/dashboard/?tab=activity" />
        <div className="app-page-body">
          <LibraryFileTable
            rows={recent}
            loading={activity.isLoading}
            emptyTitle="No recent activity"
            emptyDescription="Workspace events will appear here as people upload and approve files."
          />
        </div>
      </div>
    </div>
  );
}

function LibraryBreadcrumbSafe() {
  return (
    <div>
      <h1 className="text-lg font-semibold">Home</h1>
      <p className="text-sm text-muted-foreground">Suggested files and recent activity</p>
    </div>
  );
}
