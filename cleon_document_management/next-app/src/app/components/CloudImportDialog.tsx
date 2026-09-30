"use client";

import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { QUERY_KEYS } from "../../../hooks/useDocuments";
import { useDocumentTypes } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import ModalDialog from "./ModalDialog";
import AppSelect from "./AppSelect";
import { Button } from "@/components/ui/button";
import { CLOUD_SOURCE_OPTIONS } from "./CloudSourceLogos";
import { FileTypeIcon } from "./FileTypeIcon";

type CloudFile = {
  id: string;
  name: string;
  mime_type: string;
  is_folder: boolean;
  size: number;
  modified_at: string;
};

type OauthStatusItem = {
  provider: string;
  configured: boolean;
  company_enabled: boolean;
  user_connected: boolean;
  account_label: string;
};

export default function CloudImportDialog({
  folderId,
  provider,
  onClose,
}: {
  folderId: number;
  provider: string;
  onClose: () => void;
}) {
  const label =
    CLOUD_SOURCE_OPTIONS.find((item) => item.provider === provider)?.label ||
    provider;
  const types = useDocumentTypes();
  const queryClient = useQueryClient();
  const { showAlert } = useAppDialog();
  const [status, setStatus] = useState<OauthStatusItem | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [importing, setImporting] = useState(false);

  const currentParentId =
    breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1].id : undefined;

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const result = await api.organizationalOauthStatus();
      const items = result.data?.items ?? [];
      setStatus(items.find((item) => item.provider === provider) ?? null);
    } finally {
      setLoadingStatus(false);
    }
  }, [provider]);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const result = await api.listOrganizationalCloudFiles({
        provider,
        parent_id: currentParentId,
      });
      if (!result.success) {
        await showAlert(result.message || "Unable to load files.", {
          title: label,
        });
        setFiles([]);
        return;
      }
      setFiles(result.data?.items ?? []);
    } finally {
      setLoadingFiles(false);
    }
  }, [currentParentId, label, provider, showAlert]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.user_connected) {
      void loadFiles();
    }
  }, [currentParentId, loadFiles, status?.user_connected]);

  useEffect(() => {
    const first = types.data?.[0];
    if (first && !documentTypeId) {
      setDocumentTypeId(String(first.id));
    }
  }, [documentTypeId, types.data]);

  const connect = async () => {
    const result = await api.organizationalOauthStart({
      provider,
      folder_id: folderId,
    });
    if (!result.success || !result.data?.auth_url) {
      await showAlert(result.message || "Unable to start sign-in.", {
        title: label,
      });
      return;
    }
    window.location.href = result.data.auth_url;
  };

  const openFolder = (folder: CloudFile) => {
    setBreadcrumbs((current) => [...current, { id: folder.id, name: folder.name }]);
    setSelectedFile(null);
  };

  const goToCrumb = (index: number) => {
    setBreadcrumbs((current) => current.slice(0, index + 1));
    setSelectedFile(null);
  };

  const importFile = async () => {
    if (!selectedFile || !documentTypeId) return;
    setImporting(true);
    try {
      const result = await api.importFromOrganizationalConnector({
        folder_id: folderId,
        provider,
        file_id: selectedFile.id,
        document_type_id: Number(documentTypeId),
        name: selectedFile.name,
      });
      if (!result.success) {
        await showAlert(result.message || "Import failed.", { title: label });
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(folderId),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const typeOptions = (types.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));

  return (
    <ModalDialog
      title={`Import from ${label}`}
      eyebrow="Organizational files"
      description="Sign in, pick a file, and copy it into this folder as a native document."
      onClose={onClose}
      size="lg"
    >
      {loadingStatus ? (
        <p className="text-sm text-slate-500">Checking connection…</p>
      ) : !status?.configured ? (
        <p className="text-sm text-slate-600">
          {label} OAuth is not configured yet. Ask a super admin to set{" "}
          <code className="text-xs">ORG_{provider.toUpperCase()}_CLIENT_ID</code>{" "}
          and client secret on the server.
        </p>
      ) : status.company_enabled === false ? (
        <p className="text-sm text-slate-600">
          This connector is disabled for your organization. Enable it under Super
          Admin → Integrations.
        </p>
      ) : !status.user_connected ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Connect your {label} account to browse and copy files into Cleon.
          </p>
          <Button type="button" onClick={() => void connect()}>
            Connect {label}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Connected as {status.account_label || "your account"}
          </p>
          <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <button
              type="button"
              className="font-semibold text-brand-pink hover:underline"
              onClick={() => {
                setBreadcrumbs([]);
                setSelectedFile(null);
              }}
            >
              Root
            </button>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  type="button"
                  className="font-semibold text-slate-700 hover:text-brand-pink"
                  onClick={() => goToCrumb(index)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
            {loadingFiles ? (
              <p className="p-4 text-sm text-slate-500">Loading files…</p>
            ) : files.length ? (
              <ul className="divide-y divide-slate-100">
                {files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${
                        selectedFile?.id === file.id ? "bg-pink-50" : ""
                      }`}
                      onClick={() => {
                        if (file.is_folder) {
                          openFolder(file);
                          return;
                        }
                        setSelectedFile(file);
                      }}
                    >
                      {file.is_folder ? (
                        <Folder className="h-4 w-4 shrink-0 text-brand-pink" />
                      ) : (
                        <FileTypeIcon
                          name={file.name}
                          mime_type={file.mime_type}
                          className="h-8 w-6 shrink-0"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {file.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-slate-500">This folder is empty.</p>
            )}
          </div>
          {selectedFile ? (
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Document type</span>
              <AppSelect
                value={documentTypeId}
                onChange={setDocumentTypeId}
                options={typeOptions}
                ariaLabel="Document type"
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedFile || !documentTypeId || importing}
              onClick={() => void importFile()}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Copy into folder"
              )}
            </Button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
