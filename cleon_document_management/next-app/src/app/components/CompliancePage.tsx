"use client";

import { 
  ClipboardCheck,
  Ban,
  FileText,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  RotateCcw,
  ToggleLeft,
  Trash2,
  Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ComplianceRequestScheduleFields from "./ComplianceRequestScheduleFields";
import ComplianceRequestTaskList from "./ComplianceRequestTaskList";
import { formatFieldLabel, formatStatusLabel } from "../../../lib/formatLabel";
import {
  buildCreatePolicyPayload,
  defaultPolicyForm,
  type PolicyCreateFormState,
  type PolicyReviewMeta,
} from "../../../lib/policyCreateForm";
import { validatePolicyCreateForm } from "../../../lib/policyCreateValidation";
import { TASK_TYPE_LABELS } from "../../../lib/complianceRequestTasks";
import {
  coerceEffectiveDate,
  coercePolicyAppliesTo,
  coercePolicyAuditFrequency,
  coercePolicyEventTrigger,
  coercePolicySchedule,
} from "../../../lib/policyFieldCoercion";
import { proposalToForm, reviewMetaFromProposal } from "../../../lib/policyProposal";
import {
  emptyPolicyScope,
  formatPolicyScopeSummary,
} from "../../../lib/policyScope";
import { PolicyAudienceFilters } from "./PolicyAudienceFilters";
import { useClientPagination } from "../../../lib/useClientPagination";
import ListPagination from "./ListPagination";
import {
  useComplianceTargets,
  useCreateException,
  useApproveException,
  useDeactivateException,
  useDeleteException,
  useCreatePolicy,
  useDeletePolicy,
  useDocumentTypes,
  useEvaluatePolicy,
  useEvaluationRuns,
  useExceptions,
  useReactivateException,
  useRejectException,
  usePolicies,
  usePolicyTypes,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";
import BulkActionBar from "./BulkActionBar";
import ComplianceRuleActions from "./ComplianceRuleActions";
import ModalDialog from "./ModalDialog";
import ComplianceDocumentTypeMultiSelect from "./ComplianceDocumentTypeMultiSelect";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";
import {
  AUDIT_FREQUENCY_LABELS,
  EVENT_TRIGGER_LABELS,
} from "../../../lib/complianceCopy";
import {
  documentTypesForCompliancePolicy,
  pruneDocumentTypeIdsForPolicy,
} from "../../../lib/complianceDocumentTypes";
import type { DocumentType } from "../../../lib/types";
import ComplianceReportsPanel from "./ComplianceReportsPanel";
import EmployeeMetricPicker from "./EmployeeMetricPicker";
import SectionTabs from "./SectionTabs";
import ComplianceRuleReviewScreen from "./ComplianceRuleReviewScreen";
import ComplianceRetentionFields, {
  useRetentionPreview,
} from "./ComplianceRetentionFields";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type Tab = "rules" | "exceptions" | "history" | "reports";
const AI_BRIEF_CHIPS = [
  { label: "Who it applies to", text: "Applies to all employees." },
  { label: "What's required", text: "Staff must complete the required documents." },
  { label: "When it starts", text: "Takes effect from the activation date." },
];
const schedules = [
  "manual",
  "one_time",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
  "custom",
];

export default function CompliancePage({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showConfirm, showAlert } = useAppDialog();
  const [tab, setTab] = useState<Tab>("rules");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [policyPath, setPolicyPath] = useState<"chooser" | "ai" | null>(null);
  const [aiName, setAiName] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiPolicyTypeId, setAiPolicyTypeId] = useState("");
  const [aiDocumentTypeIds, setAiDocumentTypeIds] = useState<number[]>([]);
  const [aiPending, setAiPending] = useState(false);
  const [reviewPolicyId, setReviewPolicyId] = useState<number | null>(null);
  const [policySubmitError, setPolicySubmitError] = useState("");
  const [policyReviewMeta, setPolicyReviewMeta] = useState<PolicyReviewMeta | undefined>();
  const [policyFormInitialStep, setPolicyFormInitialStep] = useState<
    "configure" | "review"
  >("configure");
  const [running, setRunning] = useState(false);
  const policies = usePolicies();
  const exceptions = useExceptions();
  const runs = useEvaluationRuns();
  const types = usePolicyTypes();
  const documents = useDocumentTypes();
  const targets = useComplianceTargets();
  const createPolicy = useCreatePolicy();
  const createException = useCreateException();
  const evaluate = useEvaluatePolicy();
  const deletePolicy = useDeletePolicy();
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<number[]>([]);
  const [selectedExceptionIds, setSelectedExceptionIds] = useState<number[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const approveException = useApproveException();
  const rejectException = useRejectException();
  const deactivateException = useDeactivateException();
  const deleteException = useDeleteException();
  const [policyForm, setPolicyForm] = useState(() => defaultPolicyForm(""));

  useEffect(() => {
    if (!policyForm.policy_type_id && types.data && types.data.length > 0) {
      setPolicyForm((prev) => ({
        ...prev,
        policy_type_id: String(types.data[0].id),
      }));
    }
  }, [types.data, policyForm.policy_type_id]);

  useEffect(() => {
    if (!aiPolicyTypeId && types.data && types.data.length > 0) {
      setAiPolicyTypeId(String(types.data[0].id));
    }
  }, [types.data, aiPolicyTypeId]);

  const aiPolicyTypeCode = useMemo(() => {
    const match = (types.data ?? []).find(
      (item) => String(item.id) === aiPolicyTypeId,
    );
    return match?.code ?? "";
  }, [types.data, aiPolicyTypeId]);

  const aiSelectableDocumentTypes = useMemo(
    () =>
      documentTypesForCompliancePolicy(
        aiPolicyTypeCode,
        documents.data ?? [],
      ),
    [aiPolicyTypeCode, documents.data],
  );

  useEffect(() => {
    if (!documents.data?.length) return;
    const pruned = pruneDocumentTypeIdsForPolicy(
      aiPolicyTypeCode,
      aiDocumentTypeIds,
      documents.data,
    );
    if (pruned.length !== aiDocumentTypeIds.length) {
      setAiDocumentTypeIds(pruned);
      return;
    }
    if (aiDocumentTypeIds.length) return;
    const first = aiSelectableDocumentTypes[0];
    if (first) setAiDocumentTypeIds([first.id]);
  }, [
    aiDocumentTypeIds,
    aiPolicyTypeCode,
    aiSelectableDocumentTypes,
    documents.data,
  ]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setTab("rules");
      const path = searchParams.get("path");
      if (path === "ai") {
        setPolicyPath("ai");
        setShowForm(false);
      } else if (path === "wizard" || path === "scratch") {
        setPolicyPath(null);
        setPolicyFormInitialStep("configure");
        setPolicyReviewMeta(undefined);
        setShowForm(true);
      } else {
        setPolicyPath("chooser");
        setShowForm(false);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const ruleId = Number(
      searchParams.get("rule") || searchParams.get("policy") || 0,
    );
    if (ruleId > 0) {
      setTab("rules");
      setReviewPolicyId(ruleId);
    }
  }, [searchParams]);

  const [exceptionForm, setExceptionForm] = useState({
    employee_ids: [] as number[],
    policy_id: "",
    reason: "",
    valid_until: "",
  });
  const displayedPolicies = (policies.data ?? []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const displayedExceptions = (exceptions.data ?? []).filter((item) =>
    `${item.employee} ${item.policy} ${item.reason}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    setPolicySubmitError("");
    try {
      await createPolicy.mutateAsync(buildCreatePolicyPayload(policyForm));
    } catch (error: any) {
      setPolicySubmitError(error?.message || "Failed to create rule.");
      return;
    }
    await showAlert(
      "Rule saved as draft. Activate it in Compliance when ready.",
      { title: "Draft created" },
    );
    setShowForm(false);
    setPolicyReviewMeta(undefined);
    setPolicyFormInitialStep("configure");
    setPolicyForm(
      defaultPolicyForm(types.data?.[0]?.id ? String(types.data[0].id) : ""),
    );
  };
  const submitException = async (event: FormEvent) => {
    event.preventDefault();
    if (!exceptionForm.employee_ids.length) return;
    await createException.mutateAsync({
      employee_ids: exceptionForm.employee_ids,
      policy_id: Number(exceptionForm.policy_id),
      reason: exceptionForm.reason,
      valid_until: exceptionForm.valid_until,
    });
    setShowForm(false);
    setExceptionForm({
      employee_ids: [],
      policy_id: "",
      reason: "",
      valid_until: "",
    });
  };
  const runCheck = async () => {
    const runnable = (policies.data ?? []).filter(policyCanRun);
    if (!runnable.length) return;
    const target = runnable[0];
    const preflight = await api.complianceRunPreflight(target.id);
    if (!preflight.success || !preflight.data) {
      await showAlert(preflight.message || "This policy cannot be run right now.", {
        title: "Run check",
      });
      return;
    }
    const { applicable, exempt, to_evaluate } = preflight.data;
    const confirmed = await showConfirm(
      `Run check for "${target.name}"?\n\nApplicable: ${applicable}\nExempt: ${exempt}\nTo evaluate: ${to_evaluate}`,
      { title: "Run check", confirmLabel: "Run" },
    );
    if (!confirmed) return;
    setRunning(true);
    try {
      await evaluate.mutateAsync(target.id);
    } finally {
      setRunning(false);
    }
  };

  const runAiDraft = async () => {
    const title = aiName.trim();
    if (!title) {
      await showAlert("Enter a rule name.", { title: "Create with AI" });
      return;
    }
    setAiPending(true);
    try {
      const result = await api.proposePolicyFromAi({
        name: title,
        description: aiDescription,
        policy_type_id: aiPolicyTypeId ? Number(aiPolicyTypeId) : undefined,
        document_type_ids: aiDocumentTypeIds,
      });
      if (!result.success || !result.data) {
        await showAlert(result.message || "Unable to draft this rule.", {
          title: "Create with AI",
        });
        return;
      }
      setPolicyForm(
        proposalToForm(result.data, {
          ...defaultPolicyForm(
            types.data?.[0]?.id ? String(types.data[0].id) : "",
          ),
          document_type_ids: aiDocumentTypeIds,
        }),
      );
      setPolicyReviewMeta(reviewMetaFromProposal(result.data));
      setPolicyFormInitialStep("review");
      setAiName("");
      setAiDescription("");
      setAiDocumentTypeIds([]);
      setPolicyPath(null);
      setShowForm(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to draft this rule.";
      await showAlert(
        /timeout/i.test(message)
          ? "The AI draft took too long. Try again."
          : message,
        { title: "Create with AI" },
      );
    } finally {
      setAiPending(false);
    }
  };

  const appendAiBrief = (fragment: string) => {
    setAiDescription((current) => {
      const trimmed = current.trim();
      if (trimmed.includes(fragment.trim())) return current;
      return trimmed ? `${trimmed} ${fragment}` : fragment;
    });
  };

  return (
    <div
      className={
        embedded ? "relative space-y-6" : "relative app-page space-y-6"
      }
    >
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-pink hover:text-brand-pink"
          >
            <ListChecks className="h-4 w-4" />
            {running ? "Running..." : "Run Check"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPolicySubmitError("");
              if (tab === "exceptions") {
                setShowForm(true);
                return;
              }
              setPolicyPath("chooser");
              setShowForm(false);
            }}
            disabled={tab === "history" || tab === "reports"}
            className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {tab === "exceptions" ? "New Exception" : "New rule"}
          </button>
        </div>
      </div>
      <div className="app-page-metrics">
        <div className="app-page-metric">
          <span>Active rules</span>
          <strong>{policies.data?.length ?? 0}</strong>
        </div>
        <div className="app-page-metric">
          <span>Open exceptions</span>
          <strong>
            {exceptions.data?.filter((item) => item.active !== false && ["draft", "approved"].includes(item.status)).length ?? 0}
          </strong>
        </div>
        <div className="app-page-metric">
          <span>Rule runs</span>
          <strong>{runs.data?.length ?? 0}</strong>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionTabs
            items={[
              { id: "rules", label: "Rules" },
              { id: "exceptions", label: "Exceptions" },
              { id: "history", label: "Run History" },
              { id: "reports", label: "Reports" },
            ]}
            value={tab}
            onChange={(value) => {
              setTab(value);
              setSearch("");
              setSelectedPolicyIds([]);
              setSelectedExceptionIds([]);
            }}
            className="!w-auto min-w-0 flex-1"
            level="page"
            ariaLabel="Compliance sections"
          />
          <InputGroup className="sm:w-72">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${tab}...`}
            />
          </InputGroup>
        </div>
        {tab === "rules" && (
          <>
            <BulkActionBar
              count={selectedPolicyIds.length}
              onClear={() => setSelectedPolicyIds([])}
            >
              <button
                type="button"
                disabled={bulkRunning}
                onClick={async () => {
                  setBulkRunning(true);
                  try {
                    for (const id of selectedPolicyIds) {
                      await evaluate.mutateAsync(id);
                    }
                    setSelectedPolicyIds([]);
                  } finally {
                    setBulkRunning(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-text"
              >
                <ListChecks className="h-3.5 w-3.5" />
                {bulkRunning ? "Running..." : "Run check"}
              </button>
              <button
                type="button"
                disabled={deletePolicy.isPending}
                onClick={async () => {
                  if (
                    !(await showConfirm(
                      `Delete ${selectedPolicyIds.length} selected rule${selectedPolicyIds.length === 1 ? "" : "s"}? This cannot be undone.`,
                      { title: "Delete rules", confirmLabel: "Delete" },
                    ))
                  ) {
                    return;
                  }
                  for (const id of selectedPolicyIds) {
                    await deletePolicy.mutateAsync(id);
                  }
                  setSelectedPolicyIds([]);
                }}
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600"
              >
                {deletePolicy.isPending ? "Deleting..." : "Delete"}
              </button>
            </BulkActionBar>
            <PolicyTable
              policies={displayedPolicies}
              documents={documents.data ?? []}
              types={types.data ?? []}
              targets={targets.data}
              selectedIds={selectedPolicyIds}
              reviewPolicyId={reviewPolicyId}
              onReviewClose={() => setReviewPolicyId(null)}
              onToggleSelected={(id) =>
                setSelectedPolicyIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                )
              }
              onToggleAll={() => {
                const ids = displayedPolicies.map((item) => item.id);
                const allSelected =
                  ids.length > 0 && ids.every((id) => selectedPolicyIds.includes(id));
                setSelectedPolicyIds(allSelected ? [] : ids);
              }}
              allSelected={
                displayedPolicies.length > 0 &&
                displayedPolicies.every((item) => selectedPolicyIds.includes(item.id))
              }
            />
          </>
        )}
        {tab === "exceptions" && (
          <>
            <BulkActionBar
              count={selectedExceptionIds.length}
              onClear={() => setSelectedExceptionIds([])}
            >
              <button
                type="button"
                disabled={approveException.isPending}
                onClick={async () => {
                  const draftIds = displayedExceptions
                    .filter(
                      (item) =>
                        selectedExceptionIds.includes(item.id) &&
                        item.status === "draft",
                    )
                    .map((item) => item.id);
                  for (const id of draftIds) {
                    await approveException.mutateAsync(id);
                  }
                  setSelectedExceptionIds([]);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                type="button"
                disabled={rejectException.isPending}
                onClick={async () => {
                  const draftIds = displayedExceptions
                    .filter(
                      (item) =>
                        selectedExceptionIds.includes(item.id) &&
                        item.status === "draft",
                    )
                    .map((item) => item.id);
                  for (const id of draftIds) {
                    await rejectException.mutateAsync(id);
                  }
                  setSelectedExceptionIds([]);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600"
              >
                <Ban className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                type="button"
                disabled={deactivateException.isPending}
                onClick={async () => {
                  const activeIds = displayedExceptions
                    .filter(
                      (item) =>
                        selectedExceptionIds.includes(item.id) &&
                        item.active !== false,
                    )
                    .map((item) => item.id);
                  for (const id of activeIds) {
                    await deactivateException.mutateAsync(id);
                  }
                  setSelectedExceptionIds([]);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700"
              >
                <ToggleLeft className="h-3.5 w-3.5" />
                Deactivate
              </button>
              <button
                type="button"
                disabled={deleteException.isPending}
                onClick={async () => {
                  if (
                    !(await showConfirm(
                      `Delete ${selectedExceptionIds.length} selected exception${selectedExceptionIds.length === 1 ? "" : "s"}?`,
                      { title: "Delete exceptions", confirmLabel: "Delete" },
                    ))
                  ) {
                    return;
                  }
                  for (const id of selectedExceptionIds) {
                    await deleteException.mutateAsync(id);
                  }
                  setSelectedExceptionIds([]);
                }}
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600"
              >
                {deleteException.isPending ? "Deleting..." : "Delete"}
              </button>
            </BulkActionBar>
            <ExceptionTable
              exceptions={displayedExceptions}
              selectedIds={selectedExceptionIds}
              onToggleSelected={(id) =>
                setSelectedExceptionIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                )
              }
              onToggleAll={() => {
                const ids = displayedExceptions.map((item) => item.id);
                const allSelected =
                  ids.length > 0 && ids.every((id) => selectedExceptionIds.includes(id));
                setSelectedExceptionIds(allSelected ? [] : ids);
              }}
              allSelected={
                displayedExceptions.length > 0 &&
                displayedExceptions.every((item) => selectedExceptionIds.includes(item.id))
              }
            />
          </>
        )}
        {tab === "history" && (
            <HistoryTable
              runs={runs.data ?? []}
              onOpenRun={(runId) => router.push(`/pages/compliance/run?run=${runId}`)}
            />
        )}
        {tab === "reports" && <ComplianceReportsPanel />}
      </section>
      {showForm &&
        (tab === "exceptions" ? (
          <ExceptionForm
            form={exceptionForm}
            setForm={setExceptionForm}
            employees={targets.data?.employees ?? []}
            policies={policies.data ?? []}
            pending={createException.isPending}
            onClose={() => setShowForm(false)}
            onSubmit={submitException}
          />
        ) : (
          <PolicyForm
            form={policyForm}
            setForm={setPolicyForm}
            types={types.data ?? []}
            documents={documents.data ?? []}
            targets={targets.data}
            pending={createPolicy.isPending}
            submitError={policySubmitError}
            initialStep={policyFormInitialStep}
            reviewMeta={policyReviewMeta}
            onClose={() => {
              setPolicySubmitError("");
              setPolicyReviewMeta(undefined);
              setPolicyFormInitialStep("configure");
              setShowForm(false);
            }}
            onSubmit={submitPolicy}
          />
        ))}
      {tab !== "exceptions" && policyPath === "chooser" ? (
        <ModalDialog
          title="New rule"
          eyebrow="Choose how to start"
          onClose={() => setPolicyPath(null)}
          size="md"
        >
          <div className="grid gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-pink"
              onClick={() => {
                setPolicySubmitError("");
                setPolicyReviewMeta(undefined);
                setPolicyFormInitialStep("configure");
                setPolicyForm(
                  defaultPolicyForm(
                    types.data?.[0]?.id ? String(types.data[0].id) : "",
                  ),
                );
                setPolicyPath(null);
                setShowForm(true);
              }}
            >
              <strong>Rule wizard</strong>
              <p className="text-sm text-muted-foreground">
                Step through type, scope, documents, and schedule, then review.
              </p>
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-pink"
              onClick={() => setPolicyPath("ai")}
            >
              <strong>Create with AI</strong>
              <p className="text-sm text-muted-foreground">
                Describe what you need; AI proposes fields for your review.
              </p>
            </button>
          </div>
        </ModalDialog>
      ) : null}
      {policyPath === "ai" ? (
        <ModalDialog
          title="Create with AI"
          eyebrow="New rule"
          onClose={() => {
            if (!aiPending) setPolicyPath("chooser");
          }}
          size="md"
        >
          {aiPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
              <p className="text-sm font-semibold text-slate-700">Drafting rule…</p>
              <p className="text-xs text-muted-foreground">
                This can take a little while. Keep this window open.
              </p>
            </div>
          ) : (
            <>
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                AI writes a short description and saves this as a <strong>Draft</strong>.
                Activate it when it looks right.
              </p>
              <label className="mt-4 block space-y-1 text-sm">
                <span className="font-semibold">Rule name</span>
                <input
                  className="field"
                  value={aiName}
                  onChange={(event) => setAiName(event.target.value)}
                  placeholder="Remote work, Code of conduct…"
                />
              </label>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="font-semibold">What should it cover?</span>
                <textarea
                  className="field min-h-24"
                  value={aiDescription}
                  onChange={(event) => setAiDescription(event.target.value)}
                  placeholder="Optional: who it applies to, what is required, when it starts"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AI_BRIEF_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-pink hover:text-brand-pink"
                    onClick={() => appendAiBrief(chip.text)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">Rule type</span>
                  <ThemedSelect
                    value={aiPolicyTypeId}
                    onChange={setAiPolicyTypeId}
                    placeholder="Select type"
                    options={(types.data ?? []).map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                  />
                </label>
                <div className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-semibold">Required documents</span>
                  <ComplianceDocumentTypeMultiSelect
                    types={aiSelectableDocumentTypes}
                    selected={aiDocumentTypeIds}
                    onChange={setAiDocumentTypeIds}
                    placeholder="Select document types"
                    expiryTypesOnly={aiPolicyTypeCode === "renewable_document"}
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPolicyPath("chooser")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!aiName.trim()}
                  onClick={() => void runAiDraft()}
                >
                  Generate draft
                </button>
              </div>
            </>
          )}
        </ModalDialog>
      ) : null}
    </div>
  );
}

function PolicyTable({
  policies,
  documents,
  types,
  targets,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  allSelected,
  reviewPolicyId,
  onReviewClose,
}: {
  policies: any[];
  documents: any[];
  types: any[];
  targets: any;
  selectedIds: number[];
  onToggleSelected: (id: number) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  reviewPolicyId?: number | null;
  onReviewClose?: () => void;
}) {
  const paging = useClientPagination(policies, policies.length);
  return (
    <>
    <Table
      headers={[
        "Rule name",
        "Rule type",
        "Details",
        "Applies to",
        "Schedule",
        "Next run",
        "Status",
        "Actions",
      ]}
      empty="No rules found."
      selectAllChecked={allSelected}
      onToggleAll={onToggleAll}
      hasSelection
    >
      <>
        {paging.items.map((policy) => (
          <tr
            key={policy.id}
            className={`hover:bg-pink-50/30 ${reviewPolicyId === policy.id ? "bg-pink-50/70" : ""}`}
          >
            <td className="cell w-10">
              <input
                type="checkbox"
                checked={selectedIds.includes(policy.id)}
                onChange={() => onToggleSelected(policy.id)}
                className="h-4 w-4 accent-pink-600"
                aria-label={`Select ${policy.name}`}
              />
            </td>
            <td className="cell max-w-[18rem]">
              <b className="truncate">{policy.name}</b>
              <small title={policy.description || undefined}>
                {policy.description || "No description provided"}
              </small>
            </td>
            <td className="cell">
              <span className="tag">{policy.policy_type}</span>
            </td>
            <td className="cell">
              {policy.minimum_documents} document
              {policy.minimum_documents === 1 ? "" : "s"}
            </td>
            <td className="cell">
              {formatFieldLabel(policy.applies_to)}
            </td>
            <td className="cell">
              {formatFieldLabel(policy.schedule)}
            </td>
            <td className="cell">
              <small>{policy.schedule === "manual" ? "Manual only" : policy.next_run_at ? formatDateTime(policy.next_run_at) : "Not scheduled"}</small>
              {policy.last_run_at && <small className="mt-1">Last: {formatDateTime(policy.last_run_at)}</small>}
            </td>
            <td className="cell">
              <span className={`status ${policyStatusClass(policy)}`}>
                {policyStatusLabel(policy)}
              </span>
            </td>
            <td className="cell table-actions-cell">
              <ComplianceRuleActions
                policy={policy}
                documents={documents}
                types={types}
                targets={targets}
                openView={reviewPolicyId === policy.id}
                onViewClose={onReviewClose}
              />
            </td>
          </tr>
        ))}
      </>
    </Table>
    <ListPagination
      page={paging.page}
      pageSize={paging.pageSize}
      total={paging.total}
      onPageChange={paging.setPage}
    />
    </>
  );
}
function ExceptionTable({
  exceptions,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  allSelected,
}: {
  exceptions: any[];
  selectedIds: number[];
  onToggleSelected: (id: number) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}) {
  const paging = useClientPagination(exceptions, exceptions.length);
  return (
    <>
    <Table
      headers={["Employee", "Reason", "Valid until", "Status", "Actions"]}
      empty="No exceptions found."
      selectAllChecked={allSelected}
      onToggleAll={onToggleAll}
      hasSelection
    >
      <>
        {paging.items.map((item) => (
          <tr key={item.id} className="hover:bg-pink-50/30">
            <td className="cell w-10">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggleSelected(item.id)}
                className="h-4 w-4 accent-pink-600"
                aria-label={`Select exception for ${item.employee}`}
              />
            </td>
            <td className="cell">
              <b>{item.employee}</b>
              <small>{item.policy}</small>
            </td>
            <td className="cell">{item.reason}</td>
            <td className="cell">{item.valid_until}</td>
            <td className="cell">
              <span className={`status ${item.status === "approved" ? "approved" : item.status === "rejected" || item.status === "expired" ? "danger" : "pending"}`}>{formatStatusLabel(item.status)}</span>
            </td>
            <td className="cell table-actions-cell">
              <ExceptionActions exception={item} />
            </td>
          </tr>
        ))}
      </>
    </Table>
    <ListPagination
      page={paging.page}
      pageSize={paging.pageSize}
      total={paging.total}
      onPageChange={paging.setPage}
    />
    </>
  );
}

function ExceptionActions({ exception }: { exception: any }) {
  const approve = useApproveException();
  const reject = useRejectException();
  const deactivate = useDeactivateException();
  const reactivate = useReactivateException();
  const remove = useDeleteException();
  const { showConfirm } = useAppDialog();
  const active = exception.active !== false;
  const toggle = async () => {
    if (active) await deactivate.mutateAsync(exception.id);
    else await reactivate.mutateAsync(exception.id);
  };
  const deleteException = async () => {
    if (
      await showConfirm("Delete this exception? This cannot be undone.", {
        title: "Delete exception",
        confirmLabel: "Delete",
      })
    )
      await remove.mutateAsync(exception.id);
  };
  return (
    <div className="table-actions-group flex-wrap">
    {exception.status === "draft" && <><button type="button" onClick={() => approve.mutateAsync(exception.id)} disabled={approve.isPending} className="row-action text-emerald-600" title="Approve exception" aria-label="Approve exception"><ShieldCheck /></button><button type="button" onClick={() => reject.mutateAsync(exception.id)} disabled={reject.isPending} className="row-action danger" title="Reject exception" aria-label="Reject exception"><Ban /></button></>}
    <button type="button" onClick={toggle} disabled={deactivate.isPending || reactivate.isPending} className="row-action" title={active ? "Deactivate exception" : "Reactivate exception"} aria-label={active ? "Deactivate exception" : "Reactivate exception"}>{active ? <ToggleLeft /> : <RotateCcw />}</button>
    <button type="button" onClick={deleteException} disabled={remove.isPending} className="row-action danger" title="Delete exception"><Trash2 /></button>
  </div>
  );
}
function HistoryTable({
  runs,
  onOpenRun,
}: {
  runs: any[];
  onOpenRun: (runId: number) => void;
}) {
  const paging = useClientPagination(runs, runs.length);
  return (
    <>
    <Table
      headers={["Rule", "Run type", "Employees", "Results", "Evaluated at"]}
      empty="No run history yet."
    >
      <>
        {paging.items.map((item) => (
          <tr
            key={item.id}
            className="cursor-pointer hover:bg-pink-50/30"
            onClick={() => onOpenRun(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenRun(item.id);
              }
            }}
            tabIndex={0}
            aria-label={`Open run for ${item.policy}`}
          >
            <td className="cell">
              <b>{item.policy}</b>
            </td>
            <td className="cell">{formatFieldLabel(item.run_type)}</td>
            <td className="cell">{item.employee_count}</td>
            <td className="cell"><small>{item.compliant_count} compliant · {item.partial_count} partial · {item.non_compliant_count} missing · {item.excepted_count} excepted</small></td>
            <td className="cell">{item.evaluated_at ? formatDateTime(item.evaluated_at) : "—"}</td>
          </tr>
        ))}
      </>
    </Table>
    <ListPagination
      page={paging.page}
      pageSize={paging.pageSize}
      total={paging.total}
      onPageChange={paging.setPage}
    />
    </>
  );
}

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")));
}

function policyCanRun(policy: { active?: boolean; lifecycle_status?: string }) {
  return Boolean(policy.active) && policy.lifecycle_status !== "archived";
}

function policyStatusLabel(policy: { active?: boolean; lifecycle_status?: string }) {
  if (policy.active) return "Active";
  if (policy.lifecycle_status === "draft") return "Draft";
  if (policy.lifecycle_status === "archived") return "Archived";
  return "Inactive";
}

function policyStatusClass(policy: { active?: boolean; lifecycle_status?: string }) {
  if (policy.active) return "";
  if (policy.lifecycle_status === "draft") return "draft";
  if (policy.lifecycle_status === "archived" || !policy.active) return "pending";
  return "";
}
function Table({
  children,
  headers,
  empty,
  hasSelection = false,
  selectAllChecked = false,
  onToggleAll,
}: {
  children: React.ReactNode;
  headers: string[];
  empty: string;
  hasSelection?: boolean;
  selectAllChecked?: boolean;
  onToggleAll?: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <SortableTable className="w-full min-w-[760px] text-left">
        <thead>
          <tr>
            {hasSelection ? (
              <th className="w-10 px-5 py-4">
                <input
                  type="checkbox"
                  checked={selectAllChecked}
                  onChange={onToggleAll}
                  className="h-4 w-4 accent-pink-600"
                  aria-label="Select all rows"
                />
              </th>
            ) : null}
            {headers.map((header) => (
              <th
                key={header}
                className={
                  header === "Actions"
                    ? "table-actions-header px-5 py-4"
                    : "px-5 py-4"
                }
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </SortableTable>
    </div>
  );
}
export function ScopeChecklist({
  appliesTo,
  items,
  selected,
  onToggle,
}: {
  appliesTo: string;
  items: any[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  if (appliesTo === "all") return null;

  const labelText =
    appliesTo === "department"
      ? "Departments"
      : appliesTo === "grade"
        ? "Groups"
        : "Employees";

  const filtered = (items || []).filter((item: any) => {
    const q = query.toLowerCase();
    const nameMatch = (item.name || "").toLowerCase().includes(q);
    const deptMatch = (item.department || "").toLowerCase().includes(q);
    const titleMatch = (item.job_title || "").toLowerCase().includes(q);
    const emailMatch = (item.work_email || "").toLowerCase().includes(q);
    return nameMatch || deptMatch || titleMatch || emailMatch;
  });

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="label mb-0 text-slate-700">
          Select {labelText}
          {selected.length > 0 ? ` (${selected.length})` : ""}
        </span>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${labelText.toLowerCase()}...`}
            className="field pl-8"
          />
        </div>
      </div>

      <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="sm:col-span-2 text-center text-xs text-slate-400 py-2">
            No matching {labelText.toLowerCase()} found.
          </p>
        ) : (
          filtered.map((item: any) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-pink-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 accent-pink-600 rounded"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-slate-800">{item.name}</span>
                {item.department && appliesTo === "employee" && (
                  <span className="block truncate text-xs text-slate-400">
                    {item.department} {item.job_title ? `· ${item.job_title}` : ""}
                  </span>
                )}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function AlertCadenceSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (newValue: string) => void;
}) {
  const PRESETS = [
    { label: "90 days before", days: 90 },
    { label: "60 days before", days: 60 },
    { label: "30 days before", days: 30 },
    { label: "15 days before", days: 15 },
    { label: "7 days before", days: 7 },
    { label: "1 day before", days: 1 },
    { label: "On expiry day", days: 0 },
  ];

  const currentDays = (value || "60,30,15,7,0")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  const toggleDay = (day: number) => {
    let next: number[];
    if (currentDays.includes(day)) {
      next = currentDays.filter((d) => d !== day);
    } else {
      next = [...currentDays, day].sort((a, b) => b - a);
    }
    onChange(next.join(","));
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="label">Reminders</span>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const isSelected = currentDays.includes(preset.days);
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => toggleDay(preset.days)}
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? "bg-brand-pink text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-pink-300 hover:text-brand-pink"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TypeSpecificFields({
  typeCode,
  form,
  setForm,
  targets,
}: {
  typeCode: string;
  form: any;
  setForm: any;
  targets: any;
}) {
  if (typeCode === "document_requirement") {
    return (
      <>
        <Field label="Extra days to submit">
          <input
            type="number"
            min="0"
            className="field"
            value={form.grace_period_days}
            onChange={(e) =>
              setForm({ ...form, grace_period_days: e.target.value })
            }
          />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.allow_waiver}
              onChange={(e) =>
                setForm({ ...form, allow_waiver: e.target.checked })
              }
              className="h-4 w-4 accent-pink-600 rounded"
            />
            Allow exceptions
          </label>
        </div>
      </>
    );
  }

  if (typeCode === "renewable_document") {
    return (
      <>
        <AlertCadenceSelector
          value={form.alert_schedule_days}
          onChange={(val) => setForm({ ...form, alert_schedule_days: val })}
        />
        <Field label="Also notify HR">
          <ThemedSelect
            value={String(form.escalate_hr_days)}
            onChange={(val) =>
              setForm({ ...form, escalate_hr_days: Number(val) })
            }
            options={[
              { value: "15", label: "15 days before expiry" },
              { value: "7", label: "7 days before expiry" },
              { value: "3", label: "3 days before expiry" },
              { value: "1", label: "1 day before expiry" },
              { value: "0", label: "On expiry day" },
            ]}
          />
        </Field>
        <Field label="Extra days after expiry">
          <input
            type="number"
            min="0"
            className="field"
            value={form.grace_period_days}
            onChange={(e) =>
              setForm({ ...form, grace_period_days: e.target.value })
            }
          />
        </Field>
        <div className="flex items-end pb-1 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.auto_request_renewal}
              onChange={(e) =>
                setForm({ ...form, auto_request_renewal: e.target.checked })
              }
              className="h-4 w-4 accent-pink-600 rounded"
            />
            Create a renewal task for the employee
          </label>
        </div>
      </>
    );
  }

  if (typeCode === "retention") {
    return <ComplianceRetentionFields form={form} setForm={setForm} />;
  }

  return null;
}

export function PolicyForm({
  form,
  setForm,
  types,
  documents,
  targets,
  pending,
  submitError,
  onClose,
  onSubmit,
  onImportComplete,
  organizationalMode,
  initialStep = "configure",
  reviewMeta,
  importDocumentId,
}: any) {
  const [step, setStep] = useState<"configure" | "review">(initialStep);
  const [formError, setFormError] = useState("");
  const [importPending, setImportPending] = useState(false);
  const [formTemplates, setFormTemplates] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    setForm((prev: PolicyCreateFormState) => {
      const event_trigger = coercePolicyEventTrigger(prev.event_trigger);
      const audit_frequency = coercePolicyAuditFrequency(prev.audit_frequency);
      const applies_to = coercePolicyAppliesTo(prev.applies_to);
      const schedule = coercePolicySchedule(prev.schedule || "manual");
      const effective_date = coerceEffectiveDate(prev.effective_date);
      if (
        event_trigger === prev.event_trigger &&
        audit_frequency === prev.audit_frequency &&
        applies_to === prev.applies_to &&
        schedule === prev.schedule &&
        effective_date === prev.effective_date
      ) {
        return prev;
      }
      return {
        ...prev,
        event_trigger,
        audit_frequency,
        applies_to,
        schedule,
        effective_date,
      };
    });
  }, [importDocumentId, initialStep, setForm]);

  const selectedType = (types || []).find(
    (t: any) => String(t.id) === String(form.policy_type_id)
  );
  const typeCode = selectedType?.code || "";
  const allDocumentTypes = documents as DocumentType[];
  const selectableDocumentTypes = useMemo(
    () => documentTypesForCompliancePolicy(typeCode, allDocumentTypes),
    [typeCode, allDocumentTypes],
  );

  useEffect(() => {
    if (typeCode !== "compliance_request") return;
    void api.listActiveTemplatesForms({ kind: "form" }).then((result) => {
      const templates = result.data?.templates ?? [];
      setFormTemplates(
        templates.map((item) => ({
          id: Number(item.id),
          name: String(item.name || "Form"),
        })),
      );
    });
  }, [typeCode]);

  const submit = (event: FormEvent) => {
    if (!form.policy_type_id) {
      event.preventDefault();
      setFormError(
        organizationalMode ? "Please select a policy type." : "Please select a rule type.",
      );
      return;
    }
    const validation = validatePolicyCreateForm(
      form,
      typeCode,
      reviewMeta,
      organizationalMode ? "policy" : "rule",
    );
    if (!validation.canConfirm && step === "review") {
      event.preventDefault();
      setFormError(validation.missingFields[0] || "Complete required fields.");
      return;
    }
    if (step === "configure") {
      const configureValidation = validatePolicyCreateForm(
        form,
        typeCode,
        reviewMeta,
        organizationalMode ? "policy" : "rule",
      );
      if (!configureValidation.canConfirm) {
        event.preventDefault();
        setFormError(
          configureValidation.missingFields[0] || "Complete required fields.",
        );
        return;
      }
    } else if (typeCode !== "compliance_request" && !form.document_type_ids.length) {
      event.preventDefault();
      setFormError("Select at least one required document type.");
      return;
    }
    setFormError("");
    if (step === "configure") {
      event.preventDefault();
      setStep("review");
      return;
    }
    onSubmit(event);
  };

  const selectedDocumentTypes = documents.filter((item: any) =>
    form.document_type_ids.includes(item.id),
  );
  const scopeLabels = formatPolicyScopeSummary(form.scope, targets);
  const retentionPreview = useRetentionPreview(
    form,
    step === "review" && typeCode === "retention",
  );

  return (
    <ModalDialog
      title={
        step === "configure"
          ? organizationalMode
            ? "Create policy"
            : "Rule wizard"
          : organizationalMode
            ? "Review policy"
            : "Review rule"
      }
      eyebrow={organizationalMode ? "New policy" : "New rule"}
      onClose={onClose}
      size="xl"
      zIndex={organizationalMode ? 110 : 50}
    >
      {step === "configure" ? (
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={organizationalMode ? "Policy name" : "Rule name"}>
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={organizationalMode ? "Policy type" : "Rule type"}>
          <ThemedSelect
            value={form.policy_type_id}
            onChange={(value) => {
              const nextTypeCode =
                (types || []).find((t: any) => String(t.id) === value)?.code ??
                "";
              setForm({
                ...form,
                policy_type_id: value,
                document_type_ids: pruneDocumentTypeIdsForPolicy(
                  nextTypeCode,
                  form.document_type_ids,
                  allDocumentTypes,
                ),
              });
            }}
            placeholder="Select type"
            options={types.map((item: any) => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
        </Field>
        <Field label="Description" full>
          <textarea
            rows={2}
            className="field min-h-[4.5rem]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Applies to" full>
          <PolicyAudienceFilters
            scope={form.scope}
            targets={targets}
            allEmployees={form.applies_to === "all"}
            onAllEmployeesChange={(all) =>
              setForm({
                ...form,
                applies_to: all ? "all" : "filtered",
                scope: all ? emptyPolicyScope() : form.scope,
              })
            }
            onChange={(scope) =>
              setForm({
                ...form,
                applies_to: "filtered",
                scope,
              })
            }
          />
        </Field>

        <TypeSpecificFields
          typeCode={typeCode}
          form={form}
          setForm={setForm}
          targets={targets}
        />

        {typeCode === "compliance_request" ? (
          <>
            <ComplianceRequestTaskList
              tasks={form.request_tasks}
              onChange={(request_tasks) => setForm({ ...form, request_tasks })}
              documentTypes={allDocumentTypes}
              linkableContext={{
                applies_to: form.applies_to,
                scope: form.scope,
              }}
              forms={formTemplates}
            />
            <ComplianceRequestScheduleFields
              schedule={{
                request_trigger: form.request_trigger,
                request_start_date: form.request_start_date,
                repeat_every_months: form.repeat_every_months,
                tasks_needed_mode: form.tasks_needed_mode as
                  | "all_required"
                  | "any_required"
                  | "minimum_count",
                tasks_needed_minimum: form.tasks_needed_minimum,
                reopen_on_content_change: form.reopen_on_content_change,
              }}
              onChange={(schedule) => setForm({ ...form, ...schedule })}
              dueDays={form.due_days}
              gracePeriodDays={form.grace_period_days}
              reminderDays={form.reminder_frequency_days}
              onDueDaysChange={(due_days) => setForm({ ...form, due_days })}
              onGraceChange={(grace_period_days) =>
                setForm({ ...form, grace_period_days })
              }
              onReminderChange={(reminder_frequency_days) =>
                setForm({ ...form, reminder_frequency_days })
              }
            />
            <Field label="Who follows up?" full>
              <ThemedSelect
                value={String(form.assigned_reviewer_id || "")}
                onChange={(val) =>
                  setForm({ ...form, assigned_reviewer_id: val })
                }
                placeholder="Select HR contact"
                options={(targets?.users || []).map((u: any) => ({
                  value: String(u.id),
                  label: u.name,
                }))}
              />
            </Field>
          </>
        ) : (
          <div className="sm:col-span-2">
            <span className="label">Required documents</span>
            <ComplianceDocumentTypeMultiSelect
              types={selectableDocumentTypes}
              selected={form.document_type_ids}
              onChange={(document_type_ids) =>
                setForm({ ...form, document_type_ids })
              }
              expiryTypesOnly={typeCode === "renewable_document"}
              error={
                formError === "Select at least one required document type."
                  ? formError
                  : undefined
              }
            />
          </div>
        )}
        <Field label="Schedule">
          <ThemedSelect
            value={form.schedule}
            onChange={(value) =>
              setForm({ ...form, schedule: value === "manual" ? "" : value })
            }
            options={schedules.map((item) => ({
              value: item,
              label: item === "manual" ? "Manual Only" : formatFieldLabel(item),
            }))}
          />
        </Field>
        <Field label="Effective date">
          <input
            required
            type="date"
            className="field"
            value={form.effective_date}
            onChange={(e) =>
              setForm({ ...form, effective_date: e.target.value })
            }
          />
        </Field>
        {typeCode !== "compliance_request" && typeCode !== "retention" ? (
          <Field label="Copies needed">
            <input
              required
              min="1"
              type="number"
              className="field"
              value={form.minimum_documents}
              onChange={(e) =>
                setForm({ ...form, minimum_documents: e.target.value })
              }
            />
          </Field>
        ) : null}
        {typeCode !== "document_requirement" &&
        typeCode !== "renewable_document" &&
        typeCode !== "compliance_request" &&
        typeCode !== "retention" ? (
          <Field label="Grace period (days)">
            <input
              required
              min="0"
              type="number"
              className="field"
              value={form.grace_period_days}
              onChange={(e) =>
                setForm({ ...form, grace_period_days: e.target.value })
              }
            />
          </Field>
        ) : null}
        {(formError || submitError) && (
          <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {formError || submitError}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-3 sm:col-span-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            className="app-btn app-btn-primary"
          >
            Review
          </button>
        </div>
      </form>
      ) : (
        <ComplianceRuleReviewScreen
          form={form}
          typeName={selectedType?.name || ""}
          typeCode={typeCode}
          documentTypeNames={selectedDocumentTypes.map((item: any) => item.name)}
          scopeLabels={scopeLabels}
          retentionPreview={retentionPreview}
          reviewMeta={reviewMeta}
          submitError={submitError || formError}
          pending={pending || importPending}
          entityName={organizationalMode ? "policy" : "rule"}
          confirmLabel={importDocumentId ? "Confirm import" : "Confirm"}
          onBack={() => setStep("configure")}
          onConfirm={() =>
            void (async () => {
              if (importDocumentId) {
                setImportPending(true);
                try {
                  const result = await api.confirmPolicyImport(
                    importDocumentId,
                    buildCreatePolicyPayload(form),
                  );
                  if (!result.success) {
                    throw new Error(result.message || "Import failed.");
                  }
                  onImportComplete?.();
                  onClose();
                } catch (error: unknown) {
                  setFormError(
                    error instanceof Error ? error.message : "Import failed.",
                  );
                } finally {
                  setImportPending(false);
                }
                return;
              }
              submit({ preventDefault: () => undefined } as FormEvent);
            })()
          }
        />
      )}
    </ModalDialog>
  );
}
function ExceptionForm({
  form,
  setForm,
  employees,
  policies,
  pending,
  onClose,
  onSubmit,
}: any) {
  return (
    <ModalDialog
      title="Create exception"
      eyebrow="Compliance engine"
      onClose={onClose}
      size="3xl"
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <EmployeeChecklist employees={employees} form={form} setForm={setForm} />
        <Field label="Rule">
          <ThemedSelect value={form.policy_id} onChange={(value) => setForm({ ...form, policy_id: value })} placeholder="Select rule" options={policies.map((item: any) => ({ value: String(item.id), label: item.name }))} />
        </Field>
        <Field label="Reason">
          <textarea
            required
            className="field min-h-24"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </Field>
        <Field label="Valid until">
          <input
            required
            type="date"
            className="field"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
          />
        </Field>
        <Actions pending={pending} onClose={onClose} />
      </form>
    </ModalDialog>
  );
}
function EmployeeChecklist({ employees, form, setForm }: any) {
  return (
    <Field label="Employees">
      <EmployeeMetricPicker
        employees={(employees ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
          department_name: item.department || item.department_name,
          job_title: item.job_title,
          work_location: item.work_location || item.location,
          employment_type: item.employment_type,
          status: item.status || item.lifecycle_status,
          branch: item.branch,
          grade: item.grade,
        }))}
        selectedIds={form.employee_ids}
        onChange={(ids) => setForm({ ...form, employee_ids: ids })}
      />
      {!form.employee_ids.length && (
        <p className="mt-1 text-xs text-red-500">Select at least one employee.</p>
      )}
    </Field>
  );
}
function Field({ label, full, children }: any) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
function Actions({ pending, onClose }: any) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
      >
        Cancel
      </button>
      <button
        disabled={pending}
              className="app-btn app-btn-primary"
      >
        {pending ? "Saving..." : "Create"}
      </button>
    </div>
  );
}
