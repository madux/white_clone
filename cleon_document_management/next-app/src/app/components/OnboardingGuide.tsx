"use client";

import { Check, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOnboarding, useUpdateOnboarding } from "../../../hooks/useDocuments";

type GuideStep = {
  id: string;
  title: string;
  description: string;
  href?: string;
  action?: string;
};

const userSteps: GuideStep[] = [
  {
    id: "workspace",
    title: "Explore your workspace",
    description: "See where personal files, shared documents, archives, and the recycle bin live.",
    href: "/pages/my-documents?guide=workspace",
    action: "Open My Documents",
  },
  {
    id: "upload",
    title: "Upload your first document",
    description: "Add a file, choose its document type, and keep your personal records organized.",
    href: "/pages/my-documents?guide=upload",
    action: "View My Documents",
  },
  {
    id: "approval",
    title: "Understand approvals",
    description: "Learn how a document moves from draft to review and approval when required.",
    href: "/pages/my-documents?guide=approval",
    action: "View approval status",
  },
  {
    id: "shared",
    title: "Open a shared document",
    description: "Review shared files, see who shared them, and acknowledge documents when needed.",
    href: "/pages/my-documents?guide=shared",
    action: "View shared documents",
  },
  {
    id: "search",
    title: "Use workspace search",
    description: "Find documents, employees, folders, and policies from the search bar in the header.",
    href: "/pages/my-documents?guide=search",
    action: "Highlight search",
  },
];

const adminSteps: GuideStep[] = [
  {
    id: "document-types",
    title: "Create document types",
    description: "Set up the categories your organization will use when files are uploaded.",
    href: "/pages/settings?guide=document-types",
    action: "Open Settings",
  },
  {
    id: "approval-workflow",
    title: "Configure approval workflow",
    description: "Choose the review mode and assign approvers. Sequential workflows follow the order you set.",
    href: "/pages/settings?guide=approval-workflow",
    action: "Configure approvals",
  },
  {
    id: "folders",
    title: "Create your folder structure",
    description: "Set up employee and organizational folders for the records your team manages.",
    href: "/pages/organization?guide=folders",
    action: "Open organizational files",
  },
  {
    id: "sharing",
    title: "Define sharing access",
    description: "Choose whether a folder is shared with all staff, departments, grades, or specific employees.",
    href: "/pages/settings?guide=sharing",
    action: "Review access defaults",
  },
  {
    id: "organizational-upload",
    title: "Upload an organizational document",
    description: "Add a company document and confirm that the intended audience can see it in Shared Documents.",
    href: "/pages/organization?guide=organizational-upload",
    action: "Open organizational files",
  },
  {
    id: "approval-inbox",
    title: "Review your Approval Inbox",
    description: "Assigned documents ready for your decision appear under the inbox icon in the header.",
    href: "/pages/my-documents?guide=approval-inbox",
    action: "Highlight approval inbox",
  },
];

export default function OnboardingGuide() {
  const query = useOnboarding();
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

  useEffect(() => {
    setOpen(Boolean(query.data?.show));
  }, [query.data?.show]);

  const steps = useMemo(
    () => (query.data?.is_admin ? [...userSteps, ...adminSteps] : userSteps),
    [query.data?.is_admin],
  );
  const completed = new Set(query.data?.completed_steps ?? []);
  const completedCount = steps.filter((step) => completed.has(step.id)).length;
  const progress = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const nextIncompleteIndex = Math.max(
    0,
    steps.findIndex((step) => !completed.has(step.id)),
  );

  useEffect(() => {
    if (query.data?.show) setActiveIndex(nextIncompleteIndex);
  }, [query.data?.completed_steps, query.data?.show, nextIncompleteIndex]);

  if (!open || !query.data?.show) return null;

  const completeStep = (stepId: string) => {
    update.mutate({ action: "complete_step", step_id: stepId });
  };

  const activeStep = steps[activeIndex] ?? steps[0];
  const activeStepComplete = activeStep ? completed.has(activeStep.id) : false;

  const moveNext = async () => {
    if (!activeStep) return;
    if (!activeStepComplete) {
      await update.mutateAsync({ action: "complete_step", step_id: activeStep.id });
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
    await update.mutateAsync({ action: "complete" });
    setOpen(false);
  };

  const dismiss = async () => {
    clearGuideTarget();
    setOpen(false);
    await update.mutateAsync({ action: "dismiss" });
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
      className="pointer-events-none fixed right-4 top-20 z-[200] w-[min(390px,calc(100vw-2rem))] sm:right-6"
      style={position ? { left: position.x, top: position.y, right: "auto" } : undefined}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="getting-started-title"
        className="pointer-events-auto overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.18)]"
      >
        <div
          onPointerDown={startDragging}
          title="Drag to move this guide"
          className="cursor-grab select-none touch-none bg-gradient-to-br from-brand-text to-brand-pink px-4 py-4 text-white active:cursor-grabbing"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                <CircleHelp className="h-3.5 w-3.5" /> Getting started
              </div>
              <h2 id="getting-started-title" className="mt-1 text-base font-bold tracking-tight">
                Your workspace guide
              </h2>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Skip getting started guide"
              className="rounded-xl p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
              <span>Step {Math.min(activeIndex + 1, steps.length)} of {steps.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Onboarding steps">
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
          {query.data?.is_admin && activeIndex === 0 && (
            <p className="mb-3 rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2 text-[11px] leading-4 text-brand-text">
              This guide includes your everyday user steps and your administrator setup steps.
            </p>
          )}
          <div className="flex items-start gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${activeStepComplete ? "bg-emerald-50 text-emerald-600" : "bg-pink-50 text-brand-pink"}`}>
              {activeStepComplete ? <Check className="h-4 w-4" /> : <span className="text-sm font-bold">{activeIndex + 1}</span>}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">{activeStep?.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{activeStep?.description}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={movePrevious} disabled={activeIndex === 0} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                Skip
              </button>
            </div>
            <div className="flex items-center gap-2">
              {activeStep?.href && (
                <Link href={activeStep.href} onClick={() => completeStep(activeStep.id)} className="inline-flex items-center gap-1 rounded-lg bg-pink-50 px-2.5 py-1.5 text-xs font-bold text-brand-text hover:bg-pink-100">
                  {activeStep.action || "Open"} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {activeIndex === steps.length - 1 ? (
                <button type="button" onClick={finish} disabled={update.isPending} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-brand-text to-brand-pink px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  Finish <Check className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="button" onClick={moveNext} disabled={update.isPending} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-brand-text to-brand-pink px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  {activeStepComplete ? "Next" : "Done & next"} <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold text-slate-400">
          {completedCount} of {steps.length} complete · You can restart this guide from Settings
        </div>
      </section>
    </div>
  );
}
