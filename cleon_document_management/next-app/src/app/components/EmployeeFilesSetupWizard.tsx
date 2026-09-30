"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Filter,
  FolderTree,
  Info,
  Loader2,
  Sparkles,
  UserMinus,
  Users,
  X,
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
import type {
  EmployeeFilesSetupAttentionEmployee,
  EmployeeFilesSetupPreview,
  EmployeeFilesSetupRun,
} from "../../../lib/types";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import AppToolbar from "./AppToolbar";
import ListPagination from "./ListPagination";
import PersonCell from "./PersonCell";
import StatusPill from "./StatusPill";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "../../../hooks/useDocuments";
import UiSwitch from "./UiSwitch";
import ThemedSelect from "./ThemedSelect";
import CheckboxDropdown from "./CheckboxDropdown";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  employeeFileDimensionLabel,
  orderOrganizingDimensions,
  organizingDimensionRole,
} from "../../../lib/employeeFileDimensions";

type Step = "empty" | "dimension" | "options" | "review" | "processing" | "complete";

const WIZARD_PAGE_CLASS = "app-page space-y-6";

const FLOW_STEPS = [
  { id: "dimension", label: "Organization" },
  { id: "options", label: "Initialization Rules" },
  { id: "review", label: "Review" },
  { id: "processing", label: "Processing" },
] as const;

type FlowStepId = (typeof FLOW_STEPS)[number]["id"];

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-text disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-pink-200 hover:bg-pink-50/40";

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
  onFlowStepClick,
  canNavigateToFlowStep,
}: {
  title?: string;
  description?: string;
  step: Step;
  children: ReactNode;
  footer?: ReactNode;
  onFlowStepClick?: (flowStepId: FlowStepId) => void;
  canNavigateToFlowStep?: (index: number, flowStepId: FlowStepId) => boolean;
}) {
  const active = stepIndex(step);

  return (
    <div className={WIZARD_PAGE_CLASS}>
      {active >= 0 ? (
        <ol className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-1 py-2">
          {FLOW_STEPS.map((item, index) => {
            const isCurrent = index === active;
            const isDone = index < active || step === "complete";
            const clickable =
              item.id !== "processing" &&
              Boolean(onFlowStepClick) &&
              (canNavigateToFlowStep?.(index, item.id) ?? false);
            const className = `inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${
              isCurrent
                ? "bg-pink-50 text-brand-text"
                : isDone
                  ? "text-slate-700"
                  : clickable
                    ? "text-slate-600 hover:bg-pink-50/50"
                    : "text-slate-400"
            }`;
            const content = (
              <>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    isCurrent || isDone
                      ? "bg-brand-pink text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isDone && !isCurrent ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                {item.label}
              </>
            );
            return (
              <li key={item.id} className="flex items-center gap-2">
                {clickable ? (
                  <button
                    type="button"
                    className={className}
                    onClick={() => onFlowStepClick?.(item.id)}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={className} aria-current={isCurrent ? "step" : undefined}>
                    {content}
                  </div>
                )}
                {index < FLOW_STEPS.length - 1 ? (
                  <span className="hidden h-px w-8 bg-slate-200 sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {title || description ? (
          <header className="border-b border-slate-200 px-5 py-4 sm:px-6">
            {title ? (
              <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
            ) : null}
          </header>
        ) : null}
        <div className="p-5 sm:p-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </section>
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
  const [primaryDimension, setPrimaryDimension] = useState("");
  const [subOrganizingDimension, setSubOrganizingDimension] = useState("none");
  const [groupingMode, setGroupingMode] = useState<"ems" | "custom" | "none">("ems");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [collectDocs, setCollectDocs] = useState(true);
  const [preview, setPreview] = useState<EmployeeFilesSetupPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedReviewCard, setSelectedReviewCard] = useState<string | null>(null);
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

  useEffect(() => {
    if (groupingMode !== "ems") return;
    const options = dimensions.data ?? [];
    if (!options.length || selectedDimensions.length) return;
    const department = options.find((item) => item.key === "department" && item.populated);
    if (department) {
      setSelectedDimensions(["department"]);
      setPrimaryDimension("department");
    }
  }, [dimensions.data, groupingMode, selectedDimensions.length]);

  const refreshExclusions = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-files", "exclusions"] });
  };

  const primary = selectedDimensions.includes(primaryDimension)
    ? primaryDimension
    : selectedDimensions[0] || "";
  const subDimensionOptions = useMemo(() => {
    return [
      { value: "none", label: "None — keep other views independent" },
      ...selectedDimensions
        .filter((key) => key && key !== primary)
        .map((key) => ({ value: key, label: employeeFileDimensionLabel(key) })),
    ];
  }, [primary, selectedDimensions]);

  const wizardPayload = useMemo(
    () => ({
      organizing_dimensions:
        groupingMode === "none"
          ? []
          : orderOrganizingDimensions(
              selectedDimensions,
              primary,
              subOrganizingDimension,
            ),
      sub_organizing_dimension:
        groupingMode === "none" ? "none" : subOrganizingDimension,
      include_inactive: includeInactive,
      collect_existing_documents: collectDocs,
    }),
    [
      groupingMode,
      primary,
      selectedDimensions,
      subOrganizingDimension,
      includeInactive,
      collectDocs,
    ],
  );

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setError("");
    try {
      const data = await api.previewEmployeeFilesSetup(wizardPayload);
      setPreview(data);
      return true;
    } catch (err: any) {
      setError(err?.message || "Unable to load preview.");
      return false;
    } finally {
      setPreviewLoading(false);
    }
  }, [wizardPayload]);

  useEffect(() => {
    if (step !== "review" && step !== "options") return;
    void refreshPreview();
  }, [step, refreshPreview]);

  const goToReview = async () => {
    setStep("review");
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

  const selectReviewCard = (key: string) => {
    setSelectedReviewCard((current) => (current === key ? null : key));
  };

  const canNavigateToFlowStep = useCallback(
    (_index: number, flowStepId: FlowStepId) => {
      if (step === "processing" || step === "complete") return false;
      if (flowStepId === "processing") return false;
      if (flowStepId === "dimension") return true;
      if (groupingMode === "none") return true;
      return selectedDimensions.length > 0;
    },
    [selectedDimensions.length, step],
  );

  const onFlowStepClick = useCallback(
    (flowStepId: FlowStepId) => {
      if (flowStepId === "processing") return;
      if (step === "processing" || step === "complete") return;
      if (flowStepId !== "dimension" && groupingMode !== "none" && !selectedDimensions.length) return;
      setStep(flowStepId);
    },
    [selectedDimensions.length, step],
  );

  const wizardChrome = {
    onFlowStepClick,
    canNavigateToFlowStep,
  };

  if (config.data?.setup_complete) {
    return null;
  }

  if (step === "empty") {
    return (
      <div className={`${WIZARD_PAGE_CLASS} flex min-h-[60vh] items-center justify-center`}>
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <EmptyTitle className="text-xl">No Employee Files yet</EmptyTitle>
            <EmptyDescription>
              There are currently no Employee Files in the system. Would you like to bring
              employee records from EMS into Employee Files?
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {canSetup ? (
              <Button onClick={() => setStep("dimension")}>
                Set Up Employee Files
                <ChevronRight data-icon="inline-end" />
              </Button>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You do not have permission to run setup. Contact a document administrator.
              </p>
            )}
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (step === "dimension") {
    return (
      <WizardPage
        step={step}
        {...wizardChrome}
        title="How should Employee Files be organized?"
        description="Choose one primary EMS grouping. You may add a single subgroup. Remaining attributes stay independent views."
        footer={
          <button
            type="button"
            disabled={groupingMode !== "none" && !selectedDimensions.length}
            className={PRIMARY_BTN}
            onClick={() => setStep("options")}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        }
      >
        <div className="max-w-xl space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Organization mode
            </p>
            <RadioGroup
              value={groupingMode}
              onValueChange={(value) => {
                const next = (Array.isArray(value) ? value[0] : value) as "ems" | "custom" | "none";
                setGroupingMode(next);
                if (next === "none") {
                  setSelectedDimensions([]);
                  setPrimaryDimension("");
                  setSubOrganizingDimension("none");
                }
              }}
            >
              <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="ems" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">Organize by EMS Attributes</span>
                  <span className="text-xs text-muted-foreground">Default. Department is used when that data exists.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="custom" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">Custom Grouping</span>
                  <span className="text-xs text-muted-foreground">Configure custom groups after setup.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="none" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">No Grouping</span>
                  <span className="text-xs text-muted-foreground">Skip hierarchy and continue to initialization rules.</span>
                </span>
              </label>
            </RadioGroup>
          </div>
          {groupingMode !== "none" ? (
            <>
              <CheckboxDropdown
                label="EMS attributes"
                placeholder="Select organizing dimensions"
                values={selectedDimensions}
                onChange={(values) => {
                  setSelectedDimensions(values);
                  if (!values.includes(primaryDimension)) {
                    setPrimaryDimension(values[0] || "");
                  }
                  if (
                    subOrganizingDimension !== "none" &&
                    (!values.includes(subOrganizingDimension) ||
                      subOrganizingDimension === (values.includes(primaryDimension) ? primaryDimension : values[0]))
                  ) {
                    setSubOrganizingDimension("none");
                  }
                }}
                options={(dimensions.data ?? []).map((option) => ({
                  value: option.key,
                  label: option.label,
                  disabled: !option.populated,
                  hint: option.populated
                    ? "EMS data available"
                    : option.unavailable_reason || `No populated ${option.label} data was found in EMS.`,
                }))}
              />
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Primary group
                </p>
                <ThemedSelect
                  value={primary}
                  onChange={setPrimaryDimension}
                  ariaLabel="Primary dimension"
                  options={
                    selectedDimensions.length
                      ? selectedDimensions.map((key) => ({
                          value: key,
                          label: employeeFileDimensionLabel(key),
                        }))
                      : [{ value: "", label: "Select dimensions first" }]
                  }
                />
              </div>
              <div className="ml-4 rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Add subgroup
                </p>
                <ThemedSelect
                  value={subOrganizingDimension}
                  onChange={setSubOrganizingDimension}
                  options={subDimensionOptions}
                  ariaLabel="Subgroup"
                  disabled={selectedDimensions.length < 2}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. One nested subgroup under the primary group.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Employee Files will be created without a department hierarchy. You can still set
              inclusion, exclusions, and document collection next.
            </p>
          )}
        </div>
        {error ? (
          <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        {...wizardChrome}
        title="Initialization Rules"
        description="Population rules, document collection, and employee exclusions. Each change updates the impact counts below."
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            <button type="button" className={PRIMARY_BTN} onClick={goToReview}>
              Continue to review
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <OptionCard
            title="Include inactive employees"
            description="When on, employees currently marked inactive in EMS are included. Leave off to initialize current staff only."
            checked={includeInactive}
            onChange={() => setIncludeInactive((value) => !value)}
          />
          <OptionCard
            title="Collect existing documents"
            description="Link current employee documents into the new Employee File folders."
            checked={collectDocs}
            onChange={() => setCollectDocs((value) => !value)}
          />
        </div>

        {preview ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <WizardImpactMetric
              icon={Users}
              label="Employees included"
              value={`+${preview.employees_included}`}
              detail="will be initialized from EMS"
              tone="emerald"
            />
            <WizardImpactMetric
              icon={UserMinus}
              label="Employees excluded"
              value={String(preview.excluded_total)}
              detail="skipped by rules or manual list"
              tone="slate"
            />
            <WizardImpactMetric
              icon={FileText}
              label="Documents to collect"
              value={String(preview.documents_expected)}
              detail={collectDocs ? "existing employee documents" : "collection turned off"}
              tone="sky"
            />
          </div>
        ) : previewLoading ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Updating impact counts…
          </p>
        ) : null}

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

  if (step === "review") {
    return (
      <WizardPage
        step={step}
        {...wizardChrome}
        title="Review and confirm"
        description="Counts are loaded from live EMS data each time you open this step."
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={startSetup}
              disabled={previewLoading || !preview}
            >
              Confirm and start setup
            </button>
          </div>
        }
      >
        {previewLoading && !preview ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-brand-pink" />
            Loading preview from EMS…
          </div>
        ) : preview ? (
          <div className="relative">
            {previewLoading ? (
              <p className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-pink" />
                Updating counts…
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <ReviewStatCard
                cardKey="groups"
                label="Groups to create"
                value={preview.groups_to_create}
                selected={selectedReviewCard === "groups"}
                onSelect={selectReviewCard}
              />
              <ReviewStatCard
                cardKey="employees"
                label="Employees included"
                value={preview.employees_included}
                selected={selectedReviewCard === "employees"}
                onSelect={selectReviewCard}
              />
              <ReviewStatCard
                cardKey="documents"
                label="Documents to collect"
                value={preview.documents_expected}
                selected={selectedReviewCard === "documents"}
                onSelect={selectReviewCard}
              />
              <ReviewStatCard
                cardKey="attention"
                label="Will need attention"
                value={preview.need_attention_expected}
                selected={selectedReviewCard === "attention"}
                onSelect={selectReviewCard}
                highlight
              />
              <ReviewStatCard
                cardKey="excluded"
                label="Will be excluded"
                value={preview.excluded_total}
                selected={selectedReviewCard === "excluded"}
                onSelect={selectReviewCard}
              />
            </div>
            {preview.dimension_summaries?.[0] ? (
              <WizardReviewInsight
                icon={Building2}
                title={`${preview.dimension_summaries[0].groups_to_create} ${employeeFileDimensionLabel(preview.dimension_summaries[0].dimension).toLowerCase()}s identified from EMS data`}
                description="These groups will be created when setup runs, based on current EMS attributes."
              />
            ) : null}
            {preview.documents_expected === 0 ? (
              <WizardReviewInsight
                icon={Info}
                title={`${preview.employees_included} employees selected`}
                description="No existing documents were found for collection. You can still add documents after setup."
                tone="muted"
              />
            ) : null}
            {selectedReviewCard ? (
              <ReviewCardDetail
                key={selectedReviewCard}
                preview={preview}
                cardKey={selectedReviewCard}
                wizardPayload={wizardPayload}
              />
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Select a card to inspect the supporting table.
              </p>
            )}
            {preview.employees_included === 0 &&
            (preview.ems_employees_in_company ?? 0) > 0 ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                EMS has {preview.ems_employees_in_company} employee(s) for this company, but none
                match your inclusion rules. Try enabling &quot;Include inactive employees&quot;, or
                check manual exclusions.
              </p>
            ) : null}
            {preview.employees_included === 0 &&
            (preview.ems_employees_in_company ?? 0) === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                No EMS employees were found for the current company. Seed or create employees in
                Odoo, then open Review again from the steps above.
              </p>
            ) : null}
          </div>
        ) : null}
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
        {...wizardChrome}
        title="Setting up Employee Files"
      >
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
        {...wizardChrome}
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
              href="/pages/employee?tab=issues"
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
      className={`rounded-lg border p-4 transition ${
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

function ReviewStatCard({
  cardKey,
  label,
  value,
  selected,
  onSelect,
  highlight,
}: {
  cardKey: string;
  label: string;
  value: number;
  selected: boolean;
  onSelect: (key: string) => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(cardKey)}
      aria-pressed={selected}
      className={`review-card ${selected ? "is-active" : ""} ${
        highlight && !selected ? "is-highlight" : ""
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-[11px] font-semibold text-brand-pink">
        {selected ? "Hide details" : "View details"}
      </p>
    </button>
  );
}

function WizardImpactMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "slate" | "sky";
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white"
      : tone === "sky"
        ? "border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white"
        : "border-slate-200 bg-gradient-to-br from-slate-50/80 to-white";
  const iconStyles =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "sky"
        ? "bg-sky-100 text-sky-700"
        : "bg-slate-100 text-slate-600";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${styles}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function WizardReviewInsight({
  icon: Icon,
  title,
  description,
  tone = "default",
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  tone?: "default" | "muted";
}) {
  const box =
    tone === "muted"
      ? "border-slate-200 bg-slate-50/70"
      : "border-pink-100 bg-gradient-to-r from-pink-50/60 to-white";
  return (
    <div className={`mt-4 flex gap-3 rounded-xl border px-4 py-3.5 ${box}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-pink shadow-sm">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function SetupPreviewAttentionPanel({
  wizardPayload,
  expectedCount,
}: {
  wizardPayload: Record<string, unknown>;
  expectedCount: number;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<EmployeeFilesSetupAttentionEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<
    Array<{ issue_type: string; label: string; count: number }>
  >([]);
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, wizardPayload, issueTypes]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void api
      .listEmployeeFilesSetupAttention(wizardPayload, {
        search,
        issue_types: issueTypes,
        limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
        offset: (page - 1) * EMPLOYEE_FILE_LIST_PAGE_SIZE,
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setCategories(data.categories ?? []);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err?.message || "Unable to load employees.");
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wizardPayload, search, page, issueTypes]);

  const categoryTotal = useMemo(
    () => categories.reduce((sum, row) => sum + row.count, 0),
    [categories],
  );

  const activeFilterCount = issueTypes.length;

  const toggleIssueType = (issueType: string) => {
    setIssueTypes((current) =>
      current.includes(issueType)
        ? current.filter((item) => item !== issueType)
        : [...current, issueType],
    );
  };

  const clearCauseFilters = () => setIssueTypes([]);

  const causeLabel = (issueType: string) =>
    categories.find((row) => row.issue_type === issueType)?.label ?? issueType;

  if (expectedCount === 0) {
    return (
      <div className="review-detail mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-6 text-center text-sm text-emerald-900">
        No employees are expected to need attention for the current rules.
      </div>
    );
  }

  return (
    <div className="review-detail mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white app-table-well">
      <AppToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search name, department, job title, email, ID, branch, grade…"
        extras={
          categories.length > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFiltersExpanded((open) => !open)}
              >
                <Filter data-icon="inline-start" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="text-xs">{activeFilterCount}</span>
                ) : null}
              </Button>
              {activeFilterCount > 0 ? (
                <Button type="button" variant="ghost" onClick={clearCauseFilters}>
                  <X data-icon="inline-start" />
                  Reset
                </Button>
              ) : null}
            </>
          ) : null
        }
        footer={
          <>
            {filtersExpanded && categories.length > 0 ? (
              <div
                className="employee-filter-panel w-full"
                role="region"
                aria-label="Issue cause filters"
              >
                <section className="employee-filter-section">
                  <h3 className="employee-filter-section-title">Issue cause</h3>
                  <div className="employee-filter-options">
                    {categories.map((row) => (
                      <label key={row.issue_type} className="employee-filter-checkbox">
                        <input
                          type="checkbox"
                          name={`cause-${row.issue_type}`}
                          checked={issueTypes.includes(row.issue_type)}
                          onChange={() => toggleIssueType(row.issue_type)}
                          className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                        />
                        <span>
                          {row.label}{" "}
                          <span className="text-slate-400">({row.count})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
            {activeFilterCount > 0 || search.trim() ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                {search.trim() ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
                    Search: {search.trim()}
                    <button type="button" onClick={() => setSearchInput("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {issueTypes.map((issueType) => (
                  <span
                    key={issueType}
                    className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink"
                  >
                    {causeLabel(issueType)}
                    <button type="button" onClick={() => toggleIssueType(issueType)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    clearCauseFilters();
                  }}
                  className="ml-auto text-xs font-semibold text-slate-500 hover:text-brand-pink"
                >
                  Clear all
                </button>
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              Showing {total} of {categoryTotal} employee
              {categoryTotal === 1 ? "" : "s"}
            </p>
          </>
        }
      />
      {error ? (
        <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {loading && !rows.length ? (
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand-pink" />
          Loading employees…
        </div>
      ) : (
        <table className="app-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2.5 text-left">Employee</th>
              <th className="px-4 py-2.5 text-left">Issue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee_id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">
                  <PersonCell
                    name={row.employee_name}
                    subtitle={
                      [row.job_title, row.department_name].filter(Boolean).join(" · ") ||
                      undefined
                    }
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="ef-issue-summary max-w-md">
                    <p className="ef-issue-summary__title">{causeLabel(row.issue_type)}</p>
                    {row.issue && row.issue !== causeLabel(row.issue_type) ? (
                      <p className="ef-issue-summary__name">{row.issue}</p>
                    ) : null}
                    <div className="ef-issue-summary__meta">
                      <StatusPill tone="attention" label="Needs attention" />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-8 text-center text-slate-500" colSpan={2}>
                  No employees match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
      <div className="border-t border-slate-100 px-2">
        <ListPagination
          page={page}
          pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function ReviewCardDetail({
  preview,
  cardKey,
  wizardPayload,
}: {
  preview: EmployeeFilesSetupPreview;
  cardKey: string;
  wizardPayload: Record<string, unknown>;
}) {
  const summaries = preview.dimension_summaries ?? [];
  const groups = preview.group_breakdown ?? [];
  const excludedRows = Object.entries(preview.excluded_breakdown || {}).map(
    ([reason, count]) => ({
      reason: reason.replace(/_/g, " "),
      count,
    }),
  );

  if (cardKey === "groups") {
    return (
      <div className="review-detail mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2.5">Dimension</th>
              <th className="px-4 py-2.5">Group</th>
              <th className="px-4 py-2.5">Employees</th>
              <th className="px-4 py-2.5">Documents</th>
            </tr>
          </thead>
          <tbody>
            {(summaries.length
              ? summaries.flatMap((summary) =>
                  summary.group_breakdown.map((row) => ({
                    dimension: `${employeeFileDimensionLabel(summary.dimension)} (${organizingDimensionRole(
                      summary.dimension,
                      preview.primary_organizing_dimension || preview.organizing_dimensions[0],
                      preview.sub_organizing_dimension,
                    )})`,
                    ...row,
                  })),
                )
              : groups.map((row) => ({ dimension: "Primary", ...row }))
            ).map((row, index) => (
              <tr key={`${row.dimension}-${row.name}-${index}`} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-600">{row.dimension}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.employees}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.documents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (cardKey === "employees") {
    return (
      <div className="review-detail mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2.5">View</th>
              <th className="px-4 py-2.5">Groups</th>
              <th className="px-4 py-2.5">Employees in groups</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.dimension} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-semibold text-slate-800">
                  {employeeFileDimensionLabel(summary.dimension)}{" "}
                  <span className="font-normal text-slate-500">
                    (
                    {organizingDimensionRole(
                      summary.dimension,
                      preview.primary_organizing_dimension || preview.organizing_dimensions[0],
                      preview.sub_organizing_dimension,
                    )}
                    )
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{summary.groups_to_create}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {summary.group_breakdown.reduce((sum, row) => sum + row.employees, 0)}
                </td>
              </tr>
            ))}
            {!summaries.length ? (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-2.5" colSpan={3}>
                  {preview.employees_included} employees match the current inclusion rules.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  if (cardKey === "documents") {
    return (
      <div className="review-detail mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2.5">Group</th>
              <th className="px-4 py-2.5">Documents</th>
              <th className="px-4 py-2.5">Employees</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((row) => (
              <tr key={row.name} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.documents}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.employees}</td>
              </tr>
            ))}
            {!groups.length ? (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-2.5" colSpan={3}>
                  {preview.documents_expected} existing documents will be collected.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  if (cardKey === "attention") {
    return (
      <SetupPreviewAttentionPanel
        wizardPayload={wizardPayload}
        expectedCount={preview.need_attention_expected}
      />
    );
  }

  return (
    <div className="review-detail mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-2.5">Exclusion reason</th>
            <th className="px-4 py-2.5">Employees</th>
          </tr>
        </thead>
        <tbody>
          {excludedRows.map((row) => (
            <tr key={row.reason} className="border-t border-slate-100">
              <td className="px-4 py-2.5 font-semibold capitalize text-slate-800">
                {row.reason}
              </td>
              <td className="px-4 py-2.5 tabular-nums">{row.count}</td>
            </tr>
          ))}
          {!excludedRows.length ? (
            <tr className="border-t border-slate-100">
              <td className="px-4 py-2.5" colSpan={2}>
                No employees are currently excluded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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
