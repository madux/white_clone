"use client";

import { Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import ThemedSelect from "../ThemedSelect";
import { useTemplateCategories, useUploadTemplate } from "../../../../hooks/useTemplatesForms";

const ICONS = ["📄", "📝", "📋", "📑", "✉️", "🧾", "📌", "🗂️", "⚖️", "🏖️", "💰", "🩺"];
const ACCEPT = ".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx";
const MAX = 50 * 1024 * 1024;

export default function CreateTemplateDialog({
  onClose,
  initialKind = "template",
}: {
  onClose: () => void;
  initialKind?: "template" | "form";
}) {
  const categories = useTemplateCategories();
  const upload = useUploadTemplate();
  const [kind, setKind] = useState<"template" | "form">(initialKind);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📄");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const options = useMemo(
    () =>
      (categories.data || [])
        .filter((item) => item.applies_to === "both" || item.applies_to === kind)
        .map((item) => ({ value: String(item.id), label: item.name })),
    [categories.data, kind],
  );

  const valid =
    Boolean(kind && categoryId && file && description.length <= 500) && !error;

  function takeFile(next: File | null) {
    setError("");
    if (!next) {
      setFile(null);
      return;
    }
    const ext = `.${(next.name.split(".").pop() || "").toLowerCase()}`;
    if (!ACCEPT.split(",").includes(ext)) {
      setError("This file type is not allowed.");
      setFile(null);
      return;
    }
    if (next.size > MAX) {
      setError("Each file must be 50 MB or smaller.");
      setFile(null);
      return;
    }
    setFile(next);
  }

  async function submit() {
    if (!file || !categoryId) return;
    try {
      await upload.mutateAsync({
        file,
        kind,
        category_id: Number(categoryId),
        description,
        icon,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-template-title">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="create-template-title" className="text-lg font-semibold text-slate-900">
            Create New Template
          </h2>
          <button type="button" aria-label="Close create dialog" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="label">Type</span>
            <ThemedSelect
              ariaLabel="Type"
              value={kind}
              onChange={(value) => setKind(value as "template" | "form")}
              options={[
                { value: "template", label: "Template" },
                { value: "form", label: "Form" },
              ]}
            />
          </label>
          <label className="block">
            <span className="label">Category</span>
            <ThemedSelect
              ariaLabel="Category"
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select a category"
              options={options}
            />
          </label>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              takeFile(event.dataTransfer.files[0] || null);
            }}
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
          >
            <Upload className="mx-auto h-6 w-6 text-brand-pink" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Upload Files</p>
            <p className="mt-1 text-xs text-slate-400">PDF, DOC, DOCX, TXT, XLS, XLSX, PPT, PPTX · 50 MB</p>
            <input
              className="sr-only"
              id="template-file"
              type="file"
              accept={ACCEPT}
              onChange={(event) => takeFile(event.target.files?.[0] || null)}
            />
            <label htmlFor="template-file" className="mt-3 inline-flex cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Browse Files
            </label>
            {file && (
              <p className="mt-2 text-sm text-slate-600">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
                <button type="button" className="ml-2 text-brand-pink" onClick={() => takeFile(null)}>
                  Remove
                </button>
              </p>
            )}
          </div>
          <label className="block">
            <span className="label">Description (optional)</span>
            <textarea
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field min-h-24"
            />
            <span className="text-xs text-slate-400">{description.length}/500</span>
          </label>
          <fieldset>
            <legend className="label">Icon</legend>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Icon ${item}`}
                  aria-pressed={icon === item}
                  onClick={() => setIcon(item)}
                  className={`h-10 w-10 rounded-xl border text-lg ${icon === item ? "border-brand-pink bg-pink-50" : "border-slate-200"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || upload.isPending}
            onClick={submit}
            className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {upload.isPending ? "Uploading…" : kind === "form" ? "Add Form" : "Add Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
