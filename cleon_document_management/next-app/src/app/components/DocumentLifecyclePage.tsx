"use client";

import { Archive, CheckCircle2, Folder, FolderInput, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCurrentUser,
  useDocumentAction,
  useDocumentLifecycle,
  useFolderAction,
  useFolderLifecycle,
  useFolders,
} from "../../../hooks/useDocuments";
import type { DocDocument } from "../../../lib/types";
import MoveRecycledFolderDocumentsDialog from "./MoveRecycledFolderDocumentsDialog";
import ModalDialog from "./ModalDialog";

type LifecycleRecord = {
  id: number;
  record_type: "document" | "folder";
  name: string;
  folder_name?: string;
  folder_type?: "employee" | "organizational";
  document_type?: string;
  employee_name?: string;
  document_count?: number;
  linked_document_count?: number;
  recycle_bin_until?: string;
  write_date?: string;
};

export default function DocumentLifecyclePage({
  lifecycle,
}: {
  lifecycle: "archived" | "recycle_bin";
}) {
  const documents = useDocumentLifecycle(lifecycle);
  const folders = useFolderLifecycle(lifecycle);
  const activeFolders = useFolders();
  const documentAction = useDocumentAction();
  const folderAction = useFolderAction();
  const currentUser = useCurrentUser();
  const isManager = currentUser.data?.is_document_manager === true;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [moveFolder, setMoveFolder] = useState<LifecycleRecord | null>(null);
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const recycle = lifecycle === "recycle_bin";

  const rows = useMemo(
    () =>
      [
        ...(documents.data ?? []).map((item: DocDocument) => ({
          ...item,
          record_type: "document" as const,
        })),
        ...(folders.data ?? []),
      ].filter((item: LifecycleRecord) =>
        `${item.name} ${item.folder_name ?? ""} ${item.document_type ?? "Folder"}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [documents.data, folders.data, search],
  );

  const keyOf = (record: LifecycleRecord) => `${record.record_type}-${record.id}`;

  const perform = async (
    record: LifecycleRecord,
    action: "restore" | "permanent_delete" | "force_permanent_delete",
  ) => {
    try {
      const result =
        record.record_type === "folder"
          ? await folderAction.mutateAsync({ id: record.id, action })
          : await documentAction.mutateAsync({
              id: record.id,
              action: action as "restore" | "permanent_delete",
            });
      if (result && (result as { success?: boolean }).success === false) {
        setDialogMessage((result as { message?: string }).message || "Action failed.");
      }
    } catch (error: any) {
      setDialogMessage(error?.message || "Action failed.");
    }
  };

  const runSelected = async (action: "restore" | "permanent_delete") => {
    if (!selected.length) return;
    const selectedRecords = selected
      .map((key) => rows.find((item: LifecycleRecord) => keyOf(item) === key))
      .filter(Boolean) as LifecycleRecord[];
    if (action === "permanent_delete") {
      const linkedFolderCount = selectedRecords.filter(
        (record) => record.record_type === "folder" && linkedCount(record) > 0,
      ).length;
      const message = linkedFolderCount
        ? `Delete ${selected.length} selected item${selected.length === 1 ? "" : "s"}? ${linkedFolderCount} folder${linkedFolderCount === 1 ? "" : "s"} still have linked documents that will be deleted too. Move files first if you want to keep them. This cannot be undone.`
        : `Delete ${selected.length} selected item${selected.length === 1 ? "" : "s"}? This cannot be undone.`;
      if (!window.confirm(message)) return;
    }
    for (const record of selectedRecords) {
      if (action === "permanent_delete" && record.record_type === "folder") {
        const linked = linkedCount(record);
        await perform(
          record,
          linked > 0 ? "force_permanent_delete" : "permanent_delete",
        );
        continue;
      }
      await perform(record, action);
    }
    setSelected([]);
    await Promise.all([documents.refetch(), folders.refetch()]);
  };

  const linkedCount = (record: LifecycleRecord) =>
    record.record_type === "folder" ? (record.linked_document_count ?? 0) : 0;

  const confirmDelete = (record: LifecycleRecord) => {
    const label = record.folder_name ?? record.name;
    if (record.record_type === "folder") {
      const linked = linkedCount(record);
      if (linked > 0) {
        return window.confirm(
          `Delete "${label}" and all ${linked} linked document${linked === 1 ? "" : "s"}? Use Move files first if you want to keep any documents. This cannot be undone.`,
        );
      }
      return window.confirm(`Delete "${label}"? This cannot be undone.`);
    }
    return window.confirm(`Delete "${label}"? This cannot be undone.`);
  };

  const deleteRecord = async (record: LifecycleRecord) => {
    if (!confirmDelete(record)) return;
    if (record.record_type === "folder") {
      const linked = linkedCount(record);
      await perform(record, linked > 0 ? "force_permanent_delete" : "permanent_delete");
    } else {
      await perform(record, "permanent_delete");
    }
    await Promise.all([documents.refetch(), folders.refetch()]);
  };

  const allSelected = rows.length > 0 && rows.every((item: LifecycleRecord) => selected.includes(keyOf(item)));

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-2xl font-bold text-brand-text">{rows.length}</p>
          <p className="text-xs font-semibold text-slate-400">
            {recycle ? "in recycle bin" : "archived records"}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files and folders..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
            />
          </label>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-pink-100 bg-pink-50 p-2.5">
            <span className="px-2 text-sm font-bold text-brand-text">{selected.length} selected</span>
            <button
              type="button"
              onClick={() => runSelected("restore")}
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-text"
            >
              Restore selected
            </button>
            {recycle && isManager && (
              <button
                type="button"
                onClick={() => runSelected("permanent_delete")}
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600"
              >
                Delete selected
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-auto rounded-lg px-3 py-2 text-xs font-bold text-slate-500"
            >
              Clear
            </button>
          </div>
        )}

        {documents.isLoading || folders.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="w-12 px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : rows.map((item: LifecycleRecord) => keyOf(item)))
                      }
                      aria-label="Select all lifecycle items"
                      className="h-4 w-4 accent-pink-600"
                    />
                  </th>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((record: LifecycleRecord) => (
                  <tr key={keyOf(record)} className="hover:bg-pink-50/30">
                    <td className="w-12 px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(keyOf(record))}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(keyOf(record))
                              ? current.filter((id) => id !== keyOf(record))
                              : [...current, keyOf(record)],
                          )
                        }
                        aria-label={`Select ${record.name}`}
                        className="h-4 w-4 accent-pink-600"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                          {record.record_type === "folder" ? (
                            <Folder className="h-5 w-5" />
                          ) : (
                            <Archive className="h-5 w-5" />
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{record.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {record.record_type === "folder"
                              ? linkedCount(record) > 0
                                ? `${linkedCount(record)} linked document${linkedCount(record) === 1 ? "" : "s"} (includes pending uploads)`
                                : "No linked documents"
                              : record.employee_name !== "N/A"
                                ? record.employee_name
                                : "Organizational record"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {record.record_type === "folder" ? "Folder" : record.folder_name}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {record.record_type === "folder"
                        ? `${record.folder_type === "employee" ? "Employee" : "Organizational"} folder`
                        : record.document_type}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {(recycle ? record.recycle_bin_until : record.write_date)?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {recycle &&
                          isManager &&
                          record.record_type === "folder" &&
                          linkedCount(record) > 0 && (
                            <button
                              type="button"
                              onClick={() => setMoveFolder(record)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              <FolderInput className="h-3.5 w-3.5" />
                              Move files
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => perform(record, "restore")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 px-3 py-2 text-xs font-bold text-brand-text hover:bg-pink-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                        {recycle && isManager && (
                          <button
                            type="button"
                            onClick={() => void deleteRecord(record)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center p-16 text-center">
            <CheckCircle2 className="h-9 w-9 text-brand-pink" />
            <p className="mt-4 font-bold text-slate-700">Nothing here</p>
          </div>
        )}
      </section>

      {moveFolder && (
        <MoveRecycledFolderDocumentsDialog
          folder={{
            id: moveFolder.id,
            folder_name: moveFolder.folder_name ?? moveFolder.name,
            folder_type: moveFolder.folder_type ?? "employee",
            linked_document_count: linkedCount(moveFolder),
          }}
          folders={activeFolders.data ?? []}
          onClose={() => setMoveFolder(null)}
          onMoved={async () => {
            setMoveFolder(null);
            await Promise.all([documents.refetch(), folders.refetch(), activeFolders.refetch()]);
          }}
        />
      )}
      {dialogMessage && (
        <ModalDialog
          title="Action notice"
          description={dialogMessage}
          onClose={() => setDialogMessage(null)}
          size="sm"
          fullscreenable={false}
        >
          <div />
        </ModalDialog>
      )}
    </div>
  );
}
