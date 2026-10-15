"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AskAiDocumentButton({
  documentId,
  className = "inline-flex items-center gap-2 rounded-full border border-brand-pink px-3 py-2 text-xs font-bold text-brand-pink hover:bg-pink-50",
}: {
  documentId: number;
  className?: string;
}) {
  const router = useRouter();
  if (!documentId || documentId <= 0) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/pages/document-intelligence/ask?document=${documentId}`)
      }
      className={className}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      Ask AI
    </button>
  );
}
