import { Suspense } from "react";
import ValidateScreen from "@/app/components/intelligence/ValidateScreen";

export default function ValidatePage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-slate-500">Loading queue…</div>}
    >
      <ValidateScreen />
    </Suspense>
  );
}
