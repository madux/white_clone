"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { api } from "../../../lib/api";
import { QUERY_KEYS } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { OrganizationalPolicy, SuggestedPolicyFile } from "../../../lib/types";
import ModalDialog from "./ModalDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTypeIcon } from "./FileTypeIcon";

export default function PolicyFolderSelectExistingDialog({
  policy,
  onClose,
}: {
  policy: OrganizationalPolicy;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showAlert } = useAppDialog();
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
          name: search.trim() || undefined,
          policy_folder_id: policy.folder_id,
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
  }, [policy.folder_id, search, showAlert]);

  const toggleDocument = (documentId: number) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const addSelected = async () => {
    if (!selectedDocumentIds.length) return;
    setPending(true);
    try {
      const result = await api.adoptPolicyFiles({
        policy_id: policy.id,
        document_ids: selectedDocumentIds,
      });
      if (!result.success) {
        await showAlert(result.message || "Unable to add files to this policy.", {
          title: "Select existing",
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(policy.folder_id),
      });
      await queryClient.invalidateQueries({ queryKey: ["organizational-policies"] });
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <ModalDialog
      title="Select existing"
      eyebrow={policy.name}
      description="Browse organizational library files to add to this policy folder. Selected files move here from their current folder."
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
            onClick={() => void addSelected()}
          >
            {pending
              ? "Adding…"
              : `Add policy (${selectedDocumentIds.length} file${selectedDocumentIds.length === 1 ? "" : "s"})`}
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
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search library files…"
          className="pl-9"
        />
      </label>
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-pink" aria-hidden />
          Loading library files…
        </div>
      ) : suggested.length ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-800">
              {search.trim() ? "Search results" : "Organizational library"}
            </h3>
            <button
              type="button"
              className="text-sm font-semibold text-brand-pink hover:text-brand-text disabled:opacity-40"
              disabled={allSelected || pending}
              onClick={() => setSelectedDocumentIds(allSuggestedIds)}
            >
              Select all
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
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
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
                      aria-pressed={selected}
                      aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
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
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          {search.trim()
            ? "No library files match your search."
            : "No eligible files found in the library. Files already in another policy folder or registered as another policy’s primary document are hidden."}
        </p>
      )}
    </ModalDialog>
  );
}
