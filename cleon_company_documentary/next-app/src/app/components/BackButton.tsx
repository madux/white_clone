"use client";

import { ArrowLeft } from "lucide-react";
import { useNavigationHistory } from "../../../hooks/useNavigationHistory";

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
      className={`header-back-button${variant === "page" ? " is-page" : ""} ${className}`.trim()}
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
