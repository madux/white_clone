"use client";

import { Plus, Upload, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useCreateDocumentType,
  useCurrentUser,
  useSettings,
} from "../../../hooks/useDocuments";
import type { DocumentType } from "../../../lib/types";
import {
  firstUploadMetadataError,
  typeRequiresDescription,
  typeRequiresExpiry,
  typeRequiresIssueDate,
} from "../../../lib/uploadMetadataHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearDocumentUploadDraft,
  readDocumentUploadDraft,
  writeDocumentUploadDraft,
} from "../../../lib/documentUploadDraft";
import DocumentTypeFormDialog, {
  emptyDocumentTypeForm,
  type DocumentTypeFormValues,
} from "./DocumentTypeForm";
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
  draftKey,
  zIndex = 50,
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
  draftKey?: string;
  zIndex?: number;
  onClose: () => void;
  onSubmit: (payload: DocumentUploadPayload) => Promise<void>;
}) {
  const savedDraft = draftKey ? readDocumentUploadDraft(draftKey) : undefined;
  const [files, setFiles] = useState<File[]>(() => savedDraft?.files ?? []);
  const [typeIds, setTypeIds] = useState<string[]>(() => savedDraft?.typeIds ?? []);
  const [expiryDates, setExpiryDates] = useState<string[]>(
    () => savedDraft?.expiryDates ?? [],
  );
  const [issueDates, setIssueDates] = useState<string[]>(
    () => savedDraft?.issueDates ?? [],
  );
  const [descriptions, setDescriptions] = useState<string[]>(
    () => savedDraft?.descriptions ?? [],
  );
  const [bulkTypeId, setBulkTypeId] = useState(
    () => savedDraft?.bulkTypeId ?? lockedTypeId ?? "",
  );
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");
  const [createdTypes, setCreatedTypes] = useState<DocumentType[]>([]);
  const [newTypeFileIndex, setNewTypeFileIndex] = useState<number | null>(null);
  const [newTypeForm, setNewTypeForm] = useState<DocumentTypeFormValues>(
    emptyDocumentTypeForm(),
  );
  const [newTypeError, setNewTypeError] = useState("");
  const user = useCurrentUser();
  const createDocumentType = useCreateDocumentType();
  const typeCreatorOpen = newTypeFileIndex !== null;
  const typeSettings = useSettings(typeCreatorOpen);
  const canCreateDocumentType = user.data?.is_document_manager === true;

  useEffect(() => {
    if (!draftKey) return;
    writeDocumentUploadDraft(draftKey, {
      files,
      typeIds,
      expiryDates,
      issueDates,
      descriptions,
      bulkTypeId,
    });
  }, [draftKey, files, typeIds, expiryDates, issueDates, descriptions, bulkTypeId]);

  useEffect(() => {
    if (lockedTypeId) setBulkTypeId(lockedTypeId);
  }, [lockedTypeId]);

  const dismiss = () => {
    if (draftKey) clearDocumentUploadDraft(draftKey);
    onClose();
  };

  const allDocumentTypes = useMemo(() => {
    const byId = new Map(documentTypes.map((type) => [type.id, type]));
    for (const type of createdTypes) {
      byId.set(type.id, type);
    }
    return Array.from(byId.values());
  }, [createdTypes, documentTypes]);

  const typeOptions = useMemo(
    () =>
      allDocumentTypes.map((type) => ({ value: String(type.id), label: type.name })),
    [allDocumentTypes],
  );

  const openNewTypeDialog = (fileIndex: number) => {
    setNewTypeError("");
    setNewTypeForm(emptyDocumentTypeForm());
    setNewTypeFileIndex(fileIndex);
  };

  const closeNewTypeDialog = () => {
    setNewTypeFileIndex(null);
    setNewTypeError("");
    setNewTypeForm(emptyDocumentTypeForm());
  };

  const submitNewDocumentType = async (event: FormEvent) => {
    event.preventDefault();
    if (newTypeFileIndex === null) return;
    if (!newTypeForm.name.trim()) {
      setNewTypeError("Enter a name for the document type.");
      return;
    }
    setNewTypeError("");
    try {
      const result = await createDocumentType.mutateAsync({
        name: newTypeForm.name.trim(),
        category: newTypeForm.category,
        description: newTypeForm.description,
        is_mandatory_default: newTypeForm.is_mandatory_default,
        expiry_applicable: newTypeForm.expiry_applicable,
        require_upload_approval: newTypeForm.require_upload_approval,
        require_issue_date: newTypeForm.require_issue_date,
        require_description: newTypeForm.require_description,
        enable_versioning: newTypeForm.enable_versioning,
        duplicate_detection_mode: newTypeForm.duplicate_detection_mode,
        approval_flow: newTypeForm.approval_flow,
        approver_ids: newTypeForm.approver_ids,
        default_retention_years: newTypeForm.default_retention_years,
      });
      if (!result.success || !result.data) {
        setNewTypeError(result.message || "The document type could not be created.");
        return;
      }
      const created = result.data;
      setCreatedTypes((current) =>
        current.some((item) => item.id === created.id)
          ? current
          : [...current, created],
      );
      const targetIndex = newTypeFileIndex;
      setTypeIds((current) =>
        current.map((item, index) =>
          index === targetIndex ? String(created.id) : item,
        ),
      );
      closeNewTypeDialog();
    } catch (caught: unknown) {
      const message =
        caught instanceof Error
          ? caught.message
          : "The document type could not be created.";
      setNewTypeError(message);
    }
  };

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
          allDocumentTypes,
        );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blockReason) {
      setLocalError(blockReason);
      return;
    }
    setLocalError("");
    try {
      await onSubmit({
        files,
        documentTypeIds: typeIds,
        expiryDates,
        issueDates,
        descriptions,
      });
      if (draftKey) clearDocumentUploadDraft(draftKey);
    } catch (caught: unknown) {
      const message =
        caught instanceof Error ? caught.message : "Upload failed.";
      setLocalError(message);
    }
  };

  const displayError = localError || error;

  return (
    <>
    <ModalDialog
      title={title}
      eyebrow={eyebrow}
      description={description}
      onClose={dismiss}
      size="lg"
      zIndex={zIndex}
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
                          {canCreateDocumentType && index === 0 ? (
                            <button
                              type="button"
                              onClick={() => openNewTypeDialog(index)}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-pink hover:underline"
                            >
                              <Plus className="h-3.5 w-3.5" /> New type
                            </button>
                          ) : null}
                        </div>
                      )}
                    </label>
                    <label className="min-w-0">
                      <span className="label">
                        Issue date
                        {typeRequiresIssueDate(typeId, allDocumentTypes) ? " (required)" : ""}
                      </span>
                      <Input
                        type="date"
                        className="mt-1"
                        required={typeRequiresIssueDate(typeId, allDocumentTypes)}
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
                    {typeRequiresExpiry(typeId, allDocumentTypes) ? (
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
                        {typeRequiresDescription(typeId, allDocumentTypes)
                          ? " (required)"
                          : ""}
                      </span>
                      <Input
                        className="mt-1"
                        required={typeRequiresDescription(typeId, allDocumentTypes)}
                        placeholder={
                          typeRequiresDescription(typeId, allDocumentTypes)
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
          <Button type="button" variant="ghost" onClick={dismiss}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || Boolean(blockReason)}>
            {pending ? "Uploading..." : submitLabel || "Upload documents"}
          </Button>
        </div>
      </form>
    </ModalDialog>
    {typeCreatorOpen && typeof document !== "undefined"
      ? createPortal(
          <DocumentTypeFormDialog
            form={newTypeForm}
            setForm={setNewTypeForm}
            onClose={closeNewTypeDialog}
            onSubmit={submitNewDocumentType}
            saving={createDocumentType.isPending}
            allApprovers={typeSettings.data?.approvers ?? []}
            error={newTypeError}
            zIndex={zIndex + 10}
            submitLabel="Add type"
          />,
          document.body,
        )
      : null}
    </>
  );
}
