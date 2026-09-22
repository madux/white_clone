"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";

type UploadRow = {
  id: number;
  name: string;
  mimetype: string;
  file_size: number;
};

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadFilesStep({
  files,
  busy,
  error,
  onAdd,
  onRemove,
}: {
  files: UploadRow[];
  busy: boolean;
  error: string;
  onAdd: (files: File[]) => void;
  onRemove: (id: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function take(list: FileList | File[]) {
    const next = Array.from(list || []);
    if (next.length) {
      onAdd(next);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Upload the files to extract</h2>
        <p className="mt-1 text-sm text-slate-500">
          These files stay in Document Intelligence. They are not added to
          Employee or Organizational Files. PDF, Office, text, and images up to
          25 MB.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          take(event.dataTransfer.files);
        }}
        className={`flex w-full cursor-pointer flex-col items-center rounded-2xl border border-dashed px-4 py-10 text-sm font-semibold ${
          dragOver
            ? "border-brand-pink bg-pink-50 text-brand-text"
            : "border-brand-pink/40 bg-pink-50/40 text-brand-text"
        }`}
      >
        <Upload className="mb-2 h-6 w-6" />
        {busy ? "Uploading…" : "Drop files here or click to choose"}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.tif,.tiff,.bmp"
          onChange={(event) => {
            take(event.target.files || []);
            event.target.value = "";
          }}
        />
      </button>
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {files.length ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-800">
                  {file.name}
                </span>
                <span className="text-xs text-slate-400">
                  {formatSize(file.file_size)}
                </span>
              </span>
              <button
                type="button"
                className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove(file.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No files uploaded yet.</p>
      )}
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{files.length}</span>{" "}
        file{files.length === 1 ? "" : "s"} ready
      </p>
    </div>
  );
}
