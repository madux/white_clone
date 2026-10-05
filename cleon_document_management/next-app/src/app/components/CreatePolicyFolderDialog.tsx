"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { DocFolder, OrganizationalPolicy } from "../../../lib/types";
import ModalDialog from "./ModalDialog";
import type { PolicyDocumentSource } from "./PolicyFolderDocumentOptions";
import AppSelect from "./AppSelect";
import type { PolicyCreateDraft } from "./PolicyAdoptSuggestedFilesDialog";
import {
  PolicyFolderChooserCards,
} from "./PolicyFolderDocumentOptions";
import PolicyCreateSelectExistingDialog from "./PolicyCreateSelectExistingDialog";
import PolicyFolderCreateCustomDialog from "./PolicyFolderCreateCustomDialog";
import DocumentUploadModal, {
  type DocumentUploadPayload,
} from "./DocumentUploadModal";
import { api } from "../../../lib/api";
import {
  QUERY_KEYS,
  useDocumentTypes,
  useUploadDocument,
} from "../../../hooks/useDocuments";
import { useToast } from "../../../hooks/useToast";
import {
  isPendingApprovalResponse,
  notifyPendingApproval,
} from "../../../lib/pendingApproval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const VISIBILITY_OPTIONS = [
  { value: "employees", label: "Visible to employees" },
  { value: "hr_only", label: "HR only" },
];

type WizardStep = "metadata" | "source";

export default function CreatePolicyFolderDialog({
  parentFolder = null,
  onClose,
}: {
  parentFolder?: DocFolder | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const upload = useUploadDocument();
  const types = useDocumentTypes();
  const { showAlert, showConfirm } = useAppDialog();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("employees");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<WizardStep>("metadata");
  const [selectedSource, setSelectedSource] = useState<PolicyDocumentSource | null>(
    null,
  );
  const [showSelectExisting, setShowSelectExisting] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [createdFolderId, setCreatedFolderId] = useState<number | null>(null);
  const [pendingCreate, setPendingCreate] = useState(false);

  const eyebrow = parentFolder ? parentFolder.folder_name : "Organizational files";

  const draft = (): PolicyCreateDraft => ({
    name: name.trim(),
    parent_folder_id: parentFolder?.id,
    category: category.trim() || undefined,
    visibility,
    effective_date: effectiveDate || undefined,
    description: description.trim() || undefined,
  });

  const goToPolicyFolder = (folderId: number) => {
    router.push(`/pages/organization/folder?folder=${folderId}`);
  };

  const finish = (folderId: number) => {
    onClose();
    goToPolicyFolder(folderId);
  };

  const handleDuplicateName = async (
    result: { data?: { policy?: OrganizationalPolicy } },
  ): Promise<number | null> => {
    const folderId = result.data?.policy?.folder_id;
    if (!folderId) return null;
    const openExisting = await showConfirm(
      "A policy with this name already exists. Open the existing policy folder?",
      {
        title: "Duplicate policy name",
        confirmLabel: "Open existing policy",
        cancelLabel: "Stay here",
      },
    );
    return openExisting ? folderId : null;
  };

  const ensureEmptyPolicyFolder = async (): Promise<number | null> => {
    if (createdFolderId) return createdFolderId;
    setPendingCreate(true);
    try {
      const result = await api.createPolicyFolder({
        name: draft().name,
        parent_folder_id: draft().parent_folder_id,
        document_ids: [],
        category: draft().category,
        visibility: draft().visibility,
        effective_date: draft().effective_date,
        description: draft().description,
      });
      if (!result.success) {
        if (result.code === "duplicate_name") {
          const existingId = await handleDuplicateName(result);
          if (existingId) finish(existingId);
          return null;
        }
        await showAlert(result.message || "Unable to create this policy.", {
          title: "Unable to create",
        });
        return null;
      }
      const folderId = result.data?.folder?.id;
      if (!folderId) {
        await showAlert("Policy was created but the folder could not be opened.", {
          title: "Unable to open folder",
        });
        return null;
      }
      setCreatedFolderId(folderId);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      await queryClient.invalidateQueries({ queryKey: ["organizational-policies"] });
      return folderId;
    } finally {
      setPendingCreate(false);
    }
  };

  const continueToSource = async () => {
    if (!name.trim()) {
      await showAlert("Enter a policy name.", { title: "Unable to continue" });
      return;
    }
    setStep("source");
  };

  const runPrimarySourceAction = async () => {
    if (!selectedSource) {
      await showAlert("Choose how to add the policy document.", {
        title: "Add policy document",
      });
      return;
    }
    if (selectedSource === "select") {
      setShowSelectExisting(true);
      return;
    }
    const folderId = await ensureEmptyPolicyFolder();
    if (!folderId) return;
    if (selectedSource === "custom") {
      setShowCreateCustom(true);
      return;
    }
    setShowUpload(true);
  };

  const primaryLabel =
    selectedSource === "custom" ? "Open editor" : "Add policy";
  const primaryEnabled =
    Boolean(name.trim()) &&
    Boolean(selectedSource) &&
    !pendingCreate &&
    !upload.isPending;

  const performUpload = async (payload: DocumentUploadPayload) => {
    const folderId = createdFolderId ?? (await ensureEmptyPolicyFolder());
    if (!folderId) return;
    if (!payload.files.length || payload.documentTypeIds.some((id) => !id)) {
      await showAlert("Choose files and a document type for each file.", {
        title: "Unable to upload",
      });
      return;
    }
    const result = await upload.mutateAsync({
      files: payload.files,
      folder_id: folderId,
      document_type_ids: payload.documentTypeIds.map(Number),
      expiry_dates: payload.expiryDates,
      issue_dates: payload.issueDates,
      descriptions: payload.descriptions,
    });
    if (isPendingApprovalResponse(result)) {
      notifyPendingApproval(result, showToast);
      setShowUpload(false);
      onClose();
      return;
    }
    setShowUpload(false);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(folderId) });
    finish(folderId);
  };

  return (
    <>
      {step === "metadata" ? (
        <ModalDialog
          title="Create policy"
          eyebrow="Organizational files"
          description={
            parentFolder
              ? `Add a policy folder inside ${parentFolder.folder_name}, then choose how to add the policy document.`
              : "Add a policy at the library root, then choose how to add the policy document."
          }
          onClose={onClose}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!name.trim()} onClick={() => void continueToSource()}>
                Continue
              </Button>
            </div>
          }
        >
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Policy name</span>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm">
            <span className="font-semibold">Category</span>
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm">
            <span className="font-semibold">Visibility</span>
            <AppSelect
              value={visibility}
              onChange={setVisibility}
              options={VISIBILITY_OPTIONS}
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm">
            <span className="font-semibold">Effective date</span>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </label>
          <label className="mt-3 block space-y-1 text-sm">
            <span className="font-semibold">Description</span>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
            />
          </label>
        </ModalDialog>
      ) : (
        <ModalDialog
          title="Add policy document"
          eyebrow={draft().name}
          description="Choose a source, then use the primary action. Upload and Select Existing create or link the policy; Create Custom opens the editor."
          size="lg"
          onClose={() => {
            if (createdFolderId) {
              finish(createdFolderId);
              return;
            }
            setStep("metadata");
            setSelectedSource(null);
          }}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("metadata");
                  setSelectedSource(null);
                }}
              >
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={pendingCreate}
                  onClick={() => void (async () => {
                    const folderId = await ensureEmptyPolicyFolder();
                    if (folderId) finish(folderId);
                  })()}
                >
                  Skip for now
                </Button>
                <Button
                  disabled={!primaryEnabled}
                  onClick={() => void runPrimarySourceAction()}
                >
                  {primaryLabel}
                </Button>
              </div>
            </div>
          }
        >
          <PolicyFolderChooserCards
            disabled={pendingCreate || upload.isPending}
            selectionMode
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            onUpload={() => undefined}
            onSelectExisting={() => undefined}
            onCreateCustom={() => undefined}
          />
        </ModalDialog>
      )}
      {showSelectExisting ? (
        <PolicyCreateSelectExistingDialog
          draft={draft()}
          eyebrow={eyebrow}
          onClose={() => setShowSelectExisting(false)}
          onCreated={(folderId) => {
            setShowSelectExisting(false);
            finish(folderId);
          }}
        />
      ) : null}
      {showCreateCustom && createdFolderId ? (
        <PolicyFolderCreateCustomDialog
          folderId={createdFolderId}
          onClose={() => {
            setShowCreateCustom(false);
            finish(createdFolderId);
          }}
        />
      ) : null}
      {showUpload && createdFolderId ? (
        <DocumentUploadModal
          draftKey={`policy-create-upload-${createdFolderId}`}
          zIndex={95}
          title="Upload document"
          eyebrow={draft().name}
          description="Files uploaded here are classified as policy documents."
          documentTypes={types.data ?? []}
          pending={upload.isPending}
          onClose={() => setShowUpload(false)}
          onSubmit={performUpload}
          submitLabel="Add policy"
        />
      ) : null}
    </>
  );
}
