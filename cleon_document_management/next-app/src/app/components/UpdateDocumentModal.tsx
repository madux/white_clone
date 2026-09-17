"use client";

import { FormEvent, useMemo, useState } from "react";
import { useDocumentTypes, useUploadEmployeeDocument, useUploadMyDocument } from "../../../hooks/useDocuments";
import {
  firstUploadMetadataError,
  typeRequiresDescription,
  typeRequiresExpiry,
  typeRequiresIssueDate,
} from "../../../lib/uploadMetadataHelpers";
import type { DocDocument } from "../../../lib/types";
import { updateBlockedMessage } from "../../../lib/documentUpdateHelpers";
import ModalDialog from "./ModalDialog";

type Props = {
  document: DocDocument;
  employeeId?: number;
  mode: "employee_file" | "my_documents";
  onClose: () => void;
  onSuccess?: () => void;
};

export default function UpdateDocumentModal({
  document,
  employeeId,
  mode,
  onClose,
  onSuccess,
}: Props) {
  const documentTypes = useDocumentTypes();
  const uploadEmployee = useUploadEmployeeDocument();
  const uploadMy = useUploadMyDocument();
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const typeId = String(document.document_type_id);
  const types = documentTypes.data ?? [];
  const selectedType = types.find((item) => String(item.id) === typeId);
  const blocked = updateBlockedMessage(document);
  const pending =
    mode === "employee_file" ? uploadEmployee.isPending : uploadMy.isPending;

  const metadataError = useMemo(() => {
    if (!file || !selectedType) return null;
    return firstUploadMetadataError(
      [typeId],
      [expiryDate],
      [issueDate],
      [description],
      types,
    );
  }, [file, selectedType, typeId, expiryDate, issueDate, description, types]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || !file) return;
    const validationError = firstUploadMetadataError(
      [typeId],
      [expiryDate],
      [issueDate],
      [description],
      types,
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    const payload = {
      files: [file],
      document_type_ids: [document.document_type_id],
      expiry_dates: [expiryDate],
      issue_dates: [issueDate],
      descriptions: [description],
      replace_document_ids: [document.id],
      change_notes: [changeNote.trim() || "Document update"],
    };
    try {
      if (mode === "employee_file") {
        if (!employeeId) {
          setError("Employee context is missing.");
          return;
        }
        const result = await uploadEmployee.mutateAsync({
          ...payload,
          employee_id: employeeId,
        });
        if (!result.success) {
          throw new Error(result.message || "The document could not be updated.");
        }
      } else {
        const result = await uploadMy.mutateAsync(payload);
        if (!result.success) {
          throw new Error(result.message || "The document could not be updated.");
        }
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "The document could not be updated.";
      setError(message);
    }
  };

  return (
    <ModalDialog
      title="Update document"
      eyebrow={document.document_type}
      description={`Upload a new file for "${document.name}". The current file stays published until approval completes when required for this type.`}
      onClose={onClose}
      size="lg"
      titleClassName="text-xl"
    >
      <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        {blocked ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {blocked}
          </p>
        ) : null}
        <label className="block">
          <span className="label">New file</span>
          <input
            type="file"
            required
            disabled={Boolean(blocked)}
            className="field w-full"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block">
          <span className="label">Change note (optional)</span>
          <input
            type="text"
            className="field w-full"
            value={changeNote}
            disabled={Boolean(blocked)}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="What changed in this version?"
          />
        </label>
        {selectedType && typeRequiresIssueDate(typeId, types) ? (
          <label className="block">
            <span className="label">Issue date (required)</span>
            <input
              type="date"
              required
              className="field w-full"
              value={issueDate}
              disabled={Boolean(blocked)}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </label>
        ) : (
          <label className="block">
            <span className="label">Issue date</span>
            <input
              type="date"
              className="field w-full"
              value={issueDate}
              disabled={Boolean(blocked)}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </label>
        )}
        {selectedType && typeRequiresExpiry(typeId, types) ? (
          <label className="block">
            <span className="label">Expiry date (required)</span>
            <input
              type="date"
              required
              className="field w-full"
              value={expiryDate}
              disabled={Boolean(blocked)}
              onChange={(event) => setExpiryDate(event.target.value)}
            />
          </label>
        ) : null}
        <label className="block">
          <span className="label">
            Description
            {selectedType && typeRequiresDescription(typeId, types)
              ? " (required)"
              : ""}
          </span>
          <textarea
            className="field w-full min-h-20"
            value={description}
            required={
              selectedType ? typeRequiresDescription(typeId, types) : false
            }
            disabled={Boolean(blocked)}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        {metadataError && file ? (
          <p className="text-xs text-slate-500">{metadataError}</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={Boolean(blocked) || pending || !file || Boolean(metadataError)}
            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Submit update"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
