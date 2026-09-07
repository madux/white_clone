"use client";

import { Archive, CheckCircle2, Folder, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDocumentAction, useDocumentLifecycle, useFolderAction, useFolderLifecycle } from "../../../hooks/useDocuments";

export default function DocumentLifecyclePage({ lifecycle }: { lifecycle: "archived" | "recycle_bin" }) {
  const documents = useDocumentLifecycle(lifecycle);
  const folders = useFolderLifecycle(lifecycle);
  const documentAction = useDocumentAction();
  const folderAction = useFolderAction();
  const [search, setSearch] = useState("");
  const recycle = lifecycle === "recycle_bin";
  const rows = useMemo(() => {
    const documentRows = (documents.data ?? []).map((document: any) => ({ ...document, record_type: "document" }));
    return [...documentRows, ...(folders.data ?? [])].filter((record: any) => `${record.name} ${record.folder_name ?? ""} ${record.document_type ?? "Folder"}`.toLowerCase().includes(search.toLowerCase()));
  }, [documents.data, folders.data, search]);
  const perform = async (record: any, actionName: "restore" | "permanent_delete") => {
    if (actionName === "permanent_delete" && !window.confirm("Permanently delete this item? This cannot be undone.")) return;
    if (record.record_type === "folder") {
      await folderAction.mutateAsync({ id: record.id, action: actionName });
      await folders.refetch();
    } else {
      await documentAction.mutateAsync({ id: record.id, action: actionName });
      await documents.refetch();
    }
  };
  return <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">Document workspace</p><h1 className="mt-2 text-3xl font-bold text-slate-900">{recycle ? "Recycle Bin" : "Archived Documents"}</h1><p className="mt-2 text-sm text-slate-500">{recycle ? "Deleted files and folders remain recoverable for 30 days." : "Archived files and folders remain available for restoration."}</p></div><div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm"><p className="text-2xl font-bold text-brand-text">{rows.length}</p><p className="text-xs font-semibold text-slate-400">{recycle ? "in recycle bin" : "archived records"}</p></div></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><label className="relative block max-w-md"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files and folders..." className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10" /></label></div>{documents.isLoading || folders.isLoading ? <div className="space-y-3 p-5"><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /></div> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="px-5 py-4">Item</th><th className="px-5 py-4">Location</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">{recycle ? "Delete date" : "Archived date"}</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((record: any) => <tr key={`${record.record_type}-${record.id}`} className="hover:bg-pink-50/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">{record.record_type === "folder" ? <Folder className="h-5 w-5" /> : <Archive className="h-5 w-5" />}</span><div><p className="text-sm font-bold text-slate-800">{record.name}</p><p className="mt-1 text-xs text-slate-400">{record.record_type === "folder" ? `${record.document_count ?? 0} documents` : record.employee_name !== "N/A" ? record.employee_name : "Organizational record"}</p></div></div></td><td className="px-5 py-4 text-sm text-slate-600">{record.record_type === "folder" ? "Folder" : record.folder_name}</td><td className="px-5 py-4 text-sm text-slate-600">{record.record_type === "folder" ? `${record.folder_type === "employee" ? "Employee" : "Organizational"} folder` : record.document_type}</td><td className="px-5 py-4 text-sm text-slate-500">{recycle ? (record.recycle_bin_until?.slice(0, 10) ?? "30 days") : (record.write_date?.slice(0, 10) ?? "—")}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => perform(record, "restore")} className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 px-3 py-2 text-xs font-bold text-brand-text hover:bg-pink-50"><RotateCcw className="h-3.5 w-3.5" />Restore</button>{recycle && <button type="button" onClick={() => perform(record, "permanent_delete")} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Delete forever</button>}</div></td></tr>)}</tbody></table></div> : <div className="flex flex-col items-center p-16 text-center"><CheckCircle2 className="h-9 w-9 text-brand-pink" /><p className="mt-4 font-bold text-slate-700">Nothing here</p><p className="mt-1 text-sm text-slate-400">{recycle ? "Deleted files and folders will appear here." : "Archived files and folders will appear here."}</p></div>}</section>
  </div>;
}
