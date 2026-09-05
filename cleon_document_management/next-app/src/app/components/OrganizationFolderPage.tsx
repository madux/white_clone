"use client";

import { Archive, ArrowLeft, FilePlus2, FileText, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDocumentTypes, useDocuments, useFolders, useUploadDocument } from "../../../hooks/useDocuments";
import { api, useTestData } from "../../../lib/api";
import DocumentActions from "./DocumentActions";
import BulkDocumentActions from "./BulkDocumentActions";

export default function OrganizationFolderPage() {
  const params = useSearchParams();
  const folderId = Number(params.get("folder"));
  const folders = useFolders();
  const documents = useDocuments(folderId || undefined, true);
  const types = useDocumentTypes();
  const upload = useUploadDocument();
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const folder = folders.data?.find((item) => item.id === folderId);
  const visibleDocuments = useMemo(() => (documents.data ?? []).filter((document) => `${document.name} ${document.document_type}`.toLowerCase().includes(search.toLowerCase())), [documents.data, search]);
  useEffect(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    rows.forEach((row) => {
      const name = row.textContent || "";
      const record = visibleDocuments.find((item) => name.includes(item.name));
      const badge = row.querySelector("td:nth-last-child(4) span");
      if (!record || !badge) return;
      const status = record.distribution_status || (record.active === false ? "deactivated" : "active");
      badge.textContent = status === "archived" ? "Archived" : status === "deactivated" ? "Inactive" : "Active";
    });
  }, [visibleDocuments]);
  const visibleIds = visibleDocuments.map((document) => document.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !typeId || !folderId) return;
    await upload.mutateAsync({ file, folder_id: folderId, document_type_id: Number(typeId) });
    setFile(null); setTypeId(""); setShowUpload(false);
  };
  return <div className="min-h-full mx-auto max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6 pb-10">
    <Link href="/pages/organization" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-pink"><ArrowLeft className="h-4 w-4" />Back to Organizational Files</Link>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">Organizational folder</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{folder?.folder_name ?? "Organizational Files"}</h1><p className="mt-2 text-sm text-slate-500">{folder?.description ?? "Manage company documents and policies."}</p></div><div className="flex flex-wrap gap-2"><Link href="/pages/archived" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-pink hover:text-brand-pink"><Archive className="h-4 w-4" />Archived</Link><button type="button" onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"><FilePlus2 className="h-4 w-4" />Add document</button></div></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><label className="relative block sm:w-96"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10" /></label><span className="text-sm font-semibold text-slate-400">{visibleDocuments.length} documents</span></div><div className="px-4 pt-4"><BulkDocumentActions selected={selected} onClear={() => setSelected([])} documents={visibleDocuments} organizational /></div>
      {documents.isLoading ? <div className="space-y-3 p-5"><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="w-12 px-5 py-4"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} aria-label="Select all documents" className="h-4 w-4 accent-pink-600" /></th><th className="px-5 py-4">Document</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Expiry date</th><th className="px-5 py-4">Uploaded</th><th className="px-5 py-4">Modified</th><th className="px-5 py-4" /></tr></thead><tbody className="divide-y divide-slate-100">{visibleDocuments.map((document) => <tr key={document.id} className="transition hover:bg-pink-50/30"><td className="w-12 px-5 py-4"><input type="checkbox" checked={selected.includes(document.id)} onChange={() => toggleSelected(document.id)} onClick={(event) => event.stopPropagation()} aria-label={`Select ${document.name}`} className="h-4 w-4 accent-pink-600" /></td><td className="px-5 py-4"><button type="button" onClick={() => setViewing(document)} className="flex items-center gap-3 text-left"><span className="rounded-xl bg-pink-50 p-2.5 text-brand-pink"><FileText className="h-5 w-5" /></span><span><strong className="block text-sm text-slate-800 hover:text-brand-pink">{document.name}</strong><small className="mt-1 block text-xs text-slate-400">{document.description || "Organizational document"}</small></span></button></td><td className="px-5 py-4 text-sm text-slate-600">{document.document_type}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${document.active === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>{document.active === false ? "Inactive" : "Active"}</span></td><td className="px-5 py-4 text-sm text-slate-500">{document.expiry_date || "No expiry"}</td><td className="px-5 py-4 text-sm text-slate-500">{document.created_at?.slice(0, 10) || "Unknown"}</td><td className="px-5 py-4 text-sm text-slate-500">{document.write_date.slice(0, 10)}</td><td className="px-5 py-4 text-right"><DocumentActions documentId={document.id} documentName={document.name} active={document.active !== false} organizational /></td></tr>)}</tbody></table></div>}
      {!documents.isLoading && !visibleDocuments.length && <p className="p-12 text-center text-sm text-slate-500">No documents found in this folder.</p>}
    </section>
    {showUpload && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"><form onSubmit={submitUpload} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">Organizational file</p><h2 className="mt-1 text-xl font-bold text-slate-900">Add document</h2></div><button type="button" onClick={() => setShowUpload(false)} className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><X /></button></div><label className="mt-5 block"><span className="label">File</span><span className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-pink/40 bg-pink-50/50 px-4 py-5 text-sm font-semibold text-brand-text"><Upload className="h-5 w-5" />{file?.name ?? "Choose a file from your computer"}<input required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="hidden" /></span></label><label className="mt-4 block"><span className="label">Document type</span><select required value={typeId} onChange={(event) => setTypeId(event.target.value)} className="field"><option value="">Select document type</option>{(types.data ?? []).map((type: any) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowUpload(false)} className="rounded-xl px-4 py-2.5 font-semibold text-slate-500">Cancel</button><button disabled={upload.isPending} className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white">{upload.isPending ? "Uploading..." : "Upload document"}</button></div></form></div>}
    {viewing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"><div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold text-slate-900">{viewing.name}</h2><p className="text-xs text-slate-400">{viewing.document_type}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Print</button><button type="button" onClick={() => api.downloadDocument(viewing.id)} className="rounded-xl bg-brand-pink px-3 py-2 text-sm font-semibold text-white">Download</button><button type="button" onClick={() => setViewing(null)} className="rounded-xl p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><X /></button></div></div><div className="min-h-[420px] flex-1 bg-slate-50 p-5">{useTestData ? <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm"><FileText className="h-10 w-10 text-brand-pink" /><h3 className="mt-5 text-xl font-bold text-slate-900">Test document preview</h3><p className="mt-2 leading-7 text-slate-600">{viewing.description || "This is mock document content for development."}</p><p className="mt-6 text-sm text-slate-400">{viewing.name} · {viewing.mime_type}</p></div> : <iframe title={viewing.name} src={`${(process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "")}/document-management/document/${viewing.id}/preview`} className="h-[65vh] w-full rounded-2xl border border-slate-200 bg-white" />}</div></div></div>}
  </div>;
}
