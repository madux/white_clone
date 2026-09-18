"use client";

import { FormEvent, useState } from "react";
import { Upload } from "lucide-react";
import type { DocumentType } from "../../../lib/types";
import {
  firstUploadMetadataError,
  typeRequiresDescription,
  typeRequiresExpiry,
  typeRequiresIssueDate,
} from "../../../lib/uploadMetadataHelpers";
import ThemedSelect from "./ThemedSelect";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";

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

  const typeOptions = documentTypes.map((type) => ({
    value: String(type.id),
    label: type.name,
  }));

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
      <div className="space-y-4 py-4 text-center">
        <p className="text-lg font-semibold text-slate-900">Document submitted</p>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 text-sm font-bold text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={step === 2 ? handleFinish : (e) => e.preventDefault()}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Step {step} of 2
      </p>
      {step === 1 ? (
        <>
          <label className="block">
            <span className="label">Document type</span>
            <div className="mt-1 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <ThemedSelect
                  value={documentTypeId}
                  onChange={setDocumentTypeId}
                  placeholder="Select a type"
                  options={typeOptions}
                  portaled
                  ariaLabel="Document type"
                />
              </div>
              <InlineDocumentTypeCreator
                onCreated={(type) => setDocumentTypeId(String(type.id))}
              />
            </div>
          </label>
          <label className="block">
            <span className="label">File</span>
            <span className="mt-1 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-brand-pink/40 bg-pink-50/50 px-4 py-6 text-sm font-semibold text-brand-text">
              <Upload className="h-5 w-5 shrink-0" />
              {file ? file.name : "Choose a file from your computer"}
              <input
                type="file"
                required
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </span>
          </label>
          {documentTypeId ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Document details
              </p>
              <label className="block">
                <span className="label">
                  Issue date
                  {typeRequiresIssueDate(typeId, documentTypes) ? " (required)" : ""}
                </span>
                <input
                  type="date"
                  className="field mt-1 w-full"
                  value={issueDate}
                  required={typeRequiresIssueDate(typeId, documentTypes)}
                  onChange={(event) => setIssueDate(event.target.value)}
                />
              </label>
              {typeRequiresExpiry(typeId, documentTypes) ? (
                <label className="block">
                  <span className="label">Expiry date (required)</span>
                  <input
                    type="date"
                    className="field mt-1 w-full"
                    value={expiryDate}
                    required
                    onChange={(event) => setExpiryDate(event.target.value)}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="label">
                  Description
                  {typeRequiresDescription(typeId, documentTypes)
                    ? " (required)"
                    : ""}
                </span>
                <textarea
                  className="field mt-1 min-h-20 w-full"
                  value={description}
                  required={typeRequiresDescription(typeId, documentTypes)}
                  placeholder={
                    typeRequiresDescription(typeId, documentTypes)
                      ? "Required"
                      : "Optional"
                  }
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </>
      ) : null}
      {step === 2 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Review
          </p>
          <p className="mt-2">
            <strong>Type:</strong> {selectedType?.name}
          </p>
          <p>
            <strong>File:</strong> {file?.name}
          </p>
          {issueDate ? <p><strong>Issue date:</strong> {issueDate}</p> : null}
          {expiryDate ? <p><strong>Expiry:</strong> {expiryDate}</p> : null}
          {description ? <p><strong>Description:</strong> {description}</p> : null}
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex justify-between gap-2 pt-2">
        <button
          type="button"
          className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
        >
          {step === 1 ? "Cancel" : "Back"}
        </button>
        {step < 2 ? (
          <button
            type="button"
            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit"}
          </button>
        )}
      </div>
    </form>
  );
}
