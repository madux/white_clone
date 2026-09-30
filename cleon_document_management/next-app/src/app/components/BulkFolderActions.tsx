"use client";

import { Archive, Download, FolderHeart, FolderInput, Lock, Trash2, Unlock, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { useDeleteFolder, useFolderAction } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";

export default function BulkFolderActions({
  selected,
  onClear,
  organizational = false,
  onMove,
}: {
  selected: number[];
  onClear: () => void;
  organizational?: boolean;
  onMove?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const action = useFolderAction();
  const remove = useDeleteFolder();
  const { showAlert, showConfirm } = useAppDialog();
  if (!selected.length) return null;

  const runAction = async (name: "favorite" | "archive" | "lock" | "unlock") => {
    setRunning(true);
    try {
      for (const id of selected) {
        const result = await action.mutateAsync({ id, action: name });
        if (result && result.success === false) {
          await showAlert(result.message || "Unable to complete this action.", {
            title: "Bulk action",
          });
          break;
        }
      }
    } finally {
      setRunning(false);
      onClear();
    }
  };

  const downloadSelected = () => {
    selected.forEach((id) => api.downloadFolder(id));
    onClear();
  };

  const deleteSelected = async () => {
    if (
      !(await showConfirm(
        `Delete ${selected.length} selected folder${selected.length === 1 ? "" : "s"}? This cannot be undone.`,
        { title: "Delete folders", confirmLabel: "Delete" },
      ))
    )
      return;
    setRunning(true);
    try {
      for (const id of selected) {
        await remove.mutateAsync(id);
      }
    } finally {
      setRunning(false);
      onClear();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-100 bg-pink-50 p-2.5">
      <span className="px-2 text-sm font-bold text-brand-text">
        {selected.length} folder{selected.length === 1 ? "" : "s"} selected
      </span>
      {onMove ? (
        <button disabled={running} type="button" onClick={onMove} className="bulk-button">
          <FolderInput />
          Move
        </button>
      ) : null}
      <button
        disabled={running}
        type="button"
        onClick={() => runAction("favorite")}
        className="bulk-button"
      >
        <FolderHeart />
        Favorite
      </button>
      {organizational ? (
        <>
          <button
            disabled={running}
            type="button"
            onClick={() => runAction("lock")}
            className="bulk-button"
          >
            <Lock />
            Lock
          </button>
          <button
            disabled={running}
            type="button"
            onClick={() => runAction("unlock")}
            className="bulk-button"
          >
            <Unlock />
            Unlock
          </button>
        </>
      ) : null}
      <button
        disabled={running}
        type="button"
        onClick={downloadSelected}
        className="bulk-button"
      >
        <Download />
        Download
      </button>
      <button
        disabled={running}
        type="button"
        onClick={() => runAction("archive")}
        className="bulk-button"
      >
        <Archive />
        Archive
      </button>
      <button
        disabled={running}
        type="button"
        onClick={() => void deleteSelected()}
        className="bulk-button text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 />
        Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white hover:text-brand-pink"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
