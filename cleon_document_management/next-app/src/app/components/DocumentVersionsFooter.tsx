"use client";

import { ExternalLink, History } from "lucide-react";
import { useDocumentVersions } from "../../../hooks/useDocuments";

export default function DocumentVersionsFooter({
  documentId,
}: {
  documentId: number;
}) {
  const versions = useDocumentVersions(documentId);
  const baseUrl = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");

  if (versions.isLoading) {
    return (
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        Loading versions…
      </div>
    );
  }

  const items = versions.data?.data ?? [];
  const count = versions.data?.count ?? items.length;

  if (!count) return null;

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        <History className="h-3.5 w-3.5" />
        Versions ({count})
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((version) => (
          <li
            key={version.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
          >
            <span className="min-w-0 font-semibold text-slate-700">
              v{version.version_number}
              {version.change_note ? ` · ${version.change_note}` : ""}
              <span className="mt-0.5 block font-normal text-slate-400">
                {version.uploaded_by} ·{" "}
                {version.upload_date?.slice(0, 16).replace("T", " ")}
              </span>
            </span>
            {baseUrl ? (
              <a
                href={`${baseUrl}/document-management/document/version/${version.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-brand-pink hover:text-brand-pink"
              >
                Open
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
