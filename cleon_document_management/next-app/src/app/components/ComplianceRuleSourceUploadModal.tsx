"use client";

import { useEffect, useMemo, useState } from "react";
import { useFolders, useUploadDocument } from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import type { DocumentType } from "../../../lib/types";
import DocumentUploadModal, {
  type DocumentUploadPayload,
} from "./DocumentUploadModal";
import FolderPickerDialog from "./FolderPickerDialog";
import { useAppDialog } from "../../../hooks/useAppDialog";

export default function ComplianceRuleSourceUploadModal({
  policyId,
  defaultFolderId,
  documentTypes,
  replaceExisting,
  onClose,
  onLinked,
}: {
  policyId: number;
  defaultFolderId?: number | false;
  documentTypes: DocumentType[];
  replaceExisting?: boolean;
  onClose: () => void;
  onLinked: () => void | Promise<void>;
}) {
  const folders = useFolders();
  const upload = useUploadDocument();
  const { showAlert } = useAppDialog();
  const [folderId, setFolderId] = useState<number | false | null>(
    defaultFolderId ? Number(defaultFolderId) : null,
  );
  const [pickFolderOpen, setPickFolderOpen] = useState(!defaultFolderId);

  const folderList = useMemo(() => folders.data ?? [], [folders.data]);

  useEffect(() => {
    if (defaultFolderId && !folderId) {
      setFolderId(Number(defaultFolderId));
      setPickFolderOpen(false);
    }
  }, [defaultFolderId, folderId]);

  const performUpload = async (payload: DocumentUploadPayload) => {
    if (folderId === null || folderId === false) {
      await showAlert("Choose an organizational folder first.", {
        title: "Upload",
      });
      return;
    }
    try {
      if (replaceExisting) {
        await api.unlinkPolicyDocument(policyId);
      }
      const result = await upload.mutateAsync({
        files: payload.files,
        folder_id: Number(folderId),
        document_type_ids: payload.documentTypeIds.map(Number),
        expiry_dates: payload.expiryDates,
        issue_dates: payload.issueDates,
        descriptions: payload.descriptions,
      });
      const docId = Number(result.data?.id || 0);
      if (!docId) {
        throw new Error("Upload succeeded but no document id was returned.");
      }
      const linkResult = await api.linkPolicyDocument(policyId, docId);
      if (!linkResult.success) {
        throw new Error(linkResult.message || "Unable to link uploaded file.");
      }
      await onLinked();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Upload failed.";
      await showAlert(message, { title: "Upload source document" });
      throw error;
    }
  };

  if (pickFolderOpen) {
    return (
      <FolderPickerDialog
        title="Choose upload folder"
        folders={folderList}
        confirmLabel="Continue"
        onClose={onClose}
        onPick={(id) => {
          if (id === false) {
            void showAlert("Select a folder inside the organizational library.", {
              title: "Upload",
            });
            return;
          }
          setFolderId(id);
          setPickFolderOpen(false);
        }}
      />
    );
  }

  return (
    <DocumentUploadModal
      title="Upload source document"
      eyebrow="Policy"
      description="Upload a file to the organizational library and link it to this policy."
      documentTypes={documentTypes}
      draftKey={`policy-source-upload-${policyId}`}
      zIndex={80}
      pending={upload.isPending}
      submitLabel="Upload and link"
      onClose={onClose}
      onSubmit={performUpload}
    />
  );
}
