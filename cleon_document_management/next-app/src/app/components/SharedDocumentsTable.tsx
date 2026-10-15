"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { useMemo } from "react";
import type { DocDocument } from "../../../lib/types";
import { formatDocumentFileSize } from "../../../lib/collectionSuggestedFileMatch";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import EmptyState from "./EmptyState";
import { FileTypeIcon } from "./FileTypeIcon";
import SortableTable from "./SortableTable";
import { folderColorHex } from "../../../lib/folderColor";

type SharedAckFilter = "all" | "needs_ack";

const AVATAR_TONES = [
  "bg-violet-500 text-white",
  "bg-teal-500 text-white",
  "bg-sky-500 text-white",
  "bg-rose-500 text-white",
  "bg-indigo-500 text-white",
  "bg-emerald-600 text-white",
];

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarToneClass(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash];
}

function sharedDocumentDueLabel(document: DocDocument): string | null {
  if (document.acknowledged) {
    return null;
  }
  if (document.has_expiry && document.expiry_date) {
    const formatted = formatDocumentDateShort(document.expiry_date, "");
    return formatted ? `Due: ${formatted}` : null;
  }
  return null;
}

function filterSharedRows(
  documents: DocDocument[],
  search: string,
  sharedAckFilter: SharedAckFilter,
) {
  const query = search.trim().toLowerCase();
  return documents.filter((document) => {
    if (sharedAckFilter === "needs_ack" && document.acknowledged) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${document.name} ${document.document_type} ${document.folder_name}`
      .toLowerCase()
      .includes(query);
  });
}

export default function SharedDocumentsTable({
  documents,
  search,
  sharedAckFilter = "all",
  onView,
}: {
  documents: DocDocument[];
  search: string;
  sharedAckFilter?: SharedAckFilter;
  onView: (document: DocDocument) => void;
}) {
  const rows = useMemo(
    () => filterSharedRows(documents, search, sharedAckFilter),
    [documents, search, sharedAckFilter],
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="dms-table-wrap">
        <SortableTable className="shared-documents-table w-full min-w-[980px]">
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>Status</th>
              <th>Shared by</th>
              <th className="shared-documents-col-date">Date Added</th>
              <th className="dms-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((document) => {
              const sharedBy =
                document.shared_by || document.owner_name || "Document administrator";
              const sharedBySubtitle = document.shared_by_subtitle || "";
              const ackStatusLabel = document.acknowledged
                ? "Acknowledged"
                : "Needs acknowledgement";
              const dateAdded = formatDocumentDateShort(
                document.created_at,
                "—",
              );
              const dueLabel = sharedDocumentDueLabel(document);
              const folderColor = folderColorHex(document.folder_color_hex);

              return (
                <tr
                  key={document.id}
                  className="transition hover:bg-pink-50/40"
                >
                  <td className="shared-documents-col-document !h-auto py-3">
                    <button
                      type="button"
                      onClick={() => onView(document)}
                      className="flex w-full min-w-0 items-start gap-3 text-left"
                    >
                      <FileTypeIcon
                        name={document.name}
                        mime_type={document.mime_type}
                        document_type={document.document_type}
                        source_url={document.source_url}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="truncate text-sm font-semibold text-slate-900 hover:text-brand-pink">
                          {document.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            {folderColor ? (
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: folderColor }}
                                aria-hidden
                              />
                            ) : null}
                            <span>{document.folder_name || "Shared library"}</span>
                          </span>
                          <span className="text-slate-300" aria-hidden>
                            ·
                          </span>
                          <span className="tabular-nums">
                            {formatDocumentFileSize(document.file_size)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="text-sm text-slate-700">
                    {document.document_type || "—"}
                  </td>
                  <td data-sort-value={ackStatusLabel}>
                    {document.acknowledged ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100"
                      >
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-emerald-600"
                          aria-hidden
                        />
                        {ackStatusLabel}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-100"
                      >
                        <Clock3
                          className="h-3.5 w-3.5 text-amber-700"
                          aria-hidden
                        />
                        {ackStatusLabel}
                      </span>
                    )}
                  </td>
                  <td className="shared-documents-col-person !h-auto py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar size="sm" className="after:border-0">
                        <AvatarFallback
                          className={`text-[10px] font-bold ${avatarToneClass(sharedBy)}`}
                        >
                          {initialsFromName(sharedBy)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {sharedBy}
                        </span>
                        {sharedBySubtitle ? (
                          <span className="block truncate text-xs text-slate-500">
                            {sharedBySubtitle}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td
                    className="shared-documents-col-date !h-auto py-3 text-right"
                    data-sort-value={document.created_at || ""}
                  >
                    <span className="block text-sm text-slate-700 tabular-nums">
                      {dateAdded}
                    </span>
                    {dueLabel ? (
                      <span className="mt-0.5 block text-xs font-medium text-rose-500 tabular-nums">
                        {dueLabel}
                      </span>
                    ) : null}
                  </td>
                  <td className="dms-col-actions">
                    <button
                      type="button"
                      onClick={() => onView(document)}
                      className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-brand-pink hover:text-brand-pink"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </SortableTable>
      </div>
      {!rows.length ? (
        <EmptyState
          title="No shared documents"
          description="Documents shared with you from the organizational library will appear here."
        />
      ) : null}
    </div>
  );
}
