"use client";

import { Archive, Folder, FolderInput, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCurrentUser,
  useDocumentAction,
  useDocumentLifecycle,
  useFolderAction,
  useFolderLifecycle,
  useLifecycleBulkAction,
  useFolders,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { DocDocument } from "../../../lib/types";
import MoveRecycledFolderDocumentsDialog from "./MoveRecycledFolderDocumentsDialog";
import ModalDialog from "./ModalDialog";
import AppToolbar from "./AppToolbar";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import { Button } from "@/components/ui/button";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";

type LifecycleRecord = {
  id: number;
  record_type: "document" | "folder";
  name: string;
  folder_name?: string;
  folder_type?: "employee" | "organizational";
  folder_kind?: string;
  location_label?: string;
  document_type?: string;
  employee_name?: string;
  document_count?: number;
  linked_document_count?: number;
  recycle_bin_until?: string;
  write_date?: string;
};

export default function DocumentLifecyclePage({
  lifecycle,
  embedded = false,
}: {
  lifecycle: "archived" | "recycle_bin";
  embedded?: boolean;
}) {
  const documents = useDocumentLifecycle(lifecycle);
  const folders = useFolderLifecycle(lifecycle);
  const activeFolders = useFolders();
  const documentAction = useDocumentAction();
  const folderAction = useFolderAction();
  const lifecycleBulk = useLifecycleBulkAction();
  const currentUser = useCurrentUser();
  const { showConfirm } = useAppDialog();
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
        `${item.name} ${item.folder_name ?? ""} ${item.location_label ?? ""} ${item.document_type ?? "Folder"}`
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
      if (
        !(await showConfirm(message, {
          title: "Delete selected items",
          confirmLabel: "Delete",
        }))
      )
        return;
    }
    const result = await lifecycleBulk.mutateAsync({
      action,
      records: selectedRecords.map((record) => ({
        record_type: record.record_type,
        id: record.id,
      })),
    });
    if (result && result.success === false) {
      setDialogMessage(result.message || "Action failed.");
    }
    setSelected([]);
  };

  const linkedCount = (record: LifecycleRecord) =>
    record.record_type === "folder" ? (record.linked_document_count ?? 0) : 0;

  const confirmDelete = async (record: LifecycleRecord) => {
    const label = record.folder_name ?? record.name;
    if (record.record_type === "folder") {
      const linked = linkedCount(record);
      if (linked > 0) {
        return showConfirm(
          `Delete "${label}" and all ${linked} linked document${linked === 1 ? "" : "s"}? Use Move files first if you want to keep any documents. This cannot be undone.`,
          { title: "Delete folder", confirmLabel: "Delete" },
        );
      }
      return showConfirm(`Delete "${label}"? This cannot be undone.`, {
        title: "Delete folder",
        confirmLabel: "Delete",
      });
    }
    return showConfirm(`Delete "${label}"? This cannot be undone.`, {
      title: "Delete document",
      confirmLabel: "Delete",
    });
  };

  const deleteRecord = async (record: LifecycleRecord) => {
    if (!(await confirmDelete(record))) return;
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
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <section className="app-table-well app-page-body">
        <AppToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search files and folders..."
        />

        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <span className="text-sm font-medium">{selected.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => runSelected("restore")}>
              Restore selected
            </Button>
            {recycle && isManager ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => runSelected("permanent_delete")}
              >
                Delete selected
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        ) : null}

        <LibraryFileTable
          rows={rows.map((record: LifecycleRecord) => {
            const key = keyOf(record);
            return {
              id: key,
              kind: record.record_type === "folder" ? "folder" : "file",
              icon: record.record_type === "folder" ? <Folder /> : <Archive />,
              name: record.name,
              subtitle:
                record.record_type === "folder"
                  ? linkedCount(record) > 0
                    ? `${linkedCount(record)} linked document${linkedCount(record) === 1 ? "" : "s"}`
                    : "No linked documents"
                  : record.employee_name !== "N/A"
                    ? record.employee_name
                    : "Organizational record",
              owner:
                record.record_type === "folder"
                  ? `${record.folder_type === "employee" ? "Employee" : "Organizational"} folder`
                  : record.document_type || "—",
              location: record.location_label || record.folder_name || "—",
              modified: formatDocumentDate(
                recycle ? record.recycle_bin_until : record.write_date,
              ),
              selected: selected.includes(key),
              onSelectChange: () =>
                setSelected((current) =>
                  current.includes(key)
                    ? current.filter((id) => id !== key)
                    : [...current, key],
                ),
              actions: (
                <span className="flex justify-end gap-1">
                  {recycle &&
                  isManager &&
                  record.record_type === "folder" &&
                  linkedCount(record) > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMoveFolder(record)}
                    >
                      <FolderInput data-icon="inline-start" />
                      Move
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void perform(record, "restore")}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Restore
                  </Button>
                  {recycle && isManager ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void deleteRecord(record)}
                    >
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </Button>
                  ) : null}
                </span>
              ),
            } satisfies LibraryFileRow;
          })}
          loading={documents.isLoading || folders.isLoading}
          selectable
          allSelected={allSelected}
          onToggleAll={(checked) =>
            setSelected(checked ? rows.map((item: LifecycleRecord) => keyOf(item)) : [])
          }
          showLocation
          emptyTitle="Nothing here"
          emptyDescription={
            recycle
              ? "Deleted files will appear in this trash list."
              : "Archived files will appear in this list."
          }
        />
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
          onClose={() => setDialogMessage(null)}
          size="sm"
          fullscreenable={false}
        >
          <p className="text-sm text-slate-600">{dialogMessage}</p>
        </ModalDialog>
      )}
    </div>
  );
}
