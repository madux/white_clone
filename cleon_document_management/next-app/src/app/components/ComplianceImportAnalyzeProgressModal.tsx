"use client";

import { Check, Circle, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";
import ModalDialog from "./ModalDialog";
import { FileTypeIcon } from "./FileTypeIcon";
import type { DocDocument } from "../../../lib/types";

const ANALYZE_STEPS = [
  {
    id: "read",
    title: "Reading document",
    description: "Loading the file from your library",
  },
  {
    id: "extract",
    title: "Extracting text",
    description: "Parsing pages and readable content",
  },
  {
    id: "analyze",
    title: "Analyzing with AI",
    description: "Identifying policy type, scope, and requirements",
  },
  {
    id: "prepare",
    title: "Preparing review",
    description: "Building a draft you can edit before saving",
  },
] as const;

/** Step index advances on a timer while the analyze API runs (often 30–90s). */
const STEP_DELAYS_MS = [0, 6_000, 18_000, 36_000];

export default function ComplianceImportAnalyzeProgressModal({
  document,
  eyebrow = "Import as policy",
  zIndex,
}: {
  document: Pick<
    DocDocument,
    "name" | "mime_type" | "document_type" | "source_url"
  >;
  eyebrow?: string;
  zIndex?: number;
}) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    setActiveStep(0);
    const timers = STEP_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => setActiveStep(index), delay),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [document.name]);

  return (
    <ModalDialog
      title="Analyzing document"
      eyebrow={eyebrow}
      onClose={() => {}}
      closeDisabled
      size="md"
      zIndex={zIndex}
      fullscreenable={false}
      titleClassName="text-xl"
      backdropClassName="bg-slate-950/45"
      headerActions={
        <span className="sr-only" aria-live="polite">
          {ANALYZE_STEPS[activeStep]?.title}
        </span>
      }
    >
      <div className="flex flex-col gap-6 py-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
          <FileTypeIcon
            name={document.name}
            mime_type={document.mime_type}
            document_type={document.document_type}
            source_url={document.source_url}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{document.name}</p>
            <p className="text-xs text-muted-foreground">
              {document.document_type || "Document"}
            </p>
          </div>
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
        </div>

        <p className="text-sm text-muted-foreground">
          This usually takes under a minute. Large PDFs or scanned files can take longer.
          You will review every field before anything is saved.
        </p>

        <ol className="space-y-2" aria-label="Analysis progress">
          {ANALYZE_STEPS.map((step, index) => {
            const done = index < activeStep;
            const current = index === activeStep;
            const pending = index > activeStep;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  current && "border-primary/30 bg-primary/5",
                  done && "border-border bg-muted/30",
                  pending && "border-transparent opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    done && "bg-primary text-primary-foreground",
                    current && "bg-muted text-primary",
                    pending && "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : current ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      current ? "text-foreground" : "text-foreground/90",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-3.5 shrink-0" aria-hidden />
          <span>Do not close this window until analysis finishes.</span>
        </div>
      </div>
    </ModalDialog>
  );
}
