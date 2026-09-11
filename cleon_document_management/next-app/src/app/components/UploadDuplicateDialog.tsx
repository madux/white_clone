"use client";

import type { UploadDuplicateMatch } from "../../../lib/types";
import ModalDialog from "./ModalDialog";

type UploadDuplicateDialogProps = {
  matches: UploadDuplicateMatch[];
  typeLabels?: Record<number, string>;
  onCancel: () => void;
  onUploadAnyway: () => void;
  pending?: boolean;
};

export default function UploadDuplicateDialog({
  matches,
  typeLabels = {},
  onCancel,
  onUploadAnyway,
  pending = false,
}: UploadDuplicateDialogProps) {
  return (
    <ModalDialog
      title="Possible duplicate upload"
      eyebrow="Upload warning"
      description="One or more files match existing documents with the same name and document type."
      onClose={onCancel}
      size="lg"
      titleClassName="text-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onUploadAnyway}
            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {pending ? "Uploading..." : "Upload anyway"}
          </button>
        </div>
      }
    >
      <ul className="space-y-2">
        {matches.map((match) => (
          <li
            key={`${match.id}-${match.filename}-${match.document_type_id}`}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-semibold">{match.filename}</p>
            <p className="mt-1 text-xs text-amber-800">
              Matches existing document &ldquo;{match.name}&rdquo;
              {typeLabels[match.document_type_id]
                ? ` (${typeLabels[match.document_type_id]})`
                : ""}
              {match.version_count != null && match.version_count > 0
                ? ` · ${match.version_count} version${match.version_count === 1 ? "" : "s"}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </ModalDialog>
  );
}
