"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api } from "../../../lib/api";
import { QUERY_KEYS, useCreateFolder } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { DocDocument, DocFolder } from "../../../lib/types";
import FormWindowShell from "./FormWindowShell";
import AppSelect from "./AppSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTypeIcon } from "./FileTypeIcon";

const ORGANIZE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "department", label: "Department" },
  { value: "grade", label: "Grade" },
  { value: "location", label: "Location" },
  { value: "employment_type", label: "Employment type" },
];

export default function CreateNamedFolderDialog({
  kind,
  parentFolder,
  onClose,
}: {
  kind: "folder" | "project" | "vendor";
  parentFolder?: DocFolder | null;
  onClose: () => void;
}) {
  const create = useCreateFolder();
  const queryClient = useQueryClient();
  const { showAlert } = useAppDialog();
  const [name, setName] = useState("");
  const [organizeBy, setOrganizeBy] = useState("none");
  const [suggested, setSuggested] = useState<DocDocument[]>([]);
  const [selectedShortcutIds, setSelectedShortcutIds] = useState<number[]>([]);
  const titles = {
    folder: "Create folder",
    project: "Create project",
    vendor: "Create vendor",
  };
  const isCollection = kind === "project" || kind === "vendor";

  useEffect(() => {
    if (!isCollection || name.trim().length < 2) {
      setSuggested([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void api
        .suggestedOrganizationalFiles({
          name: name.trim(),
          folder_id: parentFolder?.id,
        })
        .then((result) => setSuggested((result.data?.items ?? []).slice(0, 8)));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [isCollection, name, parentFolder?.id]);

  useEffect(() => {
    setSelectedShortcutIds((prev) =>
      prev.filter((id) => suggested.some((item) => item.id === id)),
    );
  }, [suggested]);

  const toggleShortcut = (documentId: number) => {
    setSelectedShortcutIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      await showAlert("Enter a name.", { title: "Unable to create" });
      return;
    }
    const result = await create.mutateAsync({
      nameElm: trimmed,
      folder_type: "organizational",
      folder_kind: kind,
      parent_id: parentFolder?.id || false,
      access_scope: parentFolder?.access_scope || "all_staff",
      department_ids: parentFolder?.department_ids ?? [],
      grade_ids: parentFolder?.grade_ids ?? [],
      employee_ids: parentFolder?.employee_ids ?? [],
      organize_by: isCollection ? organizeBy : "none",
    });
    if (!result.success) {
      await showAlert(result.message || "Unable to create this item.", {
        title: "Unable to create",
      });
      return;
    }

    const newFolderId = result.data?.id;
    if (newFolderId && selectedShortcutIds.length) {
      const failures: string[] = [];
      for (const documentId of selectedShortcutIds) {
        const shortcut = await api.createOrganizationalShortcut({
          document_id: documentId,
          folder_id: newFolderId,
        });
        if (!shortcut.success) {
          failures.push(shortcut.message || `Document #${documentId}`);
        }
      }
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(newFolderId),
      });
      if (failures.length) {
        await showAlert(
          `Created ${kind}, but some shortcuts could not be added:\n${failures.join("\n")}`,
          { title: "Shortcuts partially added" },
        );
      }
    }

    onClose();
  };

  return (
    <FormWindowShell
      title={titles[kind]}
      eyebrow="Organizational files"
      description={
        parentFolder
          ? `This ${kind} will be created inside ${parentFolder.folder_name}.`
          : `Creates a ${kind} at the library root.`
      }
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      }
    >
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Name</span>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {isCollection ? (
        <label className="mt-3 block space-y-1 text-sm">
          <span className="font-semibold">Organize by</span>
          <AppSelect
            value={organizeBy}
            onChange={setOrganizeBy}
            options={ORGANIZE_OPTIONS}
          />
        </label>
      ) : null}
      {suggested.length ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Suggested files
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Click files to link them as shortcuts in this {kind} when you create
            it.
          </p>
          <ul className="mt-2 space-y-1">
            {suggested.map((item) => {
              const selected = selectedShortcutIds.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleShortcut(item.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                      selected
                        ? "bg-violet-100 text-violet-950 ring-1 ring-violet-300"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    <FileTypeIcon
                      name={item.name}
                      mime_type={item.mime_type}
                      document_type={item.document_type}
                      source_url={item.source_url}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      {item.document_type ? (
                        <span className="text-slate-500"> · {item.document_type}</span>
                      ) : null}
                    </span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-violet-700" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </FormWindowShell>
  );
}
