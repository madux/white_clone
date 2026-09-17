"use client";

import type { UploadConflict } from "../../../lib/types";
import ModalDialog from "./ModalDialog";

type UploadConflictDialogProps = {
  conflicts: UploadConflict[];
  onCancel: () => void;
  onUpdateExisting: () => void;
  onUploadSeparate: () => void;
  pending?: boolean;
  canUpdateExisting: boolean;
  requireConfirmForSeparate: boolean;
};

export default function UploadConflictDialog({
  conflicts,
  onCancel,
  onUpdateExisting,
  onUploadSeparate,
  pending = false,
  canUpdateExisting,
  requireConfirmForSeparate,
}: UploadConflictDialogProps) {
  const unique = conflicts.filter(
    (item, index, list) =>
      list.findIndex(
        (other) => other.document_type_id === item.document_type_id,
      ) === index,
  );

  return (
    <ModalDialog
      title="Existing document found"
      eyebrow="Upload"
      description="This employee already has an active document for the selected type."
      onClose={onCancel}
      size="md"
      backdropClassName="bg-slate-950/45"
      titleClassName="text-xl"
    >
      <ul className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {unique.map((conflict) => (
          <li key={conflict.document_type_id}>
            <span className="font-semibold text-slate-900">
              {conflict.document_type_name}
            </span>
            <span className="text-slate-500"> — {conflict.existing_name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-slate-600">
        {canUpdateExisting
          ? "Update the existing document to keep version history, or upload a separate copy if your policy allows it."
          : "Versioning is disabled for this type. You can upload a separate copy if your policy allows it."}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onUploadSeparate}
          disabled={pending}
          className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          {requireConfirmForSeparate
            ? "Confirm separate upload"
            : "Upload as separate document"}
        </button>
        {canUpdateExisting ? (
          <button
            type="button"
            onClick={onUpdateExisting}
            disabled={pending}
            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-200 disabled:opacity-50"
          >
            Update existing
          </button>
        ) : null}
      </div>
    </ModalDialog>
  );
}
