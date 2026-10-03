import PolicyDocumentEditor from "@/app/components/PolicyDocumentEditor";
import { Suspense } from "react";

export default function PolicyEditorPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading editor…</p>}>
      <PolicyDocumentEditor />
    </Suspense>
  );
}
