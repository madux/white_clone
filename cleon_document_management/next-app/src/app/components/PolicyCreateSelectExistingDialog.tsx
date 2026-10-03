"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { api } from "../../../lib/api";
import { QUERY_KEYS } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { SuggestedPolicyFile } from "../../../lib/types";
import type { PolicyCreateDraft } from "./PolicyAdoptSuggestedFilesDialog";
import ModalDialog from "./ModalDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTypeIcon } from "./FileTypeIcon";

export default function PolicyCreateSelectExistingDialog({
  draft,
  eyebrow,
  onClose,
  onCreated,
}: {
  draft: PolicyCreateDraft;
  eyebrow?: string;
  onClose: () => void;
  onCreated: (folderId: number) => void;
}) {
  const queryClient = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [suggested, setSuggested] = useState<SuggestedPolicyFile[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const allSuggestedIds = useMemo(
    () => suggested.map((item) => item.id),
    [suggested],
  );
  const allSelected =
    allSuggestedIds.length > 0 &&
    allSuggestedIds.every((id) => selectedDocumentIds.includes(id));

  useEffect(() => {
    setLoading(true);
    const handle = window.setTimeout(() => {
      void api
        .suggestedPolicyFiles({
          name: search.trim() || draft.name,
          browse_library: true,
        })
        .then((result) => {
          if (!result.success) {
            void showAlert(result.message || "Unable to load library files.", {
              title: "Select existing",
            });
            setSuggested([]);
            return;
          }
          setSuggested(result.data?.items ?? []);
        })
        .finally(() => setLoading(false));
    }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [draft.name, search, showAlert]);

  const toggleDocument = (documentId: number) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const addPolicy = async () => {
    if (!selectedDocumentIds.length) {
      await showAlert("Select at least one library file to add.", {
        title: "Select existing",
      });
      return;
    }
    setPending(true);
    try {
      const result = await api.createPolicyFolder({
        name: draft.name,
        parent_folder_id: draft.parent_folder_id,
        document_ids: selectedDocumentIds,
        category: draft.category,
        visibility: draft.visibility,
        effective_date: draft.effective_date,
        description: draft.description,
      });
      if (!result.success) {
        if (result.code === "duplicate_name" && result.data?.policy?.folder_id) {
          const openExisting = await showConfirm(
            "A policy with this name already exists. Open the existing policy folder?",
            {
              title: "Duplicate policy name",
              confirmLabel: "Open existing policy",
              cancelLabel: "Stay here",
            },
          );
          if (openExisting) {
            onCreated(result.data.policy.folder_id as number);
          }
          return;
        }
        await showAlert(result.message || "Unable to create this policy.", {
          title: "Unable to add policy",
        });
        return;
      }
      const folderId = result.data?.folder?.id;
      if (!folderId) {
        await showAlert("Policy was created but the folder could not be opened.", {
          title: "Unable to open folder",
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(folderId) });
      await queryClient.invalidateQueries({ queryKey: ["organizational-policies"] });
      onCreated(folderId);
    } finally {
      setPending(false);
    }
  };

  return (
    <ModalDialog
      title="Select existing"
      eyebrow={eyebrow ?? draft.name}
      description="Choose library files to include in the new policy. Selected files move into the new policy folder."
      onClose={onClose}
      closeDisabled={pending}
      size="lg"
      zIndex={90}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !selectedDocumentIds.length}
            onClick={() => void addPolicy()}
          >
            {pending ? "Adding…" : "Add policy"}
          </Button>
        </div>
      }
    >
      <label className="relative mb-3 block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          className="pl-9"
          placeholder="Search library files…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-10 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-pink" aria-hidden />
          Loading library files…
        </div>
      ) : suggested.length ? (
        <ul className="max-h-80 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
          <li className="flex items-center justify-between px-2 py-1 text-xs text-slate-500">
            <span>{suggested.length} file{suggested.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              className="font-semibold text-brand-pink disabled:opacity-40"
              disabled={allSelected || pending}
              onClick={() => setSelectedDocumentIds(allSuggestedIds)}
            >
              Select all
            </button>
          </li>
          {suggested.map((item) => {
            const selected = selectedDocumentIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleDocument(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                    selected ? "bg-pink-50 ring-1 ring-brand-pink/30" : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? "border-brand-pink bg-brand-pink text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <FileTypeIcon name={item.name} className="h-8 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {item.name}
                    </span>
                    {item.folder_path?.length ? (
                      <span className="block truncate text-xs text-slate-500">
                        {item.folder_path.join(" / ")}
                      </span>
                    ) : null}
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          No eligible library files found. Try another search or upload a file instead.
        </p>
      )}
    </ModalDialog>
  );
}
