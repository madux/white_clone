"use client";

import { Download, FileHeart, FolderInput, Pin, Trash2, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { useDocumentAction } from "../../../hooks/useDocuments";
import {
  expandDeleteDocumentIds,
  type EmployeeDocumentGroup,
} from "../../../lib/groupEmployeeDocuments";

export default function BulkDocumentActions({
  selected,
  onClear,
  documents,
  groups,
  organizational = false,
  onMove,
}: {
  selected: number[];
  onClear: () => void;
  documents?: any[];
  groups?: EmployeeDocumentGroup[];
  organizational?: boolean;
  onMove?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const action = useDocumentAction();
  if (!selected.length) return null;

  const deleteIds = groups ? expandDeleteDocumentIds(selected, groups) : selected;
  const includesGroupedHistory = deleteIds.length > selected.length;

  const run = async (name: "favorite" | "pin") => {
    setRunning(true);
    for (const id of selected) await action.mutateAsync({ id, action: name });
    setRunning(false);
    onClear();
  };

  const download = () => {
    selected.forEach((id) => api.downloadDocument(id));
    onClear();
  };

  const selectedDocuments = (documents ?? []).filter((document) =>
    selected.includes(document.id),
  );
  const sameStatus =
    selectedDocuments.length === selected.length &&
    selectedDocuments.every(
      (document) => (document.active !== false) === (selectedDocuments[0]?.active !== false),
    );

  const toggleActive = async () => {
    if (!sameStatus) return;
    setRunning(true);
    const actionName =
      selectedDocuments[0].active === false ? "activate" : "deactivate";
    for (const id of selected) await action.mutateAsync({ id, action: actionName });
    setRunning(false);
    onClear();
  };

  const remove = async () => {
    const message = includesGroupedHistory
      ? `Delete ${selected.length} selected file${selected.length === 1 ? "" : "s"} and all related versions?`
      : `Delete ${selected.length} selected document${selected.length === 1 ? "" : "s"}?`;
    if (!window.confirm(message)) return;
    setRunning(true);
    for (const id of deleteIds) await action.mutateAsync({ id, action: "delete" });
    setRunning(false);
    onClear();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-100 bg-pink-50 p-2.5">
      <span className="px-2 text-sm font-bold text-brand-text">
        {selected.length} selected
      </span>
      {onMove && (
        <button disabled={running} type="button" onClick={onMove} className="bulk-button">
          <FolderInput />
          Move
        </button>
      )}
      {organizational && sameStatus && (
        <button
          disabled={running}
          type="button"
          onClick={toggleActive}
          className="bulk-button"
        >
          {selectedDocuments[0].active === false ? <ToggleRight /> : <ToggleLeft />}
          {selectedDocuments[0].active === false ? "Activate" : "Deactivate"}
        </button>
      )}
      <button
        disabled={running}
        type="button"
        onClick={() => run("favorite")}
        className="bulk-button"
      >
        <FileHeart />
        Favorite
      </button>
      <button
        disabled={running}
        type="button"
        onClick={() => run("pin")}
        className="bulk-button"
      >
        <Pin />
        Pin
      </button>
      <button disabled={running} type="button" onClick={download} className="bulk-button">
        <Download />
        Download
      </button>
      <button
        disabled={running}
        type="button"
        onClick={remove}
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
