import TemplateDocumentEditor from "@/app/components/templates-forms/TemplateDocumentEditor";
import AdminOnly from "@/app/components/AdminOnly";
import TenantModuleGate from "@/app/components/TenantModuleGate";
import { Suspense } from "react";

export default function TemplateEditorPage() {
  return (
    <TenantModuleGate
      moduleKeys={["organizational_files", "templates_forms"]}
      fallbackHref="/pages/my-workspace"
    >
    <AdminOnly>
      <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading editor…</p>}>
        <TemplateDocumentEditor />
      </Suspense>
    </AdminOnly>
    </TenantModuleGate>
  );
}
