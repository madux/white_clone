import GenerateDocumentScreen from "@/app/components/templates-forms/GenerateDocumentScreen";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function GenerateTemplatePage() {
  return (
    <AdminOnly>
      <Suspense fallback={<p className="p-6 text-sm text-slate-400">Preparing template…</p>}>
        <GenerateDocumentScreen />
      </Suspense>
    </AdminOnly>
  );
}
