"use client";

import {
  ChevronDown,
  Download,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  usePatchTemplate,
  useTemplateCategories,
  useTemplatesLibrary,
} from "../../../../hooks/useTemplatesForms";
import { templatesFormsApi, type TemplateItem } from "../../../../lib/templates-forms-api";
import AssignWizard from "./AssignWizard";
import CreateTemplateDialog from "./CreateTemplateDialog";

const SORTS = [
  { id: "name", label: "Name" },
  { id: "modified", label: "Last Modified" },
  { id: "uploaded", label: "Date Uploaded" },
];

const CARD_TONES = [
  "bg-[#eef1f6]",
  "bg-[#fde8ef]",
  "bg-[#e8eefc]",
  "bg-[#f8efc8]",
  "bg-[#d8f3fb]",
  "bg-[#f3e8ff]",
  "bg-[#e7edff]",
  "bg-[#e6f0ff]",
];

function formatSize(size: number) {
  if (!size) return "0";
  if (size < 1024) return String(size);
  if (size < 1024 * 1024) return String(Math.round(size / 1024));
  return String(Math.round(size / (1024 * 1024)));
}

export default function TemplatesFormsLibrary() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "forms" ? "form" : "template";
  const qParam = params.get("q") || "";
  const sort = params.get("sort") || "name";
  const dir = params.get("dir") || "asc";
  const favourite = params.get("favourite") === "1";
  const recent = params.get("recent") === "1";
  const categoryIds = (params.get("category") || "")
    .split(",")
    .map((item) => Number(item))
    .filter(Boolean);
  const [search, setSearch] = useState(qParam);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createKind, setCreateKind] = useState<"template" | "form">("template");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [assigning, setAssigning] = useState<TemplateItem | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busyError, setBusyError] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function setQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    router.replace(`?${next.toString()}`);
  }

  const query = {
    kind: tab as "template" | "form",
    q: qParam,
    sort,
    dir,
    favourite,
    recent,
    category_ids: categoryIds,
  };
  const library = useTemplatesLibrary(query);
  const categories = useTemplateCategories();
  const patch = usePatchTemplate();
  const items = library.data?.items || [];
  const counts = library.data?.counts || { templates: 0, forms: 0 };

  function toggleSort(id: string) {
    if (sort === id) setQuery({ dir: dir === "asc" ? "desc" : "asc" });
    else setQuery({ sort: id, dir: "asc" });
  }

  function openEditor(item: TemplateItem) {
    const kind = item.kind === "form" ? "form" : "template";
    router.push(
      `/pages/organization/templates-forms/generate/?template=${item.id}&kind=${kind}`,
    );
  }

  async function exportNow(format: "csv" | "html" | "email" | "print") {
    const data = await templatesFormsApi.exportLibrary({
      ...query,
      format,
      email: format === "email" ? email : undefined,
    });
    if (format === "csv") {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "templates-forms.csv";
      link.click();
    } else {
      const popup = window.open("", "_blank");
      if (popup) {
        popup.document.write(data.html);
        if (format === "print") popup.print();
      }
    }
    setExportOpen(false);
  }

  const visibleCategories = (categories.data || []).filter(
    (item) => item.applies_to === "both" || item.applies_to === tab,
  );

  return (
    <div className="mx-auto max-w-[1650px] space-y-4 p-6 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
          />
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            aria-expanded={showFilters}
            aria-controls="template-filters"
            onClick={() => setShowFilters((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
          <div className="relative">
            <div className="flex overflow-hidden rounded-full bg-[#e83e8c] text-white shadow-lg shadow-pink-200">
              <button
                type="button"
                onClick={() => {
                  setCreateKind("template");
                  setShowCreate(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
              >
                <FilePlus2 className="h-4 w-4" />
                Add Template
              </button>
              <button
                type="button"
                aria-label="More create options"
                aria-expanded={showAddMenu}
                onClick={() => setShowAddMenu((current) => !current)}
                className="border-l border-white/25 px-2.5"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {showAddMenu && (
              <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-slate-100 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-pink-50"
                  onClick={() => {
                    setCreateKind("template");
                    setShowAddMenu(false);
                    setShowCreate(true);
                  }}
                >
                  Add Template
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-pink-50"
                  onClick={() => {
                    setCreateKind("form");
                    setShowAddMenu(false);
                    setShowCreate(true);
                  }}
                >
                  Add Form
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showFilters && (
        <div id="template-filters" className="flex flex-wrap gap-3 rounded-2xl border border-slate-100 bg-white p-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recent} onChange={() => setQuery({ recent: recent ? null : "1" })} />
            Recently Opened
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={favourite} onChange={() => setQuery({ favourite: favourite ? null : "1" })} />
            Favourites Only
          </label>
          {visibleCategories.map((item) => {
            const checked = categoryIds.includes(item.id);
            return (
              <label key={item.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? categoryIds.filter((id) => id !== item.id)
                      : [...categoryIds, item.id];
                    setQuery({ category: next.join(",") || null });
                  }}
                />
                {item.name}
              </label>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          aria-pressed={tab === "template"}
          onClick={() => setQuery({ tab: "templates" })}
          className={`inline-flex items-center gap-2 border-b-2 pb-2 text-sm font-semibold ${
            tab === "template" ? "border-brand-pink text-slate-800" : "border-transparent text-slate-400"
          }`}
        >
          <FileText className="h-4 w-4 text-brand-pink" />
          Templates
          <span className="rounded-full bg-[#e83e8c] px-2 py-0.5 text-[11px] font-bold text-white">
            {counts.templates}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={tab === "form"}
          onClick={() => setQuery({ tab: "forms" })}
          className={`inline-flex items-center gap-2 border-b-2 pb-2 text-sm font-semibold ${
            tab === "form" ? "border-brand-pink text-slate-800" : "border-transparent text-slate-400"
          }`}
        >
          Forms
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {counts.forms}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        {SORTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggleSort(item.id)}
            className={sort === item.id ? "font-semibold text-brand-pink" : "text-slate-400"}
          >
            {item.label}
            {sort === item.id ? (dir === "asc" ? " ↑" : " ↓") : " ↕"}
          </button>
        ))}
      </div>

      {busyError && <p className="text-sm text-red-600">{busyError}</p>}
      {library.isLoading && <p className="py-16 text-center text-sm text-slate-400">Loading library…</p>}
      {library.isError && (
        <div className="py-16 text-center">
          <p className="font-semibold text-slate-700">Could not load templates</p>
          <button type="button" className="mt-2 text-sm font-semibold text-brand-pink" onClick={() => library.refetch()}>
            Retry
          </button>
        </div>
      )}
      {!library.isLoading && !items.length && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="font-semibold text-slate-700">
            {qParam || favourite || recent || categoryIds.length
              ? "No templates or forms match"
              : tab === "form"
                ? "No forms yet"
                : "No templates yet"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {qParam ? "Clear search to restore the complete result set." : "Add a template or form to get started."}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
          >
            <div className={`relative h-28 ${CARD_TONES[index % CARD_TONES.length]}`}>
              <span className="absolute inset-0 flex items-center justify-center text-5xl" aria-hidden>
                {item.icon}
              </span>
              <button
                type="button"
                aria-label={item.favourite ? "Remove favourite" : "Add favourite"}
                onClick={() => patch.mutate({ id: item.id, payload: { action: "favourite" } })}
                className="absolute right-3 top-3 rounded-full bg-white/80 p-1.5"
              >
                <Star className={`h-4 w-4 ${item.favourite ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
              </button>
            </div>
            <div className="p-4">
              {renaming === item.id ? (
                <input
                  defaultValue={item.name}
                  aria-label="Template name"
                  className="field"
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== item.name) patch.mutate({ id: item.id, payload: { name } });
                    setRenaming(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                  }}
                  autoFocus
                />
              ) : (
                <h2
                  className="text-[15px] font-bold text-slate-900"
                  onDoubleClick={() => setRenaming(item.id)}
                >
                  {item.name}
                </h2>
              )}
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-400">
                {item.description || "No description"}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {formatSize(item.file_size)}
                </span>
                <span className="rounded-full bg-fuchsia-50 px-2.5 py-0.5 font-semibold text-fuchsia-500">
                  {item.kind}
                </span>
              </div>
              {item.status === "failed" && (
                <button
                  type="button"
                  className="mt-2 text-left text-xs font-semibold text-amber-700"
                  onClick={() => patch.mutate({ id: item.id, payload: { action: "retry" } })}
                >
                  Processing failed. Retry
                </button>
              )}
              <div className="mt-4 flex items-center gap-2">
                {item.kind === "template" ? (
                  <>
                    <button
                      type="button"
                      disabled={item.status === "failed"}
                      onClick={() => openEditor(item)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#e83e8c] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate
                    </button>
                    <button
                      type="button"
                      disabled={item.status === "failed"}
                      onClick={() => setAssigning(item)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-500 disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Assign
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={item.status === "failed"}
                    onClick={() => openEditor(item)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#e83e8c] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Fill Form
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`More actions for ${item.name}`}
                  onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                  className="ml-auto rounded-lg p-1.5 text-slate-400"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              {menuId === item.id && (
                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-2 text-sm">
                  <button type="button" className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white" onClick={() => setRenaming(item.id)}>
                    Edit name
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white"
                    onClick={() => patch.mutate({ id: item.id, payload: { action: "archive" } })}
                  >
                    Archive
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {showCreate && (
        <CreateTemplateDialog
          initialKind={createKind}
          onClose={() => setShowCreate(false)}
        />
      )}
      {assigning && <AssignWizard template={assigning} onClose={() => setAssigning(null)} />}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 id="export-title" className="text-lg font-semibold">Export</h2>
            <p className="mt-1 text-sm text-slate-400">Uses the current tab, search, filters, and sort.</p>
            <input className="field mt-4" placeholder="Email for sharing" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Share via email" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-full border px-3 py-2 text-sm font-semibold" onClick={() => exportNow("csv")}>Download as CSV</button>
              <button type="button" className="rounded-full border px-3 py-2 text-sm font-semibold" onClick={() => exportNow("html")}>Download as PDF</button>
              <button type="button" className="rounded-full border px-3 py-2 text-sm font-semibold" onClick={() => exportNow("email")} disabled={!email}>Share via Email</button>
              <button type="button" className="rounded-full border px-3 py-2 text-sm font-semibold" onClick={() => exportNow("print")}>Print</button>
            </div>
            <button type="button" className="mt-4 text-sm text-slate-500" onClick={() => setExportOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
