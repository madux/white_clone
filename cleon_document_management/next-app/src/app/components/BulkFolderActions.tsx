"use client";

import { Archive, FolderHeart, Pin, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useDeleteFolder, useFolderAction } from "../../../hooks/useDocuments";

export default function BulkFolderActions({ selected, onClear }: { selected: number[]; onClear: () => void }) {
  const [running, setRunning] = useState(false);
  const action = useFolderAction();
  const remove = useDeleteFolder();
  if (!selected.length) return null;
  const runAction = async (name: "favorite" | "pin" | "archive") => {
    setRunning(true);
    for (const id of selected) await action.mutateAsync({ id, action: name });
    setRunning(false);
    onClear();
  };
  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selected.length} selected folder${selected.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setRunning(true);
    for (const id of selected) await remove.mutateAsync(id);
    setRunning(false);
    onClear();
  };
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-100 bg-pink-50 p-2.5"><span className="px-2 text-sm font-bold text-brand-text">{selected.length} selected</span><button disabled={running} type="button" onClick={() => runAction("favorite")} className="bulk-button"><FolderHeart />Favorite</button><button disabled={running} type="button" onClick={() => runAction("pin")} className="bulk-button"><Pin />Pin</button><button disabled={running} type="button" onClick={() => runAction("archive")} className="bulk-button"><Archive />Archive</button><button disabled={running} type="button" onClick={deleteSelected} className="bulk-button text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 />Delete</button><button type="button" onClick={onClear} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white hover:text-brand-pink" aria-label="Clear selection"><X className="h-4 w-4" /></button></div>;
}
