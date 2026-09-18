"use client";

import { History } from "lucide-react";
import { useDocumentVersions } from "../../../hooks/useDocuments";
import { documentVersionPreviewUrl } from "../../../lib/documentPreviewUrls";

export default function DocumentVersionsFooter({
  documentId,
  currentVersionNumber,
  activeVersionId = null,
  onViewVersion,
  onViewCurrent,
}: {
  documentId: number;
  currentVersionNumber?: number;
  activeVersionId?: number | null;
  onViewVersion?: (versionId: number) => void;
  onViewCurrent?: () => void;
}) {
  const versions = useDocumentVersions(documentId);

  if (versions.isLoading) {
    return (
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        Loading versions…
      </div>
    );
  }

  const items = versions.data?.data ?? [];
  const count = versions.data?.count ?? items.length;

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          <History className="h-3.5 w-3.5" />
          Version history
          {count > 0 ? ` · ${count} previous` : ""}
        </div>
        {onViewCurrent && activeVersionId != null ? (
          <button
            type="button"
            onClick={onViewCurrent}
            className="text-xs font-semibold text-brand-pink hover:underline"
          >
            Back to current file
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Older files stay available to read. They are labeled out of date, not
        removed.
      </p>
      <ul className="mt-2 space-y-1.5">
        <li
          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs ${
            activeVersionId == null
              ? "bg-emerald-50 ring-1 ring-emerald-100"
              : "bg-white ring-1 ring-slate-100"
          }`}
        >
          <span className="min-w-0 font-semibold text-slate-800">
            v{currentVersionNumber ?? items.length + 1}
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Current
            </span>
            <span className="mt-0.5 block font-normal text-slate-500">
              Active file on record
            </span>
          </span>
          {activeVersionId != null && onViewCurrent ? (
            <button
              type="button"
              onClick={onViewCurrent}
              className="shrink-0 rounded-full border border-brand-pink/30 px-2.5 py-1 text-[11px] font-semibold text-brand-pink hover:bg-pink-50"
            >
              View
            </button>
          ) : null}
        </li>
        {items.map((version) => {
          const isActive = activeVersionId === version.id;
          return (
            <li
              key={version.id}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs ${
                isActive ? "bg-pink-50 ring-1 ring-pink-100" : "bg-slate-50"
              }`}
            >
              <span className="min-w-0 font-semibold text-slate-700">
                v{version.version_number}
                <span className="ml-2 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  Out of date
                </span>
                {version.change_note ? ` · ${version.change_note}` : ""}
                <span className="mt-0.5 block font-normal text-slate-400">
                  {version.uploaded_by} ·{" "}
                  {version.upload_date?.slice(0, 16).replace("T", " ")}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {onViewVersion ? (
                  <button
                    type="button"
                    onClick={() => onViewVersion(version.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      isActive
                        ? "border-brand-pink bg-white text-brand-pink"
                        : "border-slate-200 text-slate-600 hover:border-brand-pink hover:text-brand-pink"
                    }`}
                  >
                    {isActive ? "Reading" : "Read"}
                  </button>
                ) : null}
                <a
                  href={documentVersionPreviewUrl(version.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-brand-pink hover:text-brand-pink"
                >
                  Open tab
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
