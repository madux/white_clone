import TemplatesFormsLibrary from "@/app/components/templates-forms/TemplatesFormsLibrary";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function TemplatesFormsPage() {
  return (
    <AdminOnly>
      <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading templates…</p>}>
        <TemplatesFormsLibrary />
      </Suspense>
    </AdminOnly>
  );
}
