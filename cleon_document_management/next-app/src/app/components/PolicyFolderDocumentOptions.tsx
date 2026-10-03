"use client";

import { FilePlus2, FileSearch, FileText } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DocFolder, OrganizationalPolicy } from "../../../lib/types";
import { api } from "../../../lib/api";
import { useDocumentTypes, useUploadDocument } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { offlineMessage, useOnlineStatus } from "../../../lib/useOnlineStatus";
import DocumentUploadModal from "./DocumentUploadModal";
import type { DocumentUploadPayload } from "./DocumentUploadModal";
import PolicyFolderCreateCustomDialog from "./PolicyFolderCreateCustomDialog";
import PolicyFolderSelectExistingDialog from "./PolicyFolderSelectExistingDialog";
import NewMenu, { type NewMenuGroup } from "./NewMenu";

type PolicyFolderDocumentOptionsProps = {
  folder: DocFolder;
  canUpload: boolean;
  folderLocked?: boolean;
  /** Compact + New menu; false = empty-state cards */
  asMenu?: boolean;
};

export function PolicyFolderChooserCards({
  disabled,
  onUpload,
  onSelectExisting,
  onCreateCustom,
}: {
  disabled?: boolean;
  onUpload: () => void;
  onSelectExisting: () => void;
  onCreateCustom: () => void;
}) {
  const items = [
    {
      title: "Upload Document",
      description: "Upload a PDF or file into this policy folder.",
      onClick: onUpload,
      icon: FilePlus2,
    },
    {
      title: "Select Existing",
      description:
        "Add files from the library. They move into this policy folder from their current location.",
      onClick: onSelectExisting,
      icon: FileSearch,
    },
    {
      title: "Create Custom",
      description: "Start a blank policy document you can fill in later.",
      onClick: onCreateCustom,
      icon: FileText,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          disabled={disabled}
          onClick={item.onClick}
          className="rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-pink disabled:opacity-50"
        >
          <item.icon className="mb-2 h-5 w-5 text-brand-pink" aria-hidden />
          <strong className="block text-sm text-slate-900">{item.title}</strong>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
        </button>
      ))}
    </div>
  );
}

export default function PolicyFolderDocumentOptions({
  folder,
  canUpload,
  folderLocked = false,
  asMenu = false,
}: PolicyFolderDocumentOptionsProps) {
  const types = useDocumentTypes();
  const upload = useUploadDocument();
  const { showAlert } = useAppDialog();
  const online = useOnlineStatus();
  const [showUpload, setShowUpload] = useState(false);
  const [showSelectExisting, setShowSelectExisting] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);

  const policyQuery = useQuery({
    queryKey: ["organizational-policy-by-folder", folder.id],
    queryFn: async () => {
      const result = await api.listOrganizationalPolicies({});
      if (!result.success) {
        throw new Error(result.message || "Unable to load policy.");
      }
      return (result.data?.items ?? []).find(
        (item) => item.folder_id === folder.id,
      ) as OrganizationalPolicy | undefined;
    },
  });

  const policy = policyQuery.data;
  const actionsDisabled = !canUpload || folderLocked || upload.isPending;

  const guardOnline = async () => {
    if (online) return true;
    await showAlert(offlineMessage(), { title: "You're offline" });
    return false;
  };

  const openUpload = () => {
    void (async () => {
      if (!(await guardOnline())) return;
      setShowUpload(true);
    })();
  };

  const openSelectExisting = () => {
    if (!policy) {
      void showAlert("Policy registry row not found for this folder.", {
        title: "Select existing",
      });
      return;
    }
    setShowSelectExisting(true);
  };

  const openCreateCustom = () => {
    void (async () => {
      if (!(await guardOnline())) return;
      setShowCreateCustom(true);
    })();
  };

  const performUpload = async (payload: DocumentUploadPayload) => {
    if (!(await guardOnline())) return;
    if (!canUpload || folderLocked) {
      await showAlert(
        folderLocked ? "This folder is locked." : "You cannot upload into this folder.",
        { title: "Unable to upload" },
      );
      return;
    }
    if (!payload.files.length || payload.documentTypeIds.some((id) => !id)) {
      await showAlert("Choose files and a document type for each file.", {
        title: "Unable to upload",
      });
      return;
    }
    await upload.mutateAsync({
      files: payload.files,
      folder_id: folder.id,
      document_type_ids: payload.documentTypeIds.map(Number),
      expiry_dates: payload.expiryDates,
      issue_dates: payload.issueDates,
      descriptions: payload.descriptions,
    });
    setShowUpload(false);
  };

  const menuGroups: NewMenuGroup[] = [
    {
      label: "Policy documents",
      items: [
        {
          label: "Upload Document",
          icon: FilePlus2,
          disabled: actionsDisabled,
          onSelect: openUpload,
        },
        {
          label: "Select Existing",
          icon: FileSearch,
          disabled: actionsDisabled || !policy,
          reason: !policy ? "Policy registry not ready" : undefined,
          onSelect: openSelectExisting,
        },
        {
          label: "Create Custom",
          icon: FileText,
          disabled: actionsDisabled,
          onSelect: openCreateCustom,
        },
      ],
    },
  ];

  if (!canUpload && folderLocked) return null;

  return (
    <>
      {asMenu ? (
        <NewMenu groups={menuGroups} />
      ) : (
        <PolicyFolderChooserCards
          disabled={actionsDisabled}
          onUpload={openUpload}
          onSelectExisting={openSelectExisting}
          onCreateCustom={openCreateCustom}
        />
      )}
      {showUpload ? (
        <DocumentUploadModal
          draftKey={`policy-upload-${folder.id}`}
          zIndex={80}
          title="Upload Document"
          eyebrow={folder.folder_name}
          description="Files uploaded here are classified as policy documents."
          documentTypes={types.data ?? []}
          pending={upload.isPending}
          onClose={() => setShowUpload(false)}
          onSubmit={performUpload}
        />
      ) : null}
      {showSelectExisting && policy ? (
        <PolicyFolderSelectExistingDialog
          policy={policy}
          onClose={() => setShowSelectExisting(false)}
        />
      ) : null}
      {showCreateCustom ? (
        <PolicyFolderCreateCustomDialog
          folderId={folder.id}
          onClose={() => setShowCreateCustom(false)}
        />
      ) : null}
    </>
  );
}
