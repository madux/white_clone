"use client";

import { FileText, Folder, Pin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQuickAccess } from "../../../hooks/useDocuments";

export default function QuickAccessPage() {
  const quickAccess = useQuickAccess();
  const folders = quickAccess.data?.folders ?? [];
  const documents = quickAccess.data?.documents ?? [];
  const [tab, setTab] = useState<"folders" | "documents">("folders");
  return <div className="mx-auto min-h-full max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6 pb-10">
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">Personal shortcuts</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Quick Access</h1><p className="mt-2 text-sm text-slate-500">Your pinned folders and documents, available from one place.</p></div>
    {quickAccess.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-white" /> : <>
      <div className="flex w-fit gap-1 rounded-full border border-slate-200 bg-white p-1"><button type="button" onClick={() => setTab("folders")} className={`rounded-full px-4 py-2.5 text-sm font-bold ${tab === "folders" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-md shadow-pink-200" : "text-slate-500 hover:bg-pink-50"}`}>Pinned Folders <span className="ml-1 text-xs opacity-80">{folders.length}</span></button><button type="button" onClick={() => setTab("documents")} className={`rounded-full px-4 py-2.5 text-sm font-bold ${tab === "documents" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-md shadow-pink-200" : "text-slate-500 hover:bg-pink-50"}`}>Pinned Documents <span className="ml-1 text-xs opacity-80">{documents.length}</span></button></div>
      {tab === "folders" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Pin className="h-4 w-4 text-brand-pink" /><h2 className="font-bold text-slate-900">Pinned folders</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{folders.map((folder) => <Link key={folder.id} href={folder.folder_type === "employee" ? `/pages/employee/folder?folder=${folder.id}` : `/pages/organization/folder?folder=${folder.id}`} className="rounded-2xl border border-slate-100 p-4 transition hover:border-pink-200 hover:bg-pink-50/40"><Folder className="h-6 w-6 text-brand-pink" /><p className="mt-3 font-bold text-slate-800">{folder.folder_name}</p><p className="mt-1 line-clamp-2 text-xs text-slate-400">{folder.description || "Pinned folder"}</p></Link>)}{!folders.length && <p className="text-sm text-slate-400">Pinned folders will appear here.</p>}</div></section>}
      {tab === "documents" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Pin className="h-4 w-4 text-brand-pink" /><h2 className="font-bold text-slate-900">Pinned documents</h2></div><div className="mt-4 divide-y divide-slate-100">{documents.map((document) => <Link key={document.id} href={document.employee_id ? `/pages/employee/profile?employee=${document.employee_id}` : `/pages/organization/folder?folder=${document.folder_id}`} className="flex items-center gap-3 py-3 hover:text-brand-pink"><FileText className="h-5 w-5 text-brand-pink" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{document.name}</strong><small className="text-xs text-slate-400">{document.folder_name} · {document.document_type}</small></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{document.active === false ? "Inactive" : "Active"}</span></Link>)}{!documents.length && <p className="text-sm text-slate-400">Pinned documents will appear here.</p>}</div></section>}
    </>}
  </div>;
}
