"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FolderTree,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { api } from "../../../lib/api";
import {
  useConfirmEmployeeFilesSetup,
  useEmployeeFileDimensions,
  useEmployeeFileExclusions,
  useEmployeeFilesConfig,
  EMPLOYEE_FILES_KEYS,
} from "../../../hooks/useEmployeeFiles";
import EmployeeFilesExclusionDialog from "./EmployeeFilesExclusionDialog";
import { useQueryClient } from "@tanstack/react-query";
import type { EmployeeFilesSetupPreview, EmployeeFilesSetupRun } from "../../../lib/types";
import { useCurrentUser } from "../../../hooks/useDocuments";
import UiSwitch from "./UiSwitch";

type Step = "empty" | "dimension" | "options" | "review" | "processing" | "complete";

const WIZARD_PAGE_CLASS =
  "min-h-full mx-auto w-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10";

const FLOW_STEPS = [
  { id: "dimension", label: "Organization" },
  { id: "options", label: "Options" },
  { id: "review", label: "Review" },
  { id: "processing", label: "Setup" },
] as const;

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(232,62,140,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-pink-200 hover:bg-pink-50/30";

function stepIndex(step: Step): number {
  if (step === "dimension") return 0;
  if (step === "options") return 1;
  if (step === "review") return 2;
  if (step === "processing" || step === "complete") return 3;
  return -1;
}

function WizardPage({
  title,
  description,
  step,
  children,
  footer,
}: {
  title: string;
  description?: string;
  step: Step;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const active = stepIndex(step);

  return (
    <div className={WIZARD_PAGE_CLASS}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Employee Files
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
      </div>

      {active >= 0 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_STEPS.map((item, index) => {
            const isCurrent = index === active;
            const isDone = index < active || step === "complete";
            return (
              <li
                key={item.id}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                  isCurrent
                    ? "border-brand-pink bg-pink-50 text-brand-text"
                    : isDone
                      ? "border-slate-200 bg-white text-slate-700"
                      : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isDone && !isCurrent ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-pink" />
                  ) : (
                    <span className="text-[10px] opacity-80">{index + 1}.</span>
                  )}
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </section>

      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3">{footer}</div>
      ) : null}
    </div>
  );
}

export default function EmployeeFilesSetupWizard() {
  const user = useCurrentUser();
  const config = useEmployeeFilesConfig();
  const dimensions = useEmployeeFileDimensions();
  const manualExclusions = useEmployeeFileExclusions("manual");
  const confirm = useConfirmEmployeeFilesSetup();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("empty");
  const [exclusionDialog, setExclusionDialog] = useState<"select" | "view" | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [excludeTest, setExcludeTest] = useState(true);
  const [collectDocs, setCollectDocs] = useState(true);
  const [preview, setPreview] = useState<EmployeeFilesSetupPreview | null>(null);
  const [run, setRun] = useState<EmployeeFilesSetupRun | null>(null);
  const [liveRun, setLiveRun] = useState<EmployeeFilesSetupRun | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const canSetup = user.data?.is_document_admin === true;
  const manualExclusionCount = manualExclusions.data?.length ?? 0;

  useEffect(() => {
    if (config.isLoading || config.data?.setup_complete || step !== "empty") return;
    let cancelled = false;
    void api.getEmployeeFilesSetupStatus().then((data) => {
      if (cancelled || !data || data.state !== "running") return;
      setActiveRunId(data.id);
      setLiveRun(data);
      setStep("processing");
    });
    return () => {
      cancelled = true;
    };
  }, [config.isLoading, config.data?.setup_complete, step]);

  const refreshExclusions = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-files", "exclusions"] });
  };
  const wizardPayload = useMemo(
    () => ({
      organizing_dimensions: selectedDimensions,
      include_inactive: includeInactive,
      exclude_test_employees: excludeTest,
      collect_existing_documents: collectDocs,
    }),
    [selectedDimensions, includeInactive, excludeTest, collectDocs],
  );

  const loadPreview = async () => {
    setError("");
    try {
      const data = await api.previewEmployeeFilesSetup(wizardPayload);
      setPreview(data);
      setStep("review");
    } catch (err: any) {
      setError(err?.message || "Unable to load preview.");
    }
  };

  const finishSetup = async (data: EmployeeFilesSetupRun) => {
    await queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.config });
    setRun(data);
    setLiveRun(data);
    setActiveRunId(null);
    setStep("complete");
  };

  const startSetup = async () => {
    setError("");
    setStep("processing");
    setLiveRun(null);
    try {
      const data = await confirm.mutateAsync(wizardPayload);
      setActiveRunId(data.id);
      setLiveRun(data);
      if (data.state === "done") {
        await finishSetup(data);
        return;
      }
      if (data.state === "failed") {
        setError("Setup failed.");
        setStep("review");
        setActiveRunId(null);
      }
    } catch (err: any) {
      setError(err?.message || "Setup failed.");
      setStep("review");
      setActiveRunId(null);
    }
  };

  useEffect(() => {
    if (step !== "processing" || !activeRunId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await api.getEmployeeFilesSetupStatus(activeRunId);
        if (cancelled || !data) return;
        setLiveRun(data);
        if (data.state === "done") {
          await finishSetup(data);
        } else if (data.state === "failed") {
          setError("Setup failed. You can review options and try again.");
          setStep("review");
          setActiveRunId(null);
        }
      } catch {
        /* keep polling */
      }
    };

    poll();
    const timer = window.setInterval(poll, 800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [step, activeRunId, queryClient]);

  const toggleDimension = (key: string) => {
    setSelectedDimensions((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  };

  if (config.data?.setup_complete) {
    return null;
  }

  if (step === "empty") {
    return (
      <div className={WIZARD_PAGE_CLASS}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Employee Files
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Set up Employee Files
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Connect to EMS, create one file per employee, and organize folders automatically.
          </p>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50/80 to-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-pink shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-xl font-bold tracking-tight text-slate-900">
              No Employee Files have been organized yet
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
              Run the guided setup to choose how groups are built from EMS, which employees to
              include, and whether to link existing documents into the new structure.
            </p>
            {canSetup ? (
              <button
                type="button"
                className={`mt-8 ${PRIMARY_BTN}`}
                onClick={() => setStep("dimension")}
              >
                Set Up Employee Files
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You do not have permission to run setup. Contact a document administrator.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              What happens
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <li className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
                <span>
                  <strong className="text-slate-800">EMS sync:</strong> Employee records drive
                  membership and system-managed groups.
                </span>
              </li>
              <li className="flex gap-3">
                <FolderTree className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
                <span>
                  <strong className="text-slate-800">Automatic folders:</strong> Each included
                  employee gets a dedicated file storage folder.
                </span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
                <span>
                  <strong className="text-slate-800">Reconciliation:</strong> Issues are logged for
                  anything that needs attention after setup.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    );
  }

  if (step === "dimension") {
    return (
      <WizardPage
        step={step}
        title="How should Employee Files be organized?"
        description="Choose one or more EMS dimensions. System-managed groups are created from the values in each dimension you select."
        footer={
          <>
            <button type="button" className={SECONDARY_BTN} onClick={() => setStep("empty")}>
              Back
            </button>
            <button
              type="button"
              disabled={!selectedDimensions.length}
              className={PRIMARY_BTN}
              onClick={() => setStep("options")}
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(dimensions.data ?? []).map((option) => {
            const active = selectedDimensions.includes(option.key);
            const disabled = !option.populated;
            return (
              <button
                key={option.key}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && toggleDimension(option.key)}
                className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-brand-pink bg-pink-50/60 shadow-sm"
                    : "border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/20"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    active ? "border-brand-pink" : "border-slate-300"
                  }`}
                >
                  {active ? <span className="h-2.5 w-2.5 rounded-full bg-brand-pink" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {option.populated
                      ? "EMS data available for this dimension"
                      : "No EMS data — cannot select"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </WizardPage>
    );
  }

  if (step === "options") {
    return (
      <WizardPage
        step={step}
        title="Additional options"
        description="Fine-tune who is included and how existing documents are handled during the first sync."
        footer={
          <>
            <button type="button" className={SECONDARY_BTN} onClick={() => setStep("dimension")}>
              Back
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={loadPreview}>
              Continue to review
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <OptionCard
            title="Inactive employees"
            description="Create Employee Files for employees marked inactive in EMS."
            checked={includeInactive}
            onChange={() => setIncludeInactive((value) => !value)}
          />
          <OptionCard
            title="Exclude test employees"
            description="Skip employees flagged as test records when EMS provides that signal."
            checked={excludeTest}
            onChange={() => setExcludeTest((value) => !value)}
          />
          <OptionCard
            title="Collect existing documents"
            description="Link current employee documents into the new Employee File folders."
            checked={collectDocs}
            onChange={() => setCollectDocs((value) => !value)}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Optional
          </p>
          <h3 className="mt-2 text-sm font-bold text-slate-900">Employee exclusions</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Select specific EMS employees to skip during file creation. Exclusions can be managed
            later in Settings without re-running this wizard.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-800">
            {manualExclusionCount} employee{manualExclusionCount === 1 ? "" : "s"} selected for
            exclusion
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BTN}
              onClick={() => setExclusionDialog("select")}
            >
              Select employees
            </button>
            <button
              type="button"
              className={SECONDARY_BTN}
              disabled={!manualExclusionCount}
              onClick={() => setExclusionDialog("view")}
            >
              View excluded
            </button>
          </div>
        </div>

        {exclusionDialog ? (
          <EmployeeFilesExclusionDialog
            mode={exclusionDialog}
            exclusions={manualExclusions.data ?? []}
            onClose={() => setExclusionDialog(null)}
            onSaved={refreshExclusions}
            onRemoved={refreshExclusions}
          />
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </WizardPage>
    );
  }

  if (step === "review" && preview) {
    return (
      <WizardPage
        step={step}
        title="Review and confirm"
        description="These counts are estimated from your EMS data and the options you selected."
        footer={
          <>
            <button type="button" className={SECONDARY_BTN} onClick={() => setStep("options")}>
              Back
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={startSetup}>
              Confirm and start setup
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Stat label="Groups to create" value={preview.groups_to_create} />
          <Stat label="Employees included" value={preview.employees_included} />
          <Stat label="Documents to collect" value={preview.documents_expected} />
          <Stat label="Will need attention" value={preview.need_attention_expected} highlight />
          <Stat label="Will be excluded" value={preview.excluded_total} />
        </div>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </WizardPage>
    );
  }

  if (step === "processing") {
    const stages = liveRun?.stages ?? [];
    const anyInProgress = stages.some((s) => s.status === "in_progress");
    return (
      <WizardPage
        step={step}
        title="Setting up Employee Files"
        description="Processing continues on the server if you leave this page. You can return anytime to see live progress."
      >
        <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
          Automatic processing is running in the background. Stage counters update as EMS employees
          and documents are handled.
        </div>

        {stages.length ? (
          <SetupStagesProgress stages={stages} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-brand-pink" />
            <p className="mt-4 text-sm font-semibold text-slate-800">Starting setup…</p>
          </div>
        )}

        {anyInProgress ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-pink" />
            Updating progress…
          </p>
        ) : null}
      </WizardPage>
    );
  }

  if (step === "complete" && run) {
    return (
      <WizardPage
        step={step}
        title="Setup complete"
        description="Employee Files is ready. Open the home view or review reconciliation issues."
      >
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Initialization finished</p>
              <p className="mt-1 text-sm text-slate-500">
                {run.files_initialized} employee file
                {run.files_initialized === 1 ? "" : "s"} created from {run.employees_found} EMS
                employee{run.employees_found === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Employees found" value={run.employees_found} />
          <Stat label="Files initialized" value={run.files_initialized} />
          <Stat label="Documents collected" value={run.documents_collected} />
          <Stat label="Need attention" value={run.need_attention} highlight={run.need_attention > 0} />
        </div>

        {run.stages?.length ? (
          <div className="mt-6">
            <SetupStagesProgress stages={run.stages} />
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/pages/employee" className={PRIMARY_BTN}>
            Open Employee Files
          </Link>
          {run.need_attention > 0 ? (
            <Link
              href="/pages/employee/issues"
              className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-900"
            >
              View Issues ({run.need_attention})
            </Link>
          ) : (
            <Link href="/pages/employee/issues" className={SECONDARY_BTN}>
              View Issues
            </Link>
          )}
        </div>
      </WizardPage>
    );
  }

  return null;
}

function OptionCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        checked ? "border-pink-200 bg-pink-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <UiSwitch checked={checked} onChange={onChange} label={title} />
      </div>
    </div>
  );
}

type SetupStage = EmployeeFilesSetupRun["stages"][number];

function stageStatusLabel(status: SetupStage["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

function stageCountLabel(stage: SetupStage): string {
  if (stage.total_count <= 0 && stage.status === "completed") {
    return "—";
  }
  if (stage.stage_key === "connect_ems" || stage.stage_key === "finalize") {
    return stage.status === "completed" ? "1 / 1" : "0 / 1";
  }
  return `${stage.done_count} / ${stage.total_count}`;
}

function SetupStagesProgress({ stages }: { stages: SetupStage[] }) {
  return (
    <ul className="space-y-3">
      {stages.map((stage) => {
        const pct =
          stage.total_count > 0
            ? Math.min(100, Math.round((stage.done_count / stage.total_count) * 100))
            : stage.status === "completed"
              ? 100
              : 0;
        const status = stage.status;
        return (
          <li
            key={stage.stage_key}
            className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{stage.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold tabular-nums text-slate-700">
                  {stageCountLabel(stage)}
                </span>
                <StageStatusBadge status={status} />
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  status === "failed"
                    ? "bg-red-400"
                    : status === "completed"
                      ? "bg-emerald-500"
                      : "bg-brand-pink"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StageStatusBadge({ status }: { status: SetupStage["status"] }) {
  const styles =
    status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "in_progress"
        ? "border-pink-200 bg-pink-50 text-brand-text"
        : status === "failed"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-white text-slate-500";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles}`}
    >
      {status === "in_progress" ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : null}
      {stageStatusLabel(status)}
    </span>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight
          ? "border-amber-200 bg-amber-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
