"use client";

import { FormEvent, useState } from "react";
import type { DocumentType } from "../../../lib/types";
import {
  firstUploadMetadataError,
  typeRequiresDescription,
  typeRequiresExpiry,
  typeRequiresIssueDate,
} from "../../../lib/uploadMetadataHelpers";

type Props = {
  documentTypes: DocumentType[];
  onSubmit: (payload: {
    files: File[];
    documentTypeId: number;
    metadata: Record<string, string>;
  }) => Promise<void>;
  onClose: () => void;
};

export default function EmployeeUploadWizard({ documentTypes, onSubmit, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const selectedType = documentTypes.find(
    (type) => String(type.id) === documentTypeId,
  );
  const typeId = documentTypeId;

  const handleFinish = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !selectedType) return;
    const metadataError = firstUploadMetadataError(
      [String(selectedType.id)],
      [expiryDate],
      [issueDate],
      [description],
      documentTypes,
    );
    if (metadataError) {
      setError(metadataError);
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSubmit({
        files: [file],
        documentTypeId: selectedType.id,
        metadata: {
          issue_date: issueDate,
          expiry_date: expiryDate,
          description,
        },
      });
      setStep(3);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setPending(false);
    }
  };

  const canContinueStep1 = Boolean(file && documentTypeId);
  const canContinueStep2 = !firstUploadMetadataError(
    documentTypeId ? [documentTypeId] : [],
    [expiryDate],
    [issueDate],
    [description],
    documentTypes,
  );

  if (step === 3) {
    return (
      <div className="space-y-4 p-2 text-center">
        <p className="text-lg font-semibold text-slate-900">Document submitted</p>
        <button type="button" className="text-sm font-semibold text-brand-pink" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={step === 2 ? handleFinish : (e) => e.preventDefault()}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Step {step} of 2
      </p>
      {step === 1 ? (
        <>
          <label className="block text-sm font-medium text-slate-700">Document type</label>
          <select
            className="field w-full"
            value={documentTypeId}
            onChange={(event) => setDocumentTypeId(event.target.value)}
            required
          >
            <option value="">Select type</option>
            {documentTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          <label className="block text-sm font-medium text-slate-700">File</label>
          <input
            type="file"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {documentTypeId ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Document details
              </p>
              <label className="block text-sm font-medium text-slate-700">
                Issue date
                {typeRequiresIssueDate(typeId, documentTypes) ? " (required)" : ""}
              </label>
              <input
                type="date"
                className="field w-full"
                value={issueDate}
                required={typeRequiresIssueDate(typeId, documentTypes)}
                onChange={(event) => setIssueDate(event.target.value)}
              />
              {typeRequiresExpiry(typeId, documentTypes) ? (
                <>
                  <label className="block text-sm font-medium text-slate-700">
                    Expiry date (required)
                  </label>
                  <input
                    type="date"
                    className="field w-full"
                    value={expiryDate}
                    required
                    onChange={(event) => setExpiryDate(event.target.value)}
                  />
                </>
              ) : null}
              <label className="block text-sm font-medium text-slate-700">
                Description
                {typeRequiresDescription(typeId, documentTypes) ? " (required)" : ""}
              </label>
              <textarea
                className="field w-full min-h-20"
                value={description}
                required={typeRequiresDescription(typeId, documentTypes)}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {step === 2 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p><strong>Type:</strong> {selectedType?.name}</p>
          <p><strong>File:</strong> {file?.name}</p>
          {issueDate ? <p><strong>Issue date:</strong> {issueDate}</p> : null}
          {expiryDate ? <p><strong>Expiry:</strong> {expiryDate}</p> : null}
          {description ? <p><strong>Description:</strong> {description}</p> : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          className="text-sm text-slate-600"
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
        >
          {step === 1 ? "Cancel" : "Back"}
        </button>
        {step < 2 ? (
          <button
            type="button"
            className="rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              const metadataError = firstUploadMetadataError(
                [documentTypeId],
                [expiryDate],
                [issueDate],
                [description],
                documentTypes,
              );
              if (metadataError) {
                setError(metadataError);
                return;
              }
              setError("");
              setStep(2);
            }}
            disabled={!canContinueStep1 || !canContinueStep2}
          >
            Review
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white"
          >
            {pending ? "Submitting…" : "Submit"}
          </button>
        )}
      </div>
    </form>
  );
}
