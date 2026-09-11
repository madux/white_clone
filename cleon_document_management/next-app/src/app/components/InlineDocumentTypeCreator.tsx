"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useCreateDocumentType, useCurrentUser } from "../../../hooks/useDocuments";
import type { DocumentType } from "../../../lib/types";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";

const categories = [
  ["hr", "Human Resources"],
  ["finance", "Finance"],
  ["legal", "Legal"],
  ["identity", "Identity"],
  ["employment", "Employment"],
  ["medical", "Medical"],
  ["training", "Training"],
  ["other", "Other"],
];

export default function InlineDocumentTypeCreator({ onCreated }: { onCreated: (type: DocumentType) => void }) {
  const user = useCurrentUser();
  const create = useCreateDocumentType();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [expiryApplicable, setExpiryApplicable] = useState(false);
  const [retention, setRetention] = useState("7");
  const [error, setError] = useState("");

  if (user.data?.is_document_manager !== true) return null;

  const close = () => {
    setOpen(false);
    setError("");
  };
  const submit = async () => {
    if (!name.trim()) return setError("Enter a name for the document type.");
    setError("");
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        category,
        description,
        is_mandatory_default: mandatory,
        expiry_applicable: expiryApplicable,
        default_retention_years: Number(retention) || 0,
      });
      const response = result as { success: boolean; data?: DocumentType; message?: string };
      if (!response.success || !response.data) return setError(response.message || "The document type could not be created.");
      onCreated(response.data);
      setName("");
      setDescription("");
      setMandatory(false);
      setExpiryApplicable(false);
      setRetention("7");
      close();
    } catch (caught: any) {
      setError(caught?.message || "The document type could not be created.");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-pink/30 bg-pink-50 px-3 py-2 text-xs font-bold text-brand-pink transition hover:bg-pink-100">
        <Plus className="h-3.5 w-3.5" /> New type
      </button>
      {open && (
        <ModalDialog
          title="Create document type"
          eyebrow="Document setup"
          description="Add a custom type without leaving this form."
          onClose={close}
          size="lg"
          zIndex={70}
          backdropClassName="bg-slate-950/35"
          titleClassName="text-xl"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="label">Name</span><input autoFocus required className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Professional Certificate" /></label>
            <label><span className="label">Category</span><ThemedSelect value={category} onChange={setCategory} options={categories.map(([value, label]) => ({ value, label }))} /></label>
            <label><span className="label">Retention (years)</span><input min="0" type="number" className="field" value={retention} onChange={(event) => setRetention(event.target.value)} /></label>
            <label className="sm:col-span-2"><span className="label">Description <em className="font-normal normal-case tracking-normal text-slate-400">(optional)</em></span><textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="When this type should be used" /></label>
            <label className="sm:col-span-2 flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={mandatory} onChange={(event) => setMandatory(event.target.checked)} className="h-4 w-4 accent-pink-600" /> Mark mandatory by default</label>
            <label className="sm:col-span-2 flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={expiryApplicable} onChange={(event) => setExpiryApplicable(event.target.checked)} className="h-4 w-4 accent-pink-600" /> Expiry applicable</label>
          </div>
          {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-full px-4 py-2.5 font-semibold text-slate-500">Cancel</button>
            <button type="button" disabled={create.isPending} onClick={() => void submit()} className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 font-semibold text-white shadow-lg shadow-pink-200">{create.isPending ? "Creating..." : "Create type"}</button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
