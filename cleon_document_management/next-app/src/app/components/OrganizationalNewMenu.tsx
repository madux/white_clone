"use client";

import {
  CloudOff,
  FilePlus2,
  FolderKanban,
  FolderPlus,
  Link2,
  ScanLine,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import CloudImportDialog from "./CloudImportDialog";
import type { DocDocument, DocFolder } from "../../../lib/types";
import type { DocumentUploadPayload } from "./DocumentUploadModal";
import DocumentUploadModal from "./DocumentUploadModal";
import CreateNamedFolderDialog from "./CreateNamedFolderDialog";
import LinkFileDialog from "./LinkFileDialog";
import NewMenu, { type NewMenuGroup, type NewMenuItem } from "./NewMenu";
import ScanDocumentDialog from "./ScanDocumentDialog";
import { useDocumentTypes, useUploadDocument } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { offlineMessage, useOnlineStatus } from "../../../lib/useOnlineStatus";
import { CLOUD_SOURCE_OPTIONS } from "./CloudSourceLogos";
import CreatePolicyFolderDialog from "./CreatePolicyFolderDialog";
import PolicyFolderDocumentOptions from "./PolicyFolderDocumentOptions";

export type OrgLibraryRootTab = "folders" | "policies";

export default function OrganizationalNewMenu({
  parentFolder,
  folderLocked = false,
  canUpload,
  canCreateFolder,
  canCreatePolicy,
  onCreateRootFolder,
  folderDocuments,
  libraryTab = "folders",
}: {
  parentFolder?: DocFolder | null;
  folderLocked?: boolean;
  canUpload: boolean;
  canCreateFolder: boolean;
  canCreatePolicy: boolean;
  onCreateRootFolder?: () => void;
  folderDocuments?: DocDocument[];
  /** When + New is used on the org library root (no open folder). */
  libraryTab?: OrgLibraryRootTab;
}) {
  const types = useDocumentTypes();
  const upload = useUploadDocument();
  const { showAlert } = useAppDialog();
  const online = useOnlineStatus();
  const [showUpload, setShowUpload] = useState(false);
  const [namedKind, setNamedKind] = useState<"folder" | "project" | "vendor" | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [importProvider, setImportProvider] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const folderId = parentFolder?.id;
  const inFolder = Boolean(folderId);
  const canAddFiles = inFolder && canUpload && !folderLocked;
  const isPolicyFolder = parentFolder?.folder_kind === "policy";

  useEffect(() => {
    const provider = searchParams.get("cloud_oauth");
    if (provider && folderId && searchParams.get("cloud_oauth_ok") === "1") {
      setImportProvider(provider);
    }
  }, [folderId, searchParams]);

  const guardOnline = async () => {
    if (online) return true;
    await showAlert(offlineMessage(), { title: "You're offline" });
    return false;
  };

  const performUpload = async (payload: DocumentUploadPayload, asTemplate = false) => {
    if (!(await guardOnline())) return;
    if (!folderId || !canUpload || folderLocked) {
      await showAlert(
        folderLocked ? "This folder is locked." : "You do not have permission to upload into this folder.",
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
      folder_id: folderId,
      document_type_ids: payload.documentTypeIds.map(Number),
      expiry_dates: payload.expiryDates,
      issue_dates: payload.issueDates,
      descriptions: payload.descriptions,
      is_template: asTemplate,
    });
    setShowUpload(false);
    setShowScan(false);
    setCreatingTemplate(false);
  };

  if (isPolicyFolder && parentFolder) {
    return (
      <PolicyFolderDocumentOptions
        folder={parentFolder}
        canUpload={canUpload}
        folderLocked={folderLocked}
        asMenu
      />
    );
  }

  const uploadItems: NewMenuItem[] = [];
  if (canAddFiles) {
    uploadItems.push({
      label: "Upload file",
      icon: FilePlus2,
      onSelect: () => {
        void (async () => {
          if (await guardOnline()) setShowUpload(true);
        })();
      },
    });
  }

  const createItems: NewMenuItem[] = [];
  const atLibraryRoot = !inFolder;
  const onPoliciesTab = atLibraryRoot && libraryTab === "policies";

  if (canCreateFolder && !folderLocked) {
    if (atLibraryRoot) {
      if (!onPoliciesTab) {
        if (onCreateRootFolder) {
          createItems.push({
            label: "Create folder",
            icon: FolderPlus,
            onSelect: () => onCreateRootFolder(),
          });
        }
        createItems.push(
          {
            label: "Create project",
            icon: FolderKanban,
            onSelect: () => setNamedKind("project"),
          },
          {
            label: "Create vendor",
            icon: Store,
            onSelect: () => setNamedKind("vendor"),
          },
        );
      }
    } else {
      createItems.push(
        {
          label: "Create folder",
          icon: FolderPlus,
          onSelect: () => setNamedKind("folder"),
        },
        {
          label: "Create project",
          icon: FolderKanban,
          onSelect: () => setNamedKind("project"),
        },
        {
          label: "Create vendor",
          icon: Store,
          onSelect: () => setNamedKind("vendor"),
        },
      );
    }
  }
  if (canAddFiles) {
    createItems.push({
      label: "Create from template",
      icon: FilePlus2,
      disabled: true,
      reason: "Templates & Forms module coming soon",
      onSelect: () => undefined,
    });
    createItems.push({
      label: "Create template",
      icon: FilePlus2,
      onSelect: () => setCreatingTemplate(true),
    });
  }
  if (canCreatePolicy && !folderLocked && (inFolder || atLibraryRoot)) {
    createItems.push({
      label: "Create policy",
      icon: ShieldCheck,
      onSelect: () => {
        void (async () => {
          if (await guardOnline()) setShowCreatePolicy(true);
        })();
      },
    });
  }

  const otherItems: NewMenuItem[] = [];
  if (canAddFiles) {
    otherItems.push({
      label: "Link a file",
      icon: Link2,
      onSelect: () => {
        void (async () => {
          if (await guardOnline()) setShowLink(true);
        })();
      },
    });
    otherItems.push({
      label: "Scan document",
      icon: ScanLine,
      onSelect: () => {
        void (async () => {
          if (await guardOnline()) setShowScan(true);
        })();
      },
    });
    otherItems.push({
      label: "Import from",
      icon: CloudOff,
      onSelect: () => undefined,
      children: CLOUD_SOURCE_OPTIONS.map((item) => ({
        label: item.label,
        icon: item.icon,
        onSelect: () => {
          void (async () => {
            if (await guardOnline()) setImportProvider(item.provider);
          })();
        },
      })),
    });
  }

  const groups: NewMenuGroup[] = [
    { label: "Upload", items: uploadItems },
    { label: "Create", items: createItems },
    { label: "Other", items: otherItems },
  ].filter((group) => group.items.length);

  if (!groups.length) return null;

  return (
    <>
      <NewMenu groups={groups} />
      {showUpload && folderId ? (
        <DocumentUploadModal
          draftKey={`org-upload-${folderId}`}
          zIndex={80}
          title="Upload documents"
          eyebrow="Organizational files"
          documentTypes={types.data ?? []}
          pending={upload.isPending}
          onClose={() => setShowUpload(false)}
          onSubmit={performUpload}
        />
      ) : null}
      {creatingTemplate && folderId ? (
        <DocumentUploadModal
          title="Create template"
          eyebrow="Templates & Forms"
          description="Upload the master template. Organizational Files generates operational copies from it later."
          documentTypes={types.data ?? []}
          pending={upload.isPending}
          onClose={() => setCreatingTemplate(false)}
          onSubmit={(payload) => performUpload(payload, true)}
        />
      ) : null}
      {showScan && folderId ? (
        <ScanDocumentDialog
          pending={upload.isPending}
          onClose={() => setShowScan(false)}
          onSubmit={performUpload}
        />
      ) : null}
      {namedKind ? (
        <CreateNamedFolderDialog
          kind={namedKind}
          parentFolder={parentFolder}
          onClose={() => setNamedKind(null)}
        />
      ) : null}
      {showLink && folderId ? (
        <LinkFileDialog folderId={folderId} onClose={() => setShowLink(false)} />
      ) : null}
      {showCreatePolicy ? (
        <CreatePolicyFolderDialog
          parentFolder={parentFolder ?? null}
          onClose={() => setShowCreatePolicy(false)}
        />
      ) : null}
      {importProvider && folderId ? (
        <CloudImportDialog
          folderId={folderId}
          provider={importProvider}
          onClose={() => setImportProvider(null)}
        />
      ) : null}
    </>
  );
}
