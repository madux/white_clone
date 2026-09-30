"use client";

import { FolderInput } from "lucide-react";
import { useMemo, useState } from "react";
import { useMoveDocuments } from "../../../hooks/useDocuments";
import type { DocFolder } from "../../../lib/types";
import FolderTreePicker from "./FolderTreePicker";
import ModalDialog from "./ModalDialog";

type Folder = Pick<
  DocFolder,
  "id" | "folder_name" | "folder_type" | "parent_id" | "collection_code"
>;

export default function MoveDocumentsDialog({
  documentIds,
  folders,
  folderType,
  onClose,
  onMoved,
}: {
  documentIds: number[];
  folders: Folder[];
  folderType: "employee" | "organizational";
  onClose: () => void;
  onMoved: () => void;
}) {
  const move = useMoveDocuments();
  const [destinationId, setDestinationId] = useState<number | false | "">("");
  const [error, setError] = useState("");
  const destinations = useMemo(
    () => folders.filter((folder) => folder.folder_type === folderType),
    [folderType, folders],
  );

  const submit = async () => {
    if (destinationId === "" || destinationId === false) return;
    setError("");
    try {
      const result = await move.mutateAsync({
        document_ids: documentIds,
        destination_folder_id: Number(destinationId),
      });
      if (!result.success) throw new Error(result.message);
      onMoved();
    } catch (caught: any) {
      setError(caught?.message || "The documents could not be moved.");
    }
  };

  return (
    <ModalDialog
      title="Choose a destination folder"
      onClose={onClose}
      size="md"
      zIndex={120}
      titleClassName="text-xl"
    >
      {destinations.length ? (
        <FolderTreePicker
          folders={destinations as DocFolder[]}
          folderType={folderType}
          value={destinationId}
          onChange={setDestinationId}
        />
      ) : (
        <p className="text-sm text-slate-500">No compatible folders available.</p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={destinationId === "" || destinationId === false || move.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          <FolderInput className="h-4 w-4" />
          {move.isPending ? "Moving..." : "Move documents"}
        </button>
      </div>
    </ModalDialog>
  );
}
