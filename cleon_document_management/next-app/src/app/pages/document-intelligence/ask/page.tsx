import { Suspense } from "react";
import AskScreen from "@/app/components/intelligence/AskScreen";

export default function AskPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading Ask AI…</div>}>
      <div className="h-full min-h-0 overflow-hidden">
        <AskScreen />
      </div>
    </Suspense>
  );
}
