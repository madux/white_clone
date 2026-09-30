"use client";

import { useState } from "react";
import { useCreateDocument, useDocumentTypes } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function LinkFileDialog({
  folderId,
  onClose,
}: {
  folderId: number;
  onClose: () => void;
}) {
  const types = useDocumentTypes();
  const create = useCreateDocument();
  const { showAlert } = useAppDialog();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [typeId, setTypeId] = useState("");

  const options = (types.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));

  const submit = async () => {
    const trimmedUrl = url.trim();
    if (!name.trim()) {
      await showAlert("Enter a name for the linked file.", { title: "Unable to save" });
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      await showAlert("Enter a valid http or https URL.", { title: "Unable to save" });
      return;
    }
    const documentTypeId = Number(typeId || options[0]?.value);
    if (!documentTypeId) {
      await showAlert("Choose a document type.", { title: "Unable to save" });
      return;
    }
    const result = await create.mutateAsync({
      name: name.trim(),
      folder_id: folderId,
      document_type_id: documentTypeId,
      source_url: trimmedUrl,
      description: trimmedUrl,
    });
    if (!result.success) {
      await showAlert(result.message || "Unable to save the linked file.", {
        title: "Unable to save",
      });
      return;
    }
    onClose();
  };

  return (
    <ModalDialog
      title="Link a file"
      eyebrow="Organizational files"
      description="Store a named URL in this folder. The link is saved as a document record."
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">URL</span>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Document type</span>
          <ThemedSelect
            value={typeId || options[0]?.value || ""}
            onChange={setTypeId}
            options={options}
            placeholder="Select type"
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={create.isPending} onClick={() => void submit()}>
          {create.isPending ? "Saving…" : "Save link"}
        </Button>
      </div>
    </ModalDialog>
  );
}
