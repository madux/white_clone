"use client";

import { Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DocumentType } from "../../../lib/types";
import {
  firstUploadMetadataError,
  typeRequiresDescription,
  typeRequiresExpiry,
  typeRequiresIssueDate,
} from "../../../lib/uploadMetadataHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";

export type DocumentUploadPayload = {
  files: File[];
  documentTypeIds: string[];
  expiryDates: string[];
  issueDates: string[];
  descriptions: string[];
};

export default function DocumentUploadModal({
  title = "Upload documents",
  eyebrow,
  description = "Choose one or more files, pick a document type, and add any required details.",
  documentTypes,
  lockedTypeId,
  lockedTypeLabel,
  pending,
  error,
  progress,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title?: string;
  eyebrow?: string;
  description?: string;
  documentTypes: DocumentType[];
  lockedTypeId?: string;
  lockedTypeLabel?: string;
  pending?: boolean;
  error?: string;
  progress?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (payload: DocumentUploadPayload) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [expiryDates, setExpiryDates] = useState<string[]>([]);
  const [issueDates, setIssueDates] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [bulkTypeId, setBulkTypeId] = useState(lockedTypeId ?? "");
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (lockedTypeId) setBulkTypeId(lockedTypeId);
  }, [lockedTypeId]);

  const typeOptions = useMemo(
    () => documentTypes.map((type) => ({ value: String(type.id), label: type.name })),
    [documentTypes],
  );

  const applyFiles = (next: File[]) => {
    const preset = lockedTypeId ?? "";
    setFiles(next);
    setTypeIds(next.map((_, index) => typeIds[index] ?? preset));
    setExpiryDates(next.map((_, index) => expiryDates[index] ?? ""));
    setIssueDates(next.map((_, index) => issueDates[index] ?? ""));
    setDescriptions(next.map((_, index) => descriptions[index] ?? ""));
    setLocalError("");
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
    setTypeIds((current) => current.filter((_, i) => i !== index));
    setExpiryDates((current) => current.filter((_, i) => i !== index));
    setIssueDates((current) => current.filter((_, i) => i !== index));
    setDescriptions((current) => current.filter((_, i) => i !== index));
    setLocalError("");
  };

  const blockReason = !files.length
    ? "Choose at least one file."
    : typeIds.some((id) => !id)
      ? "Select a document type for each file."
      : firstUploadMetadataError(
          typeIds,
          expiryDates,
          issueDates,
          descriptions,
          documentTypes,
        );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blockReason) {
      setLocalError(blockReason);
      return;
    }
    setLocalError("");
    await onSubmit({
      files,
      documentTypeIds: typeIds,
      expiryDates,
      issueDates,
      descriptions,
    });
  };

  const displayError = localError || error;

  return (
    <ModalDialog
      title={title}
      eyebrow={eyebrow}
      description={description}
      onClose={onClose}
      size="lg"
      titleClassName="text-xl"
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <label className="block">
          <span className="label">Files</span>
          <span
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const next = Array.from(event.dataTransfer.files ?? []);
              if (next.length) applyFiles(next);
            }}
            className={`mt-1 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-sm font-semibold ${
              dragging
                ? "border-primary bg-primary/10 text-primary"
                : "border-primary/40 bg-primary/5 text-primary"
            }`}
          >
            <Upload />
            {files.length
              ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
              : "Choose files or drag them here"}
            <input
              required
              multiple
              type="file"
              className="hidden"
              onChange={(event) => {
                const next = Array.from(event.target.files ?? []);
                if (next.length) applyFiles(next);
              }}
            />
          </span>
        </label>

        {lockedTypeId && lockedTypeLabel ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            Required type: <span className="font-medium">{lockedTypeLabel}</span>
          </p>
        ) : null}

        {files.length ? (
          <div className="flex flex-col gap-3">
            {files.map((file, index) => {
              const typeId = typeIds[index] ?? lockedTypeId ?? "";
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium" title={file.name}>
                      {file.name}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(index)}
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="min-w-0">
                      <span className="label">Document type</span>
                      {lockedTypeId ? (
                        <p className="mt-1 truncate text-sm font-medium">
                          {lockedTypeLabel || typeOptions.find((option) => option.value === typeId)?.label}
                        </p>
                      ) : (
                        <div className="mt-1 flex items-end gap-2">
                          <div className="min-w-0 flex-1">
                            <ThemedSelect
                              portaled
                              value={typeId}
                              onChange={(value) =>
                                setTypeIds((current) =>
                                  current.map((item, i) => (i === index ? value : item)),
                                )
                              }
                              placeholder="Select a type"
                              options={typeOptions}
                            />
                          </div>
                          {index === 0 ? (
                            <InlineDocumentTypeCreator
                              onCreated={(type) =>
                                setTypeIds((current) =>
                                  current.map((item, i) =>
                                    i === index ? String(type.id) : item,
                                  ),
                                )
                              }
                            />
                          ) : null}
                        </div>
                      )}
                    </label>
                    <label className="min-w-0">
                      <span className="label">
                        Issue date
                        {typeRequiresIssueDate(typeId, documentTypes) ? " (required)" : ""}
                      </span>
                      <Input
                        type="date"
                        className="mt-1"
                        required={typeRequiresIssueDate(typeId, documentTypes)}
                        value={issueDates[index] ?? ""}
                        onChange={(event) =>
                          setIssueDates((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    </label>
                    {typeRequiresExpiry(typeId, documentTypes) ? (
                      <label className="min-w-0">
                        <span className="label">Expiry date (required)</span>
                        <Input
                          type="date"
                          className="mt-1"
                          required
                          value={expiryDates[index] ?? ""}
                          onChange={(event) =>
                            setExpiryDates((current) =>
                              current.map((item, i) =>
                                i === index ? event.target.value : item,
                              ),
                            )
                          }
                        />
                      </label>
                    ) : null}
                    <label className="min-w-0 sm:col-span-2">
                      <span className="label">
                        Description
                        {typeRequiresDescription(typeId, documentTypes)
                          ? " (required)"
                          : ""}
                      </span>
                      <Input
                        className="mt-1"
                        required={typeRequiresDescription(typeId, documentTypes)}
                        placeholder={
                          typeRequiresDescription(typeId, documentTypes)
                            ? "Required"
                            : "Optional"
                        }
                        value={descriptions[index] ?? ""}
                        onChange={(event) =>
                          setDescriptions((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            {!lockedTypeId && files.length > 1 ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-40 flex-1">
                  <span className="label">Use one type for all files</span>
                  <ThemedSelect
                    portaled
                    value={bulkTypeId}
                    onChange={setBulkTypeId}
                    placeholder="Select a type"
                    options={typeOptions}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!bulkTypeId}
                  onClick={() => setTypeIds(files.map(() => bulkTypeId))}
                >
                  Apply to all
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {progress ? (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{progress}</p>
        ) : null}
        {displayError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{displayError}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || Boolean(blockReason)}>
            {pending ? "Uploading..." : submitLabel || "Upload documents"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
