"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import { formatFieldLabel } from "../../../lib/formatLabel";
import {
  directFolderItemCount,
  folderKindLabel,
  folderLocationPath,
} from "../../../lib/organizationalFolderDetails";
import type { DocFolder } from "../../../lib/types";
import { useFolders } from "../../../hooks/useDocuments";
import {
  approvalFlowLabel,
  type ApprovalFlow,
} from "./FolderApprovalFields";
import SectionTabs from "./SectionTabs";
import SlideOver from "./SlideOver";

function folderStatusLabel(folder?: DocFolder | null, locked?: boolean) {
  if (locked || folder?.locked || folder?.is_locked) return "Locked";
  if (folder?.active === false || folder?.distribution_status === "archived") {
    return "Archived";
  }
  return "Active";
}

export default function FolderDetailsPanel({
  folderId,
  folderName,
  folderType = "organizational",
  description = "",
  locked = false,
  accessScope = "",
  collectionCode,
  folderKind,
  organizeBy,
  ownerName,
  lastModified,
  requireUploadApproval,
  approvalFlow,
  retentionPeriod,
  acknowledgementPercent,
  acknowledgementPending,
  onClose,
}: {
  folderId: number;
  folderName: string;
  folderType?: string;
  description?: string;
  locked?: boolean;
  accessScope?: string;
  collectionCode?: string;
  folderKind?: DocFolder["folder_kind"];
  organizeBy?: string;
  ownerName?: string;
  lastModified?: string;
  requireUploadApproval?: boolean;
  approvalFlow?: string;
  retentionPeriod?: string;
  acknowledgementPercent?: number | null;
  acknowledgementPending?: number;
  onClose: () => void;
}) {
  const folders = useFolders();
  const [tab, setTab] = useState<"details" | "activity">("details");
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const record = useMemo(
    () => folders.data?.find((item) => item.id === folderId),
    [folderId, folders.data],
  );

  const merged = useMemo(
    () => ({
      ...record,
      folder_name: folderName,
      description: description || record?.description || "",
      access_scope: accessScope || record?.access_scope || "",
      collection_code: collectionCode || record?.collection_code,
      folder_kind: folderKind || record?.folder_kind,
      organize_by: organizeBy || record?.organize_by,
      owner_name: ownerName || record?.owner_name,
      last_modified: lastModified || record?.last_modified,
      require_upload_approval:
        requireUploadApproval ?? record?.require_upload_approval,
      approval_flow: approvalFlow || record?.approval_flow,
      retention_period: retentionPeriod || record?.retention_period,
    }),
    [
      accessScope,
      approvalFlow,
      collectionCode,
      description,
      folderKind,
      folderName,
      lastModified,
      organizeBy,
      ownerName,
      record,
      requireUploadApproval,
      retentionPeriod,
    ],
  );

  const organizational = folderType === "organizational";
  const rootLabel = organizational ? "Organizational Files" : "Employee Files";
  const location = useMemo(
    () =>
      folders.data?.length
        ? folderLocationPath(folderId, folders.data, rootLabel)
        : rootLabel,
    [folderId, folders.data, rootLabel],
  );
  const itemCount = useMemo(
    () =>
      folders.data?.length
        ? directFolderItemCount(folderId, folders.data)
        : record?.document_count ?? 0,
    [folderId, folders.data, record?.document_count],
  );

  useEffect(() => {
    if (tab !== "activity" || !organizational) return;
    setAuditLoading(true);
    void api
      .organizationalObjectAudit({
        res_model: "doc.folder",
        res_id: folderId,
      })
      .then((result) => setAuditRows(result.data?.items ?? []))
      .finally(() => setAuditLoading(false));
  }, [folderId, organizational, tab]);

  return (
    <SlideOver title={folderName} onClose={onClose}>
      <div className="px-5 pt-3">
        <SectionTabs
          items={[
            { id: "details", label: "Details" },
            ...(organizational ? [{ id: "activity" as const, label: "Activity" }] : []),
          ]}
          value={tab}
          onChange={setTab}
          level="nested"
          stretch
          ariaLabel="Folder detail sections"
        />
      </div>
      {tab === "details" ? (
        <div className="px-5 py-4">
          <dl className="grid grid-cols-[6.25rem_1fr] gap-x-2 gap-y-2 text-xs leading-snug">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-slate-900">
              {folderStatusLabel(record, locked)}
            </dd>
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium text-slate-900">
              {folderKindLabel(merged.folder_kind)}
            </dd>
            {merged.collection_code ? (
              <>
                <dt className="text-slate-500">Collection</dt>
                <dd className="font-medium text-slate-900">
                  {merged.collection_code}
                </dd>
              </>
            ) : null}
            <dt className="text-slate-500">Owner</dt>
            <dd className="truncate font-medium text-slate-900">
              {merged.owner_name || "—"}
            </dd>
            <dt className="text-slate-500">Location</dt>
            <dd
              className="line-clamp-2 font-medium text-slate-900"
              title={location}
            >
              {location}
            </dd>
            <dt className="text-slate-500">Items</dt>
            <dd className="font-medium text-slate-900">{itemCount}</dd>
            {organizational && merged.access_scope ? (
              <>
                <dt className="text-slate-500">Access</dt>
                <dd className="font-medium text-slate-900">
                  {formatFieldLabel(merged.access_scope)}
                </dd>
              </>
            ) : null}
            {organizational && merged.require_upload_approval ? (
              <>
                <dt className="text-slate-500">Approval</dt>
                <dd className="font-medium text-slate-900">
                  Required ·{" "}
                  {approvalFlowLabel(
                    (merged.approval_flow || "any") as ApprovalFlow,
                  )}
                </dd>
              </>
            ) : null}
            {organizational && merged.retention_period ? (
              <>
                <dt className="text-slate-500">Retention</dt>
                <dd className="font-medium text-slate-900">
                  {merged.retention_period === "permanent"
                    ? "Permanent"
                    : `${merged.retention_period} years`}
                </dd>
              </>
            ) : null}
            {organizational &&
            merged.organize_by &&
            merged.organize_by !== "none" ? (
              <>
                <dt className="text-slate-500">Organize by</dt>
                <dd className="font-medium text-slate-900">
                  {formatFieldLabel(merged.organize_by)}
                </dd>
              </>
            ) : null}
            {acknowledgementPercent != null ? (
              <>
                <dt className="text-slate-500">Acknowledgement</dt>
                <dd className="font-medium text-slate-900">
                  {acknowledgementPercent}%
                  {acknowledgementPending
                    ? ` · ${acknowledgementPending} pending`
                    : ""}
                </dd>
              </>
            ) : null}
            <dt className="text-slate-500">Modified</dt>
            <dd className="font-medium text-slate-900">
              {formatDocumentDate(merged.last_modified)}
            </dd>
            <dt className="text-slate-500">Folder ID</dt>
            <dd className="font-medium text-slate-900">{folderId}</dd>
            {merged.description ? (
              <>
                <dt className="text-slate-500">Description</dt>
                <dd
                  className="line-clamp-4 font-medium text-slate-900"
                  title={merged.description}
                >
                  {merged.description}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
      {tab === "activity" ? (
        <div className="max-h-[min(50vh,20rem)] overflow-y-auto px-5 py-4">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              className="text-xs font-semibold text-brand-pink hover:underline"
              onClick={() => {
                void api
                  .organizationalAuditExport({
                    res_model: "doc.folder",
                    res_id: folderId,
                    include_approvals: true,
                  })
                  .then((result) => {
                    if (!result.success || !result.data) return;
                    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `org-folder-audit-${folderId}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  });
              }}
            >
              Export audit bundle
            </button>
          </div>
          {auditLoading ? (
            <p className="text-sm text-slate-500">Loading activity…</p>
          ) : auditRows.length ? (
            <ul className="space-y-3 text-sm">
              {auditRows.map((row) => (
                <li key={row.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <p className="font-medium text-slate-900">{row.summary}</p>
                  <p className="text-xs text-slate-500">
                    {row.actor_name} · {row.occurred_at}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No activity yet.</p>
          )}
        </div>
      ) : null}
    </SlideOver>
  );
}
