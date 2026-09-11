import TemplateDocumentEditor from "@/app/components/templates-forms/TemplateDocumentEditor";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function TemplateEditorPage() {
  return (
    <AdminOnly>
      <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading editor…</p>}>
        <TemplateDocumentEditor />
      </Suspense>
    </AdminOnly>
  );
}
