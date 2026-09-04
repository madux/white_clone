"use client";

import { Download, Ellipsis, FileHeart, Pin, Trash2 } from "lucide-react";
import { api } from "../../../lib/api";
import { useDocumentAction } from "../../../hooks/useDocuments";
import { useRef } from "react";
import { useClickOutside } from "../../../hooks/useClickOutside";

export default function DocumentActions({ documentId, documentName }: { documentId: number; documentName: string }) {
  const action = useDocumentAction();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useClickOutside(menuRef, () => { if (menuRef.current) menuRef.current.open = false; });
  const deleteDocument = async () => { if (window.confirm(`Delete "${documentName}"? This cannot be undone.`)) await action.mutateAsync({ id: documentId, action: "delete" }); };
  return <details ref={menuRef} className="relative" onClick={(event) => event.stopPropagation()}><summary className="list-none cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><Ellipsis className="h-5 w-5" /></summary><div className="absolute right-0 z-30 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-xl"><button type="button" onClick={() => action.mutate({ id: documentId, action: "favorite" })} className="menu-item"><FileHeart />Favorite</button><button type="button" onClick={() => action.mutate({ id: documentId, action: "pin" })} className="menu-item"><Pin />Pin document</button><button type="button" onClick={() => api.downloadDocument(documentId)} className="menu-item"><Download />Download</button><button type="button" onClick={deleteDocument} className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 />Delete</button></div></details>;
}
