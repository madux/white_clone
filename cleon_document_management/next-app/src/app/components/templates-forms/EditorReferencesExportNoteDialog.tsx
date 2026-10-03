"use client";

import ModalDialog from "../ModalDialog";
import { REFERENCES_EXPORT_NOTE } from "./editorReferences";

export default function EditorReferencesExportNoteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <ModalDialog title="Export & references" onClose={onClose} size="md" zIndex={120}>
      <p className="text-sm leading-relaxed text-slate-600">{REFERENCES_EXPORT_NOTE}</p>
      <p className="mt-3 text-sm text-slate-500">
        Footnotes and citation styles (APA, etc.) are planned for a later release.
      </p>
      <div className="mt-4 flex justify-end">
        <button type="button" className="primary-button" onClick={onClose}>
          Got it
        </button>
      </div>
    </ModalDialog>
  );
}
