"use client";

import type { Editor } from "@tiptap/react";
import ModalDialog from "../ModalDialog";
import { insertCrossReference, listCaptionTargets } from "./editorCaptions";

export default function EditorCrossRefDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !editor) return null;
  const targets = listCaptionTargets(editor);

  return (
    <ModalDialog title="Insert cross-reference" onClose={onClose} size="md" zIndex={120}>
      {targets.length ? (
        <ul className="space-y-2">
          {targets.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  insertCrossReference(editor, target.id);
                  onClose();
                }}
              >
                {target.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Add a table or figure caption first (References → Caption).</p>
      )}
    </ModalDialog>
  );
}
