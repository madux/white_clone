"use client";

import { ArrowLeft } from "lucide-react";
import { useNavigationHistory } from "../../../hooks/useNavigationHistory";

export const backButtonChromeClassName =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-pink-200 hover:bg-pink-50 hover:text-brand-text";

export default function BackButton({
  variant = "page",
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
          ? `inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-brand-text ${className}`
          : `${backButtonChromeClassName} ${className}`
      }
    >
      <ArrowLeft className={variant === "header" ? "h-4 w-4" : "h-4 w-4"} />
      {label}
    </button>
  );
}
