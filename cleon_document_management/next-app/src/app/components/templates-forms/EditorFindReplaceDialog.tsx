"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import ModalDialog from "../ModalDialog";
import { findInEditor, replaceInEditor } from "./editorFindReplace";

export default function EditorFindReplaceDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setMatchIndex(0);
    setTotal(0);
  }, [open]);

  function selectMatch(fromIndex: number) {
    if (!editor || !find.trim()) return;
    const hit = findInEditor(editor, find, fromIndex, caseSensitive);
    setTotal(hit.total);
    if (!hit.found || !hit.range) {
      setMessage(hit.total ? "No more matches." : "No matches.");
      return;
    }
    setMatchIndex(hit.index);
    editor.chain().focus().setTextSelection(hit.range).run();
    setMessage(hit.total > 1 ? `Match ${hit.index + 1} of ${hit.total}` : "1 match");
  }

  function findNext() {
    const start = matchIndex + find.length;
    selectMatch(start);
  }

  function findPrevious() {
    if (!editor || !find.trim()) return;
    const hit = findInEditor(editor, find, 0, caseSensitive);
    if (!hit.found) return;
    const wrap = findInEditor(editor, find, 0, caseSensitive);
    if (wrap.range && matchIndex <= 0) {
      let last = wrap;
      let cursor = 0;
      while (cursor < 1000) {
        const next = findInEditor(editor, find, last.index + find.length, caseSensitive);
        if (!next.found || !next.range) break;
        last = next;
        cursor += 1;
      }
      if (last.range) {
        editor.chain().focus().setTextSelection(last.range).run();
        setMatchIndex(last.index);
        setMessage(`Match ${last.index + 1} of ${last.total}`);
      }
      return;
    }
    selectMatch(Math.max(0, matchIndex - 1));
  }

  function replaceOne() {
    if (!editor) return;
    const count = replaceInEditor(editor, find, replace, false, caseSensitive);
    if (!count) {
      setMessage("No match to replace.");
      return;
    }
    setMessage("Replaced 1 occurrence.");
    selectMatch(matchIndex);
  }

  function replaceAll() {
    if (!editor) return;
    const count = replaceInEditor(editor, find, replace, true, caseSensitive);
    setMessage(count ? `Replaced ${count} occurrence(s).` : "No matches.");
    setTotal(0);
  }

  if (!open) return null;

  return (
    <ModalDialog title="Find and replace" onClose={onClose} size="md" zIndex={120}>
      <div className="space-y-3 text-sm">
        <label className="block space-y-1">
          <span className="font-semibold">Find</span>
          <input className="field w-full" value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">Replace with</span>
          <input className="field w-full" value={replace} onChange={(e) => setReplace(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Match case
        </label>
        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="secondary-button" onClick={() => selectMatch(0)}>
            Find
          </button>
          <button type="button" className="secondary-button" onClick={findNext}>
            Find next
          </button>
          <button type="button" className="secondary-button" onClick={findPrevious}>
            Find previous
          </button>
          <button type="button" className="secondary-button" onClick={replaceOne}>
            Replace
          </button>
          <button type="button" className="primary-button" onClick={replaceAll}>
            Replace all
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
