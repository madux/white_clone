"use client";

import { Download, FolderInput, Pencil, Share2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { DocDocument } from "../../../lib/types";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import DocumentVersionsFooter from "./DocumentVersionsFooter";
import SectionTabs from "./SectionTabs";
import SlideOver from "./SlideOver";
import DocumentShortcutNotice from "./DocumentShortcutNotice";
import { isOrgDocumentLinkedToPolicy } from "../../../lib/policyDocumentName";

type AccessUser = { id: number; name: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 && index > 0 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}

function statusLabel(document?: DocDocument) {
  if (!document) return "Active";
  if (document.link_status === "broken") return "Broken link";
  if (document.active === false) return "Inactive";
  if (document.distribution_status === "archived") return "Archived";
  if (document.approval_state === "pending") return "Pending approval";
  return "Active";
}

export default function DocumentDetailsPanel({
  documentId,
  documentName,
  document,
  organizational = false,
  onClose,
  onDownload,
  onShare,
  onRename,
  onMove,
  onDelete,
  onManageAccess,
  activityRefreshKey = 0,
}: {
  documentId: number;
  documentName: string;
  document?: DocDocument | null;
  organizational?: boolean;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onDelete: () => void;
  onManageAccess?: () => void;
  activityRefreshKey?: number;
}) {
  const [tab, setTab] = useState<"details" | "activity" | "versions">("details");
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (tab !== "activity" || !organizational) return;
    setAuditLoading(true);
    void api
      .organizationalObjectAudit({
        res_model: "doc.document",
        res_id: documentId,
      })
      .then((result) => setAuditRows(result.data?.items ?? []))
      .finally(() => setAuditLoading(false));
  }, [documentId, organizational, tab, activityRefreshKey]);

  const accessUsers: AccessUser[] =
    document?.access_users ??
    (document?.owner_name
      ? [{ id: Number(document.owner_id || 0), name: document.owner_name }]
      : []);
  const accessCount = document?.access_user_count ?? accessUsers.length;

  return (
    <SlideOver title={documentName} onClose={onClose}>
      <div className="px-5 pt-4">
        <SectionTabs
          items={[
            { id: "details", label: "Details" },
            { id: "activity", label: "Activity" },
            { id: "versions", label: "Versions" },
          ]}
          value={tab}
          onChange={setTab}
          level="nested"
          stretch
          ariaLabel="Document detail sections"
        />
      </div>
      {tab === "details" ? (
        <div className="space-y-5 px-5 py-5">
          {document?.is_shortcut ? (
            <DocumentShortcutNotice
              shortcutOfId={document.shortcut_of_id}
              shortcutOfName={document.shortcut_of_name}
              shortcutOfFolderId={document.shortcut_of_folder_id}
            />
          ) : null}
          <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-3 text-sm">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-slate-900">{statusLabel(document ?? undefined)}</dd>
            <dt className="text-slate-500">Owner</dt>
            <dd className="font-medium text-slate-900">
              {document?.owner_name || "—"}
            </dd>
            <dt className="text-slate-500">Uploaded</dt>
            <dd className="font-medium text-slate-900">
              {formatDocumentDate(document?.created_at)}
            </dd>
            <dt className="text-slate-500">Last modified</dt>
            <dd className="font-medium text-slate-900">
              {formatDocumentDate(document?.write_date)}
            </dd>
            <dt className="text-slate-500">Size</dt>
            <dd className="font-medium text-slate-900">
              {formatBytes(document?.file_size)}
            </dd>
            <dt className="text-slate-500">Doc ID</dt>
            <dd className="font-medium text-slate-900">{documentId}</dd>
            {organizational && document?.organizational_policy_id ? (
              <>
                <dt className="text-slate-500">Policy</dt>
                <dd>
                  <Link
                    href={`/pages/organization/folder?folder=${document.folder_id}`}
                    className="font-medium text-brand-pink hover:underline"
                  >
                    {document.organizational_policy_name || "Open policy folder"}
                  </Link>
                </dd>
              </>
            ) : organizational &&
              document &&
              isOrgDocumentLinkedToPolicy(document) ? (
              <>
                <dt className="text-slate-500">Policy</dt>
                <dd className="text-sm text-slate-600">Organizational policy document</dd>
              </>
            ) : null}
          </dl>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center -space-x-1.5">
              {accessUsers.slice(0, 3).map((user) => (
                <span
                  key={user.id || user.name}
                  title={user.name}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-[10px] font-bold text-white"
                >
                  {initials(user.name)}
                </span>
              ))}
              {accessCount > 3 ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-600">
                  +{accessCount - 3}
                </span>
              ) : null}
              {!accessUsers.length ? (
                <span className="text-sm text-slate-500">No named users</span>
              ) : null}
            </div>
            {onManageAccess ? (
              <button
                type="button"
                onClick={onManageAccess}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-pink hover:underline"
              >
                <Users className="h-4 w-4" />
                Manage access
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onDownload} className="secondary-button inline-flex items-center gap-1.5">
              <Download className="h-4 w-4" />
              Download
            </button>
            <button type="button" onClick={onShare} className="secondary-button inline-flex items-center gap-1.5">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            {onRename ? (
              <button type="button" onClick={onRename} className="secondary-button inline-flex items-center gap-1.5">
                <Pencil className="h-4 w-4" />
                Rename
              </button>
            ) : null}
            {onMove ? (
              <button type="button" onClick={onMove} className="secondary-button inline-flex items-center gap-1.5">
                <FolderInput className="h-4 w-4" />
                Move
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDelete}
              className="secondary-button inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      ) : null}
      {tab === "activity" ? (
        <div className="px-5 py-5">
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
      {tab === "versions" ? (
        <DocumentVersionsFooter
          documentId={documentId}
          currentVersionNumber={document?.current_version_number}
        />
      ) : null}
    </SlideOver>
  );
}
