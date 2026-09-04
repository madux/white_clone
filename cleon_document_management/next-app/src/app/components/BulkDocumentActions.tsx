"use client";

import { Download, FileHeart, Pin, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { useDocumentAction } from "../../../hooks/useDocuments";

export default function BulkDocumentActions({ selected, onClear }: { selected: number[]; onClear: () => void }) {
  const [running, setRunning] = useState(false);
  const action = useDocumentAction();
  if (!selected.length) return null;
  const run = async (name: "favorite" | "pin") => { setRunning(true); for (const id of selected) await action.mutateAsync({ id, action: name }); setRunning(false); onClear(); };
  const download = () => { selected.forEach((id) => api.downloadDocument(id)); onClear(); };
  const remove = async () => { if (!window.confirm(`Delete ${selected.length} selected document${selected.length === 1 ? "" : "s"}?`)) return; setRunning(true); for (const id of selected) await action.mutateAsync({ id, action: "delete" }); setRunning(false); onClear(); };
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-100 bg-pink-50 p-2.5"><span className="px-2 text-sm font-bold text-brand-text">{selected.length} selected</span><button disabled={running} type="button" onClick={() => run("favorite")} className="bulk-button"><FileHeart />Favorite</button><button disabled={running} type="button" onClick={() => run("pin")} className="bulk-button"><Pin />Pin</button><button disabled={running} type="button" onClick={download} className="bulk-button"><Download />Download</button><button disabled={running} type="button" onClick={remove} className="bulk-button text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 />Delete</button><button type="button" onClick={onClear} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white hover:text-brand-pink" aria-label="Clear selection"><X className="h-4 w-4" /></button></div>;
}
