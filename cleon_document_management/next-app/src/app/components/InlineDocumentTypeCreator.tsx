"use client";

import { Plus } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  useCreateDocumentType,
  useCurrentUser,
  useSettings,
} from "../../../hooks/useDocuments";
import type { DocumentType } from "../../../lib/types";
import DocumentTypeFormDialog, {
  emptyDocumentTypeForm,
  type DocumentTypeFormValues,
} from "./DocumentTypeForm";

export default function InlineDocumentTypeCreator({
  onCreated,
}: {
  onCreated: (type: DocumentType) => void;
}) {
  const user = useCurrentUser();
  const create = useCreateDocumentType();
  const [open, setOpen] = useState(false);
  const settings = useSettings(open);
  const [form, setForm] = useState<DocumentTypeFormValues>(emptyDocumentTypeForm());
  const [error, setError] = useState("");
  const canCreate = user.data?.is_document_manager === true;

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    setForm(emptyDocumentTypeForm());
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a name for the document type.");
      return;
    }
    setError("");
    try {
      const result = await create.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        description: form.description,
        is_mandatory_default: form.is_mandatory_default,
        expiry_applicable: form.expiry_applicable,
        require_upload_approval: form.require_upload_approval,
        require_issue_date: form.require_issue_date,
        require_description: form.require_description,
        enable_versioning: form.enable_versioning,
        duplicate_detection_mode: form.duplicate_detection_mode,
        approval_flow: form.approval_flow,
        approver_ids: form.approver_ids,
        default_retention_years: form.default_retention_years,
      });
      const response = result as {
        success: boolean;
        data?: DocumentType;
        message?: string;
      };
      if (!response.success || !response.data) {
        setError(response.message || "The document type could not be created.");
        return;
      }
      onCreated(response.data);
      close();
    } catch (caught: any) {
      setError(caught?.message || "The document type could not be created.");
    }
  };

  if (!canCreate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setForm(emptyDocumentTypeForm());
          setOpen(true);
        }}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-pink hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> New type
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <DocumentTypeFormDialog
              form={form}
              setForm={setForm}
              onClose={close}
              onSubmit={submit}
              saving={create.isPending}
              allApprovers={settings.data?.approvers ?? []}
              error={error}
              zIndex={90}
              submitLabel="Add type"
            />,
            document.body,
          )
        : null}
    </>
  );
}
