"use client";

import ModalDialog from "../ModalDialog";

export default function EditorTocHelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <ModalDialog title="How to use the table of contents" onClose={onClose} size="md" zIndex={120}>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
        <li>
          Write section titles in the document, then select each title and choose{" "}
          <strong className="text-slate-800">Home → Styles → Heading 1–4</strong> (not Normal).
        </li>
        <li>Click where you want the TOC (usually near the top).</li>
        <li>
          Open <strong className="text-slate-800">References → TOC</strong> to insert the table.
        </li>
        <li>Click any blue line in the TOC to jump to that heading.</li>
        <li>
          After you add or rename headings, use <strong className="text-slate-800">References → Update</strong>.
        </li>
        <li>Use the <strong className="text-slate-800">×</strong> on the TOC box to remove it.</li>
      </ol>
      <p className="mt-4 text-xs text-slate-500">
        The TOC is read-only and built from headings automatically — you do not type inside the grey box.
      </p>
      <div className="mt-4 flex justify-end">
        <button type="button" className="primary-button" onClick={onClose}>
          Got it
        </button>
      </div>
    </ModalDialog>
  );
}
