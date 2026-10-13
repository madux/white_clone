import TemplatesFormsLibrary from "@/app/components/templates-forms/TemplatesFormsLibrary";
import AdminOnly from "@/app/components/AdminOnly";
import TenantModuleGate from "@/app/components/TenantModuleGate";
import { Suspense } from "react";

export default function TemplatesFormsPage() {
  return (
    <TenantModuleGate
      moduleKeys={["organizational_files", "templates_forms"]}
      fallbackHref="/pages/my-workspace"
    >
      <AdminOnly>
        <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading templates…</p>}>
          <TemplatesFormsLibrary />
        </Suspense>
      </AdminOnly>
    </TenantModuleGate>
  );
}
