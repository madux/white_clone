import { Suspense } from "react";
import DatasetWizardScreen from "@/app/components/intelligence/DatasetWizardScreen";

export default function NewDatasetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading wizard…</div>}>
      <DatasetWizardScreen />
    </Suspense>
  );
}
