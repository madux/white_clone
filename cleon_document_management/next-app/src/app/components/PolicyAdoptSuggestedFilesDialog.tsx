"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus } from "lucide-react";
import { api } from "../../../lib/api";
import { QUERY_KEYS } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { SuggestedPolicyFile } from "../../../lib/types";
import ModalDialog from "./ModalDialog";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "./FileTypeIcon";

export type PolicyCreateDraft = {
  name: string;
  parent_folder_id?: number;
  category?: string;
  visibility: string;
  effective_date?: string;
  description?: string;
};

export default function PolicyAdoptSuggestedFilesDialog({
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

  const allSuggestedIds = useMemo(
    () => suggested.map((item) => item.id),
    [suggested],
  );
  const allSelected =
    allSuggestedIds.length > 0 &&
    allSuggestedIds.every((id) => selectedDocumentIds.includes(id));

  useEffect(() => {
    setLoading(true);
    void api
      .suggestedPolicyFiles({
        name: draft.name,
        preview_suggestions: true,
      })
      .then((result) => {
        if (!result.success) {
          void showAlert(
            result.message || "Unable to load recommended files for this policy.",
            { title: "Unable to load recommendations" },
          );
          setSuggested([]);
          return;
        }
        setSuggested(result.data?.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [draft.name, showAlert]);

  const toggleDocument = (documentId: number) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const addAllSuggested = () => {
    setSelectedDocumentIds(allSuggestedIds);
  };

  const createPolicy = async (documentIds: number[]) => {
    setPending(true);
    try {
      const result = await api.createPolicyFolder({
        name: draft.name,
        parent_folder_id: draft.parent_folder_id,
        document_ids: documentIds,
        category: draft.category,
        visibility: draft.visibility,
        effective_date: draft.effective_date,
        description: draft.description,
      });
      if (!result.success) {
        if (result.code === "duplicate_name" && result.data?.policy?.folder_id) {
          const existingFolderId = result.data.policy.folder_id as number;
          const openExisting = await showConfirm(
            "A policy with this name already exists. Open the existing policy folder?",
            {
              title: "Duplicate policy name",
              confirmLabel: "Open existing policy",
              cancelLabel: "Stay here",
            },
          );
          if (openExisting) {
            onCreated(existingFolderId);
          }
          return;
        }
        await showAlert(result.message || "Unable to create this policy.", {
          title: "Unable to create",
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
      title="Recommended files"
      eyebrow={eyebrow}
      description={`These library files look related to “${draft.name}”. Add any you want in the new policy folder, or skip and add files later.`}
      onClose={onClose}
      closeDisabled={pending}
      size="lg"
      zIndex={90}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => void createPolicy([])}>
            Skip
          </Button>
          <Button disabled={pending} onClick={() => void createPolicy(selectedDocumentIds)}>
            {pending ? "Adding…" : "Add policy"}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-10 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-pink" aria-hidden />
          Loading recommendations…
        </div>
      ) : suggested.length ? (
        <section
          className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
          aria-label="Suggested sources"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-800">Suggested sources</h3>
            <button
              type="button"
              className="text-sm font-semibold text-brand-pink hover:text-brand-text disabled:opacity-40"
              disabled={allSelected || pending}
              onClick={addAllSuggested}
            >
              Add all
            </button>
          </div>
          <ul className="max-h-[min(22rem,50vh)] divide-y divide-slate-100 overflow-y-auto">
            {suggested.map((item) => {
              const selected = selectedDocumentIds.includes(item.id);
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <FileTypeIcon
                      name={item.name}
                      mime_type={item.mime_type}
                      document_type={item.document_type}
                      source_url={item.source_url}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      {item.folder_name ? (
                        <p className="truncate text-xs text-slate-500">{item.folder_name}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDocument(item.id)}
                      disabled={pending}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                        selected
                          ? "border-brand-pink bg-brand-pink text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-brand-pink hover:text-brand-pink"
                      }`}
                      aria-label={
                        selected ? `Remove ${item.name} from selection` : `Add ${item.name}`
                      }
                      aria-pressed={selected}
                    >
                      {selected ? (
                        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      ) : (
                        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-800">No matching files in the library</p>
          <p className="mt-1 text-sm text-slate-600">
            Choose Skip or Create to finish the policy folder, then upload or link documents
            there.
          </p>
        </div>
      )}
    </ModalDialog>
  );
}
