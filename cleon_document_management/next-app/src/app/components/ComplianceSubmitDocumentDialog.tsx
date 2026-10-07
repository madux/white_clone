"use client";

import { useState } from "react";
import { api } from "../../../lib/api";
import type { MyComplianceInboxItem } from "../../../lib/types";
import { useSettings } from "../../../hooks/useDocuments";
import DocumentUploadModal, {
  type DocumentUploadPayload,
} from "./DocumentUploadModal";

export default function ComplianceSubmitDocumentDialog({
  item,
  mode,
  onClose,
  onSubmitted,
}: {
  item: MyComplianceInboxItem;
  mode: "upload" | "resubmit";
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const settings = useSettings();
  const documentTypes = settings.data?.document_types ?? [];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const typeId = item.document_type_id ? String(item.document_type_id) : "";
  const typeName = item.document_type_name || item.document_type || item.title;
  const due = item.due_date ? String(item.due_date).slice(0, 10) : "";

  async function handleSubmit(payload: DocumentUploadPayload) {
    setPending(true);
    setError("");
    try {
      const result = await api.submitComplianceDocument({
        files: payload.files,
        document_type_ids: payload.documentTypeIds.map((id) => Number(id)),
        policy_id: item.policy_id,
        evaluation_line_id: item.evaluation_line_id || undefined,
        replace_document_id:
          mode === "resubmit" && item.document_id
            ? Number(item.document_id)
            : undefined,
        expiry_dates: payload.expiryDates,
        issue_dates: payload.issueDates,
        descriptions: payload.descriptions,
      });
      if (
        item.kind === "task" &&
        item.task_type === "upload_evidence" &&
        item.task_id &&
        result.data?.id
      ) {
        await api.completeComplianceTask(Number(item.task_id), {
          document_id: result.data.id,
        });
      }
      onSubmitted();
      onClose();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not save your document. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <DocumentUploadModal
      title={mode === "resubmit" ? `Resubmit ${typeName}` : `Upload ${typeName}`}
      eyebrow={item.policy}
      description={
        due
          ? `Required by ${item.subtitle || item.policy} — due ${due}. Check detected values before submitting.`
          : `Required by ${item.subtitle || item.policy}.`
      }
      documentTypes={documentTypes}
      lockedTypeId={typeId}
      lockedTypeLabel={typeName}
      pending={pending}
      error={error}
      submitLabel="Submit"
      draftKey={`compliance-submit-${item.id}`}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
