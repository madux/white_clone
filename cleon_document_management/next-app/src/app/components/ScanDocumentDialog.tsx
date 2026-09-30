"use client";

import { useRef, useState } from "react";
import type { DocumentUploadPayload } from "./DocumentUploadModal";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import { Button } from "@/components/ui/button";
import { useDocumentTypes } from "../../../hooks/useDocuments";

export default function ScanDocumentDialog({
  pending,
  onClose,
  onSubmit,
}: {
  pending?: boolean;
  onClose: () => void;
  onSubmit: (payload: DocumentUploadPayload) => Promise<void>;
}) {
  const types = useDocumentTypes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState("");
  const options = (types.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));

  const submit = async () => {
    if (!file || !typeId) return;
    await onSubmit({
      files: [file],
      documentTypeIds: [typeId],
      expiryDates: [""],
      issueDates: [""],
      descriptions: ["Scanned document"],
    });
  };

  return (
    <ModalDialog
      title="Scan document"
      eyebrow="Organizational files"
      description="Capture from camera or choose an image. Nothing is saved until you confirm."
      onClose={onClose}
      size="md"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        {file ? file.name : "Capture or choose file"}
      </Button>
      <label className="mt-3 block space-y-1 text-sm">
        <span className="font-semibold">Document type</span>
        <ThemedSelect value={typeId} onChange={setTypeId} options={options} />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!file || !typeId || pending} onClick={() => void submit()}>
          {pending ? "Saving…" : "Save scan"}
        </Button>
      </div>
    </ModalDialog>
  );
}
