"use client";

import { FolderInput, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMoveRecycledFolderDocuments } from "../../../hooks/useDocuments";
import type { DocFolder } from "../../../lib/types";
import ModalDialog from "./ModalDialog";

type RecycledFolder = {
  id: number;
  folder_name: string;
  folder_type: "employee" | "organizational";
  linked_document_count?: number;
};

export default function MoveRecycledFolderDocumentsDialog({
  folder,
  folders,
  onClose,
  onMoved,
}: {
  folder: RecycledFolder;
  folders: DocFolder[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const move = useMoveRecycledFolderDocuments();
  const [destinationId, setDestinationId] = useState("");
  const [error, setError] = useState("");
  const linkedCount = folder.linked_document_count ?? 0;
  const destinations = useMemo(
    () =>
      folders.filter(
        (item) =>
          item.folder_type === folder.folder_type &&
          item.active !== false &&
          item.id !== folder.id,
      ),
    [folder.folder_type, folder.id, folders],
  );

  useEffect(() => {
    setDestinationId(destinations[0] ? String(destinations[0].id) : "");
  }, [destinations]);

  const submitMove = async () => {
    if (!destinationId) return;
    setError("");
    try {
      const result = await move.mutateAsync({
        folder_id: folder.id,
        destination_folder_id: Number(destinationId),
      });
      if (!result.success) throw new Error(result.message);
      onMoved();
    } catch (caught: any) {
      setError(caught?.message || "The documents could not be moved.");
    }
  };

  const submitRelease = async () => {
    setError("");
    try {
      const result = await move.mutateAsync({
        folder_id: folder.id,
        release_only: true,
      });
      if (!result.success) throw new Error(result.message);
      onMoved();
    } catch (caught: any) {
      setError(caught?.message || "The documents could not be released.");
    }
  };

  return (
    <ModalDialog
      title="Move documents before delete"
      eyebrow="Recycle bin"
      description={`${linkedCount} document${linkedCount === 1 ? "" : "s"} linked to "${folder.folder_name}". Move them before permanently deleting this folder.`}
      onClose={onClose}
      size="md"
      zIndex={120}
      titleClassName="text-xl"
    >
      {folder.folder_type === "employee" && !destinations.length ? (
        <div className="space-y-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            There is no active employee folder to move these files into yet. They are already
            safe in <strong>Pending Employee Uploads</strong> and remain visible to employees in
            My Documents.
          </p>
          <p>
            You can keep them there until a department folder exists, or{" "}
            <Link href="/pages/employee" className="font-semibold underline">
              create an employee folder
            </Link>{" "}
            first and then move the files.
          </p>
        </div>
      ) : (
        <label className="block">
          <span className="label">Destination folder</span>
          <select
            value={destinationId}
            onChange={(event) => setDestinationId(event.target.value)}
            className="field"
            disabled={move.isPending || !destinations.length}
          >
            {!destinations.length && (
              <option value="">No compatible folders available</option>
            )}
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.folder_name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
        >
          Cancel
        </button>
        {folder.folder_type === "employee" && (
          <button
            type="button"
            onClick={submitRelease}
            disabled={move.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 disabled:opacity-50"
          >
            <Inbox className="h-4 w-4" />
            {move.isPending ? "Saving..." : "Keep in pending uploads"}
          </button>
        )}
        {destinations.length > 0 && (
          <button
            type="button"
            onClick={submitMove}
            disabled={!destinationId || move.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            <FolderInput className="h-4 w-4" />
            {move.isPending ? "Moving..." : "Move documents"}
          </button>
        )}
      </div>
    </ModalDialog>
  );
}
