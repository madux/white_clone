"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import ModalDialog from "../ModalDialog";
import { markIndexEntry } from "./editorIndex";

export default function EditorIndexMarkDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}) {
  const [main, setMain] = useState("");
  const [sub, setSub] = useState("");

  if (!open) return null;

  const submit = () => {
    if (!editor) return;
    if (markIndexEntry(editor, main, sub)) {
      setMain("");
      setSub("");
      onClose();
    }
  };

  return (
    <ModalDialog title="Mark index entry" onClose={onClose} size="md" zIndex={120}>
      <p className="mb-3 text-sm text-slate-600">Select text in the document first, then enter the index terms.</p>
      <div className="grid gap-3">
        <label className="text-sm">
          Main entry
          <input className="field mt-1 w-full" value={main} onChange={(e) => setMain(e.target.value)} />
        </label>
        <label className="text-sm">
          Subentry (optional)
          <input className="field mt-1 w-full" value={sub} onChange={(e) => setSub(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="primary-button" onClick={submit}>Mark selection</button>
      </div>
    </ModalDialog>
  );
}
