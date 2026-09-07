"use client";

import { Archive, Download, Ellipsis, FileHeart, Pin, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { useDocumentAction } from "../../../hooks/useDocuments";
import { useClickOutside } from "../../../hooks/useClickOutside";

export default function DocumentActions({ documentId, documentName, active, organizational = false }: { documentId: number; documentName: string; active?: boolean; organizational?: boolean }) {
  const action = useDocumentAction();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useClickOutside(rootRef, () => setOpen(false));
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
  }, [open]);

  const run = async (name: "favorite" | "pin" | "delete" | "archive" | "activate" | "deactivate") => {
    if (name === "delete" && !window.confirm(`Move "${documentName}" to the recycle bin?`)) return;
    if (name === "archive" && !window.confirm(`Archive "${documentName}"? It will be removed from everyone it is shared with until restored.`)) return;
    await action.mutateAsync({ id: documentId, action: name });
    setOpen(false);
  };

  return <div ref={rootRef} onClick={(event) => event.stopPropagation()}>
    <button ref={buttonRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`Actions for ${documentName}`} className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink">
      <Ellipsis className="h-5 w-5" />
    </button>
    {open && <div className="fixed z-[100] w-52 rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-2xl" style={{ top: position.top, right: position.right }}>
      <button type="button" onClick={() => run("favorite")} className="menu-item"><FileHeart />Favorite</button>
      <button type="button" onClick={() => run("pin")} className="menu-item"><Pin />Pin document</button>
      {organizational && active !== false && <button type="button" onClick={() => run("archive")} className="menu-item"><Archive />Archive document</button>}
      {organizational && <button type="button" onClick={() => run(active === false ? "activate" : "deactivate")} className="menu-item">{active === false ? <ToggleRight /> : <ToggleLeft />}{active === false ? "Activate document" : "Deactivate document"}</button>}
      <button type="button" onClick={() => { api.downloadDocument(documentId); setOpen(false); }} className="menu-item"><Download />Download</button>
      <button type="button" onClick={() => run("delete")} className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 />Move to recycle bin</button>
    </div>}
  </div>;
}
