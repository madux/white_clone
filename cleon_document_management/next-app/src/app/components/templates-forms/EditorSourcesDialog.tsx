"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import ModalDialog from "../ModalDialog";
import type { BibliographySource } from "./editorCitations";
import { newSourceId } from "./editorCitations";
import { readDocMeta, writeDocMeta } from "./editorDocumentMeta";
import { updateBibliographyBlocks } from "./editorCitations";

export default function EditorSourcesDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}) {
  const [sources, setSources] = useState<BibliographySource[]>([]);

  useEffect(() => {
    if (!open || !editor) return;
    setSources(readDocMeta(editor).bibliographySources);
  }, [editor, open]);

  if (!open) return null;

  const save = () => {
    if (!editor) return;
    writeDocMeta(editor, { bibliographySources: sources });
    updateBibliographyBlocks(editor);
    onClose();
  };

  const add = () => {
    setSources((current) => [
      ...current,
      { id: newSourceId(), author: "", title: "", year: "", publisher: "" },
    ]);
  };

  const update = (id: string, patch: Partial<BibliographySource>) => {
    setSources((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const remove = (id: string) => {
    setSources((current) => current.filter((item) => item.id !== id));
  };

  return (
    <ModalDialog title="Manage sources" onClose={onClose} size="lg" zIndex={120}>
      <p className="mb-3 text-sm text-slate-600">
        Add bibliographic sources, then use <strong>Cite</strong> in the document.
      </p>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto">
        {sources.map((source, index) => (
          <div key={source.id} className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">Source {index + 1}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="field"
                placeholder="Author"
                value={source.author}
                onChange={(e) => update(source.id, { author: e.target.value })}
              />
              <input
                className="field"
                placeholder="Year"
                value={source.year}
                onChange={(e) => update(source.id, { year: e.target.value })}
              />
              <input
                className="field sm:col-span-2"
                placeholder="Title"
                value={source.title}
                onChange={(e) => update(source.id, { title: e.target.value })}
              />
              <input
                className="field sm:col-span-2"
                placeholder="Publisher (optional)"
                value={source.publisher || ""}
                onChange={(e) => update(source.id, { publisher: e.target.value })}
              />
            </div>
            <button type="button" className="mt-2 text-xs font-semibold text-red-600" onClick={() => remove(source.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="secondary-button" onClick={add}>Add source</button>
        <button type="button" className="primary-button ml-auto" onClick={save}>Save sources</button>
      </div>
    </ModalDialog>
  );
}
