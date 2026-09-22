"use client";

import { Check, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOnboarding, useUpdateOnboarding } from "../../../hooks/useDocuments";
import { useEmployeeFilesConfig } from "../../../hooks/useEmployeeFiles";
import {
  ONBOARDING_MODULE_META,
  type OnboardingModuleId,
  stepsForModule,
} from "../../../lib/onboardingModules";

export default function ModuleOnboardingGuide({ module }: { module: OnboardingModuleId }) {
  const query = useOnboarding();
  const employeeConfig = useEmployeeFilesConfig();
  const update = useUpdateOnboarding();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  const moduleState = query.data?.modules?.[module];
  const meta = ONBOARDING_MODULE_META[module];

  const steps = useMemo(
    () => stepsForModule(module, Boolean(query.data?.is_admin)),
    [module, query.data?.is_admin],
  );

  useEffect(() => {
    const keepInViewport = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      setPosition((current) => {
        if (!current) return current;
        return {
          x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, current.x)),
          y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, current.y)),
        };
      });
    };

    window.addEventListener("resize", keepInViewport);
    return () => window.removeEventListener("resize", keepInViewport);
  }, []);

  useEffect(() => {
    setOpen(Boolean(moduleState?.show));
  }, [moduleState?.show]);

  const completed = new Set(moduleState?.completed_steps ?? []);
  const completedCount = steps.filter((step) => completed.has(step.id)).length;
  const progress = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const nextIncompleteIndex = Math.max(
    0,
    steps.findIndex((step) => !completed.has(step.id)),
  );

  useEffect(() => {
    if (moduleState?.show) setActiveIndex(nextIncompleteIndex);
  }, [moduleState?.completed_steps, moduleState?.show, nextIncompleteIndex]);

  if (
    module === "employee_files" &&
    (employeeConfig.isLoading || !employeeConfig.data?.setup_complete)
  ) {
    return null;
  }

  if (!steps.length || !open || !moduleState?.show) return null;

  const completeStep = (stepId: string) => {
    update.mutate({ action: "complete_step", module, step_id: stepId });
  };

  const activeStep = steps[activeIndex] ?? steps[0];
  const activeStepComplete = activeStep ? completed.has(activeStep.id) : false;

  const moveNext = async () => {
    if (!activeStep) return;
    if (!activeStepComplete) {
      await update.mutateAsync({
        action: "complete_step",
        module,
        step_id: activeStep.id,
      });
    }
    setActiveIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const movePrevious = () => {
    setActiveIndex((index) => Math.max(index - 1, 0));
  };

  const clearGuideTarget = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("guide")) return;
    url.searchParams.delete("guide");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  };

  const finish = async () => {
    clearGuideTarget();
    await update.mutateAsync({ action: "complete", module });
    setOpen(false);
  };

  const dismiss = async () => {
    clearGuideTarget();
    setOpen(false);
    await update.mutateAsync({ action: "dismiss", module });
  };

  const startDragging = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    setPosition({ x: rect.left, y: rect.top });

    const move = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const x = Math.max(
        8,
        Math.min(window.innerWidth - drag.width - 8, moveEvent.clientX - drag.offsetX),
      );
      const y = Math.max(
        8,
        Math.min(window.innerHeight - drag.height - 8, moveEvent.clientY - drag.offsetY),
      );
      setPosition({ x, y });
    };
    const stopDragging = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stopDragging);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stopDragging);
  };

  return (
    <div
      className="guide-positioned pointer-events-none fixed right-4 z-[200] w-[min(390px,calc(100vw-1.5rem))] sm:right-6"
      style={position ? { left: position.x, top: position.y, right: "auto" } : undefined}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`guide-title-${module}`}
        className="pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.18)]"
      >
        <div
          onPointerDown={startDragging}
          title="Drag to move this guide"
          className="cursor-grab select-none touch-none bg-gradient-to-br from-brand-text to-brand-pink px-4 py-4 text-white active:cursor-grabbing"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                <CircleHelp className="h-3.5 w-3.5" /> {meta.label}
              </div>
              <h2 id={`guide-title-${module}`} className="mt-1 text-base font-bold tracking-tight">
                {meta.subtitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={`Skip ${meta.label} guide`}
              className="rounded-xl p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
              <span>
                Step {Math.min(activeIndex + 1, steps.length)} of {steps.length}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Guide steps">
              {steps.map((step, index) => {
                const done = completed.has(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    title={`${index + 1}. ${step.title}`}
                    aria-label={`Step ${index + 1}: ${step.title}`}
                    aria-current={activeIndex === index ? "step" : undefined}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold transition ${done ? "bg-emerald-500 text-white" : activeIndex === index ? "bg-brand-pink text-white shadow-sm" : "bg-slate-100 text-slate-400 hover:bg-pink-50 hover:text-brand-text"}`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${activeStepComplete ? "bg-emerald-50 text-emerald-600" : "bg-pink-50 text-brand-pink"}`}
              >
                {activeStepComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-bold">{activeIndex + 1}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{activeStep?.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{activeStep?.description}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={movePrevious}
                  disabled={activeIndex === 0}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  Skip
                </button>
              </div>
              <div className="flex items-center gap-2">
                {activeStep?.href ? (
                  <Link
                    href={activeStep.href}
                    onClick={() => completeStep(activeStep.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-pink-50 px-2.5 py-1.5 text-xs font-bold text-brand-text hover:bg-pink-100"
                  >
                    {activeStep.action || "Open"} <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                {activeIndex === steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={finish}
                    disabled={update.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-brand-text to-brand-pink px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Finish <Check className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={moveNext}
                    disabled={update.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-brand-text to-brand-pink px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {activeStepComplete ? "Next" : "Done & next"}{" "}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold text-slate-400">
          {completedCount} of {steps.length} complete · Restart from Settings → Help & onboarding
        </div>
      </section>
    </div>
  );
}
