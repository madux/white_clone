"use client";

import { editorPath } from "@/app/components/templates-forms/editor-session";

export default function TemplateEditorError({ reset }: { error: Error; reset: () => void }) {
  function reloadWithDocument() {
    const id = Number(sessionStorage.getItem("tf.editor.document") || 0);
    const submission = Number(sessionStorage.getItem("tf.editor.submission") || 0);
    if (id) {
      window.location.assign(editorPath(id, submission || undefined));
      return;
    }
    reset();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-semibold text-slate-800">This page couldn’t load</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The document was created. Reload keeps the generated file open so you can keep editing.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="rounded-full bg-[#e83e8c] px-4 py-2 text-sm font-semibold text-white"
          onClick={reloadWithDocument}
        >
          Reload
        </button>
        <a href="/document-management/pages/organization/templates-forms/" className="rounded-full border px-4 py-2 text-sm font-semibold">
          Back
        </a>
      </div>
    </div>
  );
}
