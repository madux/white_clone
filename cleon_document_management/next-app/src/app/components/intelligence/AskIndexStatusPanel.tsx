"use client";

import {
  Check,
  Clock,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useIntelligenceAskIndexStatus } from "../../../../hooks/useIntelligence";
import type { AskIndexFile, AskIndexState } from "../../../../lib/intelligence-api";

const STATE_COPY: Record<
  AskIndexState,
  { label: string; detail: string; bar: number; pill: string; barClass: string }
> = {
  indexing: {
    label: "Indexing",
    detail: "Reading and embedding",
    bar: 58,
    pill: "bg-pink-50 text-brand-pink",
    barClass: "bg-brand-pink animate-pulse motion-reduce:animate-none",
  },
  waiting: {
    label: "Waiting",
    detail: "In the queue",
    bar: 8,
    pill: "bg-slate-100 text-slate-500",
    barClass: "bg-slate-300",
  },
  indexed: {
    label: "Indexed",
    detail: "Ready for Ask",
    bar: 100,
    pill: "bg-emerald-50 text-emerald-700",
    barClass: "bg-brand-pink",
  },
  skipped: {
    label: "No text",
    detail: "Could not read this file",
    bar: 100,
    pill: "bg-amber-50 text-amber-700",
    barClass: "bg-amber-400",
  },
};

function StateIcon({ state }: { state: AskIndexState }) {
  if (state === "indexing") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }
  if (state === "indexed") {
    return <Check className="h-3.5 w-3.5" />;
  }
  if (state === "skipped") {
    return <ShieldAlert className="h-3.5 w-3.5" />;
  }
  return <Clock className="h-3.5 w-3.5" />;
}

function FileRow({ file }: { file: AskIndexFile }) {
  const copy = STATE_COPY[file.state] || STATE_COPY.waiting;
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {file.folder || "Library"}
              {file.state === "indexed" && file.chunk_count
                ? ` · ${file.chunk_count} chunk${file.chunk_count === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${copy.pill}`}
          >
            <StateIcon state={file.state} />
            {copy.label}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${copy.barClass}`}
            style={{ width: `${copy.bar}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">{copy.detail}</p>
      </div>
    </li>
  );
}

export default function AskIndexStatusPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const status = useIntelligenceAskIndexStatus(open, debounced.trim());
  const data = status.data;
  const files = data?.files || [];
  const inFlight = (data?.indexing_count || 0) + (data?.waiting_count || 0);

  const summary = useMemo(
    () => [
      { label: "Indexed", value: data?.indexed_count ?? 0 },
      { label: "Indexing", value: data?.indexing_count ?? 0 },
      { label: "Waiting", value: data?.waiting_count ?? 0 },
      { label: "No text", value: data?.skipped_count ?? 0 },
    ],
    [data],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(handle);
  }, [term]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setDebounced("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-index-title"
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-pink">
              Ask Cleon AI
            </p>
            <h2 id="ask-index-title" className="mt-1 text-lg font-bold text-slate-900">
              Indexed documents
            </h2>
            <p className="mt-1 text-[12px] text-slate-400">
              Your files and shared files Cleon AI can search.
              {inFlight
                ? " New uploads index in the background. This list refreshes automatically."
                : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close indexed documents"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          {summary.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600"
            >
              {item.label}
              <span className="text-slate-900">{item.value.toLocaleString()}</span>
            </span>
          ))}
          {data?.total_count ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] text-slate-400">
              {data.total_count.toLocaleString()} in library
            </span>
          ) : null}
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 focus-within:border-brand-pink focus-within:bg-white">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search files or folders"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {status.isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading index status…
            </div>
          ) : status.isError ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              The index status could not be loaded. Try again after restarting Odoo with
              the Document Management module updated.
            </p>
          ) : !files.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              {term.trim()
                ? "No files match that search."
                : "No files in your Ask library yet. Upload in My Workspace or open a shared folder."}
            </p>
          ) : (
            <ul>
              {files.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </ul>
          )}
        </div>

        {data?.truncated ? (
          <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
            Showing the {files.length.toLocaleString()} most recent matching files.
          </p>
        ) : null}
      </div>
    </div>
  );
}
