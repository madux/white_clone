"use client";

import { FileStack, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDocumentTypes } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openPolicyEditor } from "./templates-forms/policy-editor-session";

type Step = "choose" | "scratch" | "template";

export default function PolicyFolderCreateCustomDialog({
  folderId,
  onClose,
}: {
  folderId: number;
  onClose: () => void;
}) {
  const types = useDocumentTypes();
  const { showAlert } = useAppDialog();
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const options = (types.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
  const [typeId, setTypeId] = useState("");

  const activeTemplates = useQuery({
    queryKey: ["active-templates-forms", templateQuery],
    queryFn: () => api.listActiveTemplatesForms({ q: templateQuery, kind: "template" }),
    enabled: step === "template",
  });

  const submitScratch = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      await showAlert("Enter a document name.", { title: "From scratch" });
      return;
    }
    const documentTypeId = Number(typeId || options[0]?.value);
    if (!documentTypeId) {
      await showAlert("Choose a document type.", { title: "From scratch" });
      return;
    }
    setBusy(true);
    try {
      const result = await api.createPolicyScratchDraft({
        folder_id: folderId,
        name: trimmed,
        document_type_id: documentTypeId,
      });
      if (!result.success || !result.data) {
        await showAlert(result.message || "Unable to start the editor.", {
          title: "From scratch",
        });
        return;
      }
      onClose();
      openPolicyEditor(
        result.data.editor_document_id,
        result.data.hr_document_id,
        result.data.folder_id,
      );
    } finally {
      setBusy(false);
    }
  };

  const templateItems = activeTemplates.data?.data?.templates ?? [];

  if (step === "choose") {
    return (
      <ModalDialog
        title="Create custom"
        eyebrow="Policy document"
        description="Start from an active template or build a new document in the editor."
        onClose={onClose}
        size="md"
        zIndex={90}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-pink"
            onClick={() => setStep("template")}
          >
            <FileStack className="mb-2 h-5 w-5 text-brand-pink" aria-hidden />
            <strong className="block text-sm text-slate-900">From template / form</strong>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Use a published template from Templates &amp; Forms.
            </p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-pink"
            onClick={() => setStep("scratch")}
          >
            <FileText className="mb-2 h-5 w-5 text-brand-pink" aria-hidden />
            <strong className="block text-sm text-slate-900">From scratch</strong>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Open the rich editor with CleonAI beside your document.
            </p>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </ModalDialog>
    );
  }

  if (step === "template") {
    return (
      <ModalDialog
        title="From template / form"
        eyebrow="Policy document"
        description="Active published templates. Generation into this policy folder is coming soon."
        onClose={onClose}
        size="lg"
        zIndex={90}
      >
        <Input
          value={templateQuery}
          onChange={(event) => setTemplateQuery(event.target.value)}
          placeholder="Search templates…"
          className="mb-3"
        />
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-2">
          {activeTemplates.isLoading && (
            <p className="text-sm text-slate-400">Loading templates…</p>
          )}
          {!activeTemplates.isLoading && templateItems.length === 0 && (
            <p className="text-sm text-slate-500">No published templates match your search.</p>
          )}
          {templateItems.map((item) => (
            <div
              key={String(item.id)}
              className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{String(item.name || "")}</span>
              <span className="text-xs text-slate-400">{String(item.category || "")}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Template generation for policy folders is coming soon. Use From scratch to draft now.
        </p>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep("choose")}>Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled title="Coming soon">Continue</Button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog
      title="From scratch"
      eyebrow="Policy document"
      description="Name your policy file, then open the editor with CleonAI."
      onClose={onClose}
      size="md"
      zIndex={90}
    >
      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Document name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Information security policy"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Document type</span>
          <ThemedSelect
            value={typeId || options[0]?.value || ""}
            onChange={setTypeId}
            options={options}
          />
        </label>
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={() => setStep("choose")}>Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={busy} onClick={() => void submitScratch()}>
              {busy ? "Opening editor…" : "Open editor"}
            </Button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
