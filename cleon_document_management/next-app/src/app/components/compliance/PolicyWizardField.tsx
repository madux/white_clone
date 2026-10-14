"use client";

import type { ReactNode } from "react";

/** Form labels aligned with `.label` used across the policy engine wizard. */
export function PolicyWizardField({
  label,
  full,
  className = "",
  error,
  children,
  wrapper = "label",
}: {
  label: ReactNode;
  full?: boolean;
  className?: string;
  error?: string;
  children: ReactNode;
  /** Use `div` when the label row contains buttons (e.g. switch + help). */
  wrapper?: "label" | "div";
}) {
  const Wrapper = wrapper;
  return (
    <Wrapper
      className={[full ? "sm:col-span-2" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={`label ${error ? "text-red-600" : ""}`}>{label}</span>
      <div
        className={
          error
            ? "[&_.field]:border-red-400 [&_.field]:ring-1 [&_.field]:ring-red-200 [&_button[aria-haspopup]]:border-red-400"
            : ""
        }
      >
        {children}
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </Wrapper>
  );
}

export function PolicyWizardHint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-slate-500">{children}</span>;
}

export function PolicyWizardSectionError({
  error,
  className = "",
}: {
  error?: string;
  className?: string;
}) {
  if (!error) return null;
  return (
    <p
      className={`text-xs font-medium text-red-600 ${className}`}
      role="alert"
    >
      {error}
    </p>
  );
}
