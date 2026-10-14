"use client";

import { Check } from "lucide-react";

type RuleWizardStepperProps = {
  labels: readonly string[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export default function RuleWizardStepper({
  labels,
  activeIndex,
  onSelect,
}: RuleWizardStepperProps) {
  const columnCount = Math.max(labels.length, 1);

  return (
    <ol
      className="grid w-full gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
      aria-label="Rule wizard steps"
    >
      {labels.map((label, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              className={`flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition ${
                isActive
                  ? "border-brand-pink bg-white text-brand-text shadow-sm ring-1 ring-brand-pink/25"
                  : isComplete
                    ? "border-slate-200 bg-white text-slate-700 hover:border-pink-200 hover:bg-pink-50/50"
                    : "border-transparent bg-white/60 text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-600"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  isActive
                    ? "bg-brand-pink text-white"
                    : isComplete
                      ? "bg-pink-100 text-brand-pink"
                      : "bg-slate-100 text-slate-500"
                }`}
                aria-hidden
              >
                {isComplete ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0 truncate text-xs font-semibold">
                {index + 1}. {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
