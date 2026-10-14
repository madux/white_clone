"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import RuleWizardStepper from "./RuleWizardStepper";

type PolicyEngineWizardChromeProps = {
  title: string;
  stepperLabels: readonly string[];
  stepperActiveIndex: number;
  onStepSelect: (index: number) => void;
  children: ReactNode;
  showFooter: boolean;
  wizardStep: number;
  onCancel: () => void;
  onBack: () => void;
  continueLabel: string;
  showContinueArrow: boolean;
  formId: string;
  /** Use full main-column width (e.g. retention configure step with wide tables). */
  fullWidth?: boolean;
};

export function PolicyEngineWizardPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">
        Compliance / Policies /{" "}
        <span className="text-brand-pink">New policy</span>
      </p>
      <h1 className="text-3xl font-medium text-slate-900">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default function PolicyEngineWizardChrome({
  title,
  stepperLabels,
  stepperActiveIndex,
  onStepSelect,
  children,
  showFooter,
  wizardStep,
  onCancel,
  onBack,
  continueLabel,
  showContinueArrow,
  formId,
  fullWidth = false,
}: PolicyEngineWizardChromeProps) {
  return (
    <div
      className={
        fullWidth
          ? "min-h-full w-full max-w-none space-y-8 bg-white px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10"
          : "app-page min-h-full w-full space-y-8 pb-10"
      }
    >
      <PolicyEngineWizardPageHeader title={title} />

      <RuleWizardStepper
        labels={stepperLabels}
        activeIndex={stepperActiveIndex}
        onSelect={onStepSelect}
      />

      <section
        className={
          fullWidth
            ? "w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-6 lg:p-8"
            : "rounded-2xl border border-slate-200 bg-white p-6"
        }
      >
        {children}
      </section>

      {showFooter ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            {wizardStep > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Back
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              form={formId}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white"
            >
              {continueLabel}
              {showContinueArrow ? (
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              ) : null}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
