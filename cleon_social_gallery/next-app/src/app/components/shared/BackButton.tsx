"use client";

import { ArrowLeft } from "lucide-react";
import { useNavigationHistory } from "@/hooks/useNavigationHistory";

export function BackButton({
  variant = "header",
  className = "",
}: {
  variant?: "header" | "page";
  className?: string;
}) {
  const { canGoBack, backLabel, goBack } = useNavigationHistory();

  if (!canGoBack) return null;

  const label =
    variant === "header"
      ? "Back"
      : backLabel
        ? `Back to ${backLabel}`
        : "Back";

  return (
    <button
      type="button"
      onClick={goBack}
      title={backLabel ? `Return to ${backLabel}` : "Go back"}
      className={
        variant === "header"
          ? `inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-brand-text ${className}`.trim()
          : `header-back-button is-page ${className}`.trim()
      }
    >
      <ArrowLeft size={variant === "header" ? 16 : 16} />
      {label}
    </button>
  );
}
