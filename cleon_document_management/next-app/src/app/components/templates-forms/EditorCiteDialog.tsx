"use client";

import type { Editor } from "@tiptap/react";
import ModalDialog from "../ModalDialog";
import { insertCitation } from "./editorCitations";
import { readDocMeta } from "./editorDocumentMeta";

export default function EditorCiteDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !editor) return null;
  const sources = readDocMeta(editor).bibliographySources;

  return (
    <ModalDialog title="Insert citation" onClose={onClose} size="md" zIndex={120}>
      {sources.length ? (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  insertCitation(editor, source.id);
                  onClose();
                }}
              >
                <span className="font-semibold text-slate-800">{source.author || "Unknown"}</span>
                <span className="text-slate-500"> ({source.year || "n.d."}) — {source.title || "Untitled"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Add sources first (References → Sources).</p>
      )}
    </ModalDialog>
  );
}
