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
import { FormEvent, useEffect, useState } from "react";
import { formatFieldLabel, formatStatusLabel } from "../../../lib/formatLabel";
import { policyDocumentFileName } from "../../../lib/policyDocumentName";
import { useClientPagination } from "../../../lib/useClientPagination";
import ListPagination from "./ListPagination";
import {
  useComplianceTargets,
  useCreateException,
  useApproveException,
  useDeactivateException,
  useDeleteException,
  useCreatePolicy,
  useCreateDocument,
  useDeletePolicy,
  useDocumentTypes,
  useEvaluatePolicy,
  useEvaluationRuns,
  useExceptions,
  useReactivateException,
  useRejectException,
  usePolicies,
  usePolicyTypes,
  useDocuments,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";
import BulkActionBar from "./BulkActionBar";
import PolicyActions from "./PolicyActions";
import ModalDialog from "./ModalDialog";
import PolicyTypeMultiSelect from "./PolicyTypeMultiSelect";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";
import {
  AUDIT_FREQUENCY_LABELS,
  EVENT_TRIGGER_LABELS,
} from "../../../lib/complianceCopy";
import ComplianceReportsPanel from "./ComplianceReportsPanel";
import EmployeeMetricPicker from "./EmployeeMetricPicker";
import SectionTabs from "./SectionTabs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type Tab = "policies" | "exceptions" | "history" | "reports";
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

export default function CompliancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showConfirm, showAlert } = useAppDialog();
  const [tab, setTab] = useState<Tab>("policies");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [policyPath, setPolicyPath] = useState<"chooser" | "scratch" | "import" | "ai" | null>(null);
  const [importDocumentId, setImportDocumentId] = useState("");
  const [aiName, setAiName] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiPolicyTypeId, setAiPolicyTypeId] = useState("");
  const [aiDocumentTypeIds, setAiDocumentTypeIds] = useState<number[]>([]);
  const [aiPending, setAiPending] = useState(false);
  const [reviewPolicyId, setReviewPolicyId] = useState<number | null>(null);
  const [policySubmitError, setPolicySubmitError] = useState("");
  const [running, setRunning] = useState(false);
  const policies = usePolicies();
  const exceptions = useExceptions();
  const runs = useEvaluationRuns();
  const types = usePolicyTypes();
  const documents = useDocumentTypes();
  const orgDocuments = useDocuments(undefined, false, policyPath === "import");
  const targets = useComplianceTargets();
  const createPolicy = useCreatePolicy();
  const createDocument = useCreateDocument();
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
  const [policyForm, setPolicyForm] = useState({
    name: "",
    description: "",
    policy_type_id: "",
    document_type_ids: [] as number[],
    applies_to: "all",
    scope_ids: [] as number[],
    schedule: "monthly",
    custom_schedule_days: "30",
    minimum_documents: "1",
    grace_period_days: "0",
    effective_date: new Date().toISOString().slice(0, 10),
    // Type-specific fields
    allow_waiver: true,
    alert_schedule_days: "60,30,15,7,0",
    escalate_manager_days: 0,
    escalate_hr_days: 7,
    auto_request_renewal: true,
    event_trigger: "onboarding",
    due_days: 14,
    reminder_frequency_days: 3,
    assigned_reviewer_id: "",
    audit_frequency: "quarterly",
    sample_pct: 100,
    assigned_auditor_id: "",
    policy_category: "",
    lifecycle_status: "active",
    active: true,
    policy_visibility: "employees",
    policy_audience: "everyone",
  });

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

  useEffect(() => {
    if (aiDocumentTypeIds.length || !documents.data?.length) return;
    setAiDocumentTypeIds([documents.data[0].id]);
  }, [documents.data, aiDocumentTypeIds.length]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setTab("policies");
      const path = searchParams.get("path");
      if (path === "import" || path === "ai" || path === "scratch") {
        setPolicyPath(path);
        setShowForm(path === "scratch");
      } else {
        setPolicyPath("chooser");
        setShowForm(false);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const policyId = Number(searchParams.get("policy") || 0);
    if (policyId > 0) {
      setTab("policies");
      setReviewPolicyId(policyId);
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
    const effectiveAppliesTo =
      policyForm.applies_to === "all" || policyForm.scope_ids.length === 0
        ? "all"
        : policyForm.applies_to;

    try {
      const created = await createPolicy.mutateAsync({
        ...policyForm,
        policy_type_id: Number(policyForm.policy_type_id),
        applies_to: effectiveAppliesTo,
        document_type_ids: policyForm.document_type_ids,
        employee_ids:
          effectiveAppliesTo === "employee" ? policyForm.scope_ids : [],
        department_ids:
          effectiveAppliesTo === "department" ? policyForm.scope_ids : [],
        grade_ids: effectiveAppliesTo === "grade" ? policyForm.scope_ids : [],
        custom_schedule_days: Number(policyForm.custom_schedule_days),
        minimum_documents: Number(policyForm.minimum_documents),
        grace_period_days: Number(policyForm.grace_period_days),
        assigned_reviewer_id: policyForm.assigned_reviewer_id
          ? Number(policyForm.assigned_reviewer_id)
          : false,
        assigned_auditor_id: policyForm.assigned_auditor_id
          ? Number(policyForm.assigned_auditor_id)
          : false,
        escalate_manager_days: 0,
        lifecycle_status: "active",
        active: policyForm.active !== false,
        policy_category: policyForm.policy_category || "",
        policy_visibility: policyForm.policy_visibility || "employees",
        policy_audience: policyForm.policy_audience || "everyone",
        ai_drafted: false,
      });
      const folderId = Number(searchParams.get("folder") || 0);
      const policyId = Number((created as { id?: number })?.id || 0);
      const typeId =
        policyForm.document_type_ids[0] || documents.data?.[0]?.id;
      if (folderId && policyId && typeId) {
        await createDocument.mutateAsync({
          name: policyDocumentFileName(policyForm.name),
          folder_id: folderId,
          document_type_id: typeId,
          is_policy: true,
          linked_policy_id: policyId,
        });
      }
    } catch (error: any) {
      setPolicySubmitError(error?.message || "Failed to create policy.");
      return;
    }
    setShowForm(false);
    setPolicyForm({
      name: "",
      description: "",
      policy_type_id: types.data?.[0]?.id ? String(types.data[0].id) : "",
      document_type_ids: [],
      applies_to: "all",
      scope_ids: [],
      schedule: "monthly",
      custom_schedule_days: "30",
      minimum_documents: "1",
      grace_period_days: "0",
      effective_date: new Date().toISOString().slice(0, 10),
      allow_waiver: true,
      alert_schedule_days: "60,30,15,7,0",
      escalate_manager_days: 0,
      escalate_hr_days: 7,
      auto_request_renewal: true,
      event_trigger: "onboarding",
      due_days: 14,
      reminder_frequency_days: 3,
      assigned_reviewer_id: "",
      audit_frequency: "quarterly",
      sample_pct: 100,
      assigned_auditor_id: "",
      policy_category: "",
      lifecycle_status: "active",
      active: true,
      policy_visibility: "employees",
      policy_audience: "everyone",
    });
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
    setRunning(true);
    try {
      const runnable = (policies.data ?? []).filter(policyCanRun);
      for (const policy of runnable) await evaluate.mutateAsync(policy.id);
    } finally {
      setRunning(false);
    }
  };

  const runAiDraft = async () => {
    const title = aiName.trim();
    if (!title) {
      await showAlert("Enter a policy name.", { title: "Create with AI" });
      return;
    }
    setAiPending(true);
    try {
      const result = await api.draftAiPolicy({
        name: title,
        description: aiDescription,
        policy_type_id: aiPolicyTypeId ? Number(aiPolicyTypeId) : undefined,
        document_type_ids: aiDocumentTypeIds,
        document_type_id: aiDocumentTypeIds[0],
      });
      if (!result.success) {
        await showAlert(result.message || "Unable to draft this policy.", {
          title: "Create with AI",
        });
        return;
      }
      const policyId = Number(result.data?.policy_id || 0);
      setAiName("");
      setAiDescription("");
      setAiDocumentTypeIds([]);
      setPolicyPath(null);
      setSearch("");
      await policies.refetch();
      if (policyId) setReviewPolicyId(policyId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to draft this policy.";
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
    <div className="relative app-page space-y-6">
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
            {tab === "exceptions" ? "New Exception" : "New Policy"}
          </button>
        </div>
      </div>
      <div className="app-page-metrics">
        <div className="app-page-metric">
          <span>Active policies</span>
          <strong>{policies.data?.length ?? 0}</strong>
        </div>
        <div className="app-page-metric">
          <span>Open exceptions</span>
          <strong>
            {exceptions.data?.filter((item) => item.active !== false && ["draft", "approved"].includes(item.status)).length ?? 0}
          </strong>
        </div>
        <div className="app-page-metric">
          <span>Policy runs</span>
          <strong>{runs.data?.length ?? 0}</strong>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionTabs
            items={[
              { id: "policies", label: "Policies" },
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
        {tab === "policies" && (
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
                      `Delete ${selectedPolicyIds.length} selected polic${selectedPolicyIds.length === 1 ? "y" : "ies"}? This cannot be undone.`,
                      { title: "Delete policies", confirmLabel: "Delete" },
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
            onClose={() => {
              setPolicySubmitError("");
              setShowForm(false);
            }}
            onSubmit={submitPolicy}
          />
        ))}
      {tab !== "exceptions" && policyPath === "chooser" ? (
        <ModalDialog
          title="New policy"
          eyebrow="Three ways to start"
          onClose={() => setPolicyPath(null)}
          size="md"
        >
          <div className="grid gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-pink"
              onClick={() => {
                setPolicyPath("scratch");
                setShowForm(true);
              }}
            >
              <strong>From scratch</strong>
              <p className="text-sm text-muted-foreground">Configure a policy yourself.</p>
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-pink"
              onClick={() => setPolicyPath("import")}
            >
              <strong>Import existing document</strong>
              <p className="text-sm text-muted-foreground">
                Reuse an organizational file as the policy source.
              </p>
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-pink"
              onClick={() => setPolicyPath("ai")}
            >
              <strong>Create with AI</strong>
              <p className="text-sm text-muted-foreground">
                Writes a short description and saves a draft.
              </p>
            </button>
          </div>
        </ModalDialog>
      ) : null}
      {policyPath === "import" ? (
        <ModalDialog
          title="Import existing document"
          eyebrow="New policy"
          onClose={() => setPolicyPath("chooser")}
          size="md"
        >
          <ThemedSelect
            value={importDocumentId}
            onChange={setImportDocumentId}
            placeholder="Select a document"
            options={(orgDocuments.data ?? []).map((item) => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="secondary-button" onClick={() => setPolicyPath("chooser")}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!importDocumentId}
              onClick={() =>
                void (async () => {
                  const result = await api.importOrganizationalPolicy(Number(importDocumentId));
                  if (!result.success) {
                    await showAlert(result.message || "Unable to import.", { title: "Import policy" });
                    return;
                  }
                  setPolicyPath("scratch");
                  policies.refetch();
                })()
              }
            >
              Import
            </button>
          </div>
        </ModalDialog>
      ) : null}
      {policyPath === "ai" ? (
        <ModalDialog
          title="Create with AI"
          eyebrow="New policy"
          onClose={() => {
            if (!aiPending) setPolicyPath("chooser");
          }}
          size="md"
        >
          {aiPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
              <p className="text-sm font-semibold text-slate-700">Drafting policy…</p>
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
                <span className="font-semibold">Policy name</span>
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
                  <span className="font-semibold">Policy type</span>
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
                  <PolicyTypeMultiSelect
                    types={documents.data ?? []}
                    selected={aiDocumentTypeIds}
                    onChange={setAiDocumentTypeIds}
                    placeholder="Select document types"
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
        "Policy name",
        "Policy type",
        "Details",
        "Applies to",
        "Schedule",
        "Next run",
        "Status",
        "Actions",
      ]}
      empty="No policies found."
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
            <td className="cell">
              <PolicyActions
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
            <td className="cell"><ExceptionActions exception={item} /></td>
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
  return <div className="flex flex-wrap items-center justify-end gap-1">
    {exception.status === "draft" && <><button type="button" onClick={() => approve.mutateAsync(exception.id)} disabled={approve.isPending} className="row-action text-emerald-600" title="Approve exception" aria-label="Approve exception"><ShieldCheck /></button><button type="button" onClick={() => reject.mutateAsync(exception.id)} disabled={reject.isPending} className="row-action danger" title="Reject exception" aria-label="Reject exception"><Ban /></button></>}
    <button type="button" onClick={toggle} disabled={deactivate.isPending || reactivate.isPending} className="row-action" title={active ? "Deactivate exception" : "Reactivate exception"} aria-label={active ? "Deactivate exception" : "Reactivate exception"}>{active ? <ToggleLeft /> : <RotateCcw />}</button>
    <button type="button" onClick={deleteException} disabled={remove.isPending} className="row-action danger" title="Delete exception"><Trash2 /></button>
  </div>;
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
      headers={["Policy", "Run type", "Employees", "Results", "Evaluated at"]}
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
              <th key={header} className="px-5 py-4">
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

  if (typeCode === "compliance_request") {
    return (
      <>
        <Field label="When should this start?">
          <ThemedSelect
            value={form.event_trigger}
            onChange={(val) => setForm({ ...form, event_trigger: val })}
            options={Object.entries(EVENT_TRIGGER_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
        <Field label="Days to submit">
          <input
            type="number"
            min="1"
            className="field"
            value={form.due_days}
            onChange={(e) =>
              setForm({ ...form, due_days: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Reminder every (days)">
          <input
            type="number"
            min="1"
            className="field"
            value={form.reminder_frequency_days}
            onChange={(e) =>
              setForm({
                ...form,
                reminder_frequency_days: Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Who follows up?">
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
    );
  }

  if (typeCode === "retention") {
    return (
      <>
        <Field label="How often to check">
          <ThemedSelect
            value={form.audit_frequency}
            onChange={(val) => setForm({ ...form, audit_frequency: val })}
            options={Object.entries(AUDIT_FREQUENCY_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
        <Field label="Sample size (%)">
          <input
            type="number"
            min="1"
            max="100"
            className="field"
            value={form.sample_pct}
            onChange={(e) =>
              setForm({ ...form, sample_pct: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Who runs the check?" full>
          <ThemedSelect
            value={String(form.assigned_auditor_id || "")}
            onChange={(val) =>
              setForm({ ...form, assigned_auditor_id: val })
            }
            placeholder="Select HR contact"
            options={(targets?.users || []).map((u: any) => ({
              value: String(u.id),
              label: u.name,
            }))}
          />
        </Field>
      </>
    );
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
  organizationalMode,
}: any) {
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [formError, setFormError] = useState("");
  const scopeOptions =
    form.applies_to === "department"
      ? (targets?.departments ?? [])
      : form.applies_to === "grade"
        ? (targets?.grades ?? [])
        : (targets?.employees ?? []);

  const selectedType = (types || []).find(
    (t: any) => String(t.id) === String(form.policy_type_id)
  );
  const typeCode = selectedType?.code || "";

  const toggleScope = (id: number) => {
    setForm({
      ...form,
      scope_ids: form.scope_ids.includes(id)
        ? form.scope_ids.filter((item: number) => item !== id)
        : [...form.scope_ids, id],
    });
  };

  const submit = (event: FormEvent) => {
    if (!form.policy_type_id) {
      event.preventDefault();
      setFormError("Please select a policy type.");
      return;
    }
    if (!form.document_type_ids.length) {
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
  const scopeLabels =
    form.applies_to === "all"
      ? ["All employees"]
      : scopeOptions
          .filter((item: any) => form.scope_ids.includes(item.id))
          .map((item: any) => item.name);

  return (
    <ModalDialog
      title={step === "configure" ? "Create policy" : "Review policy"}
      eyebrow={organizationalMode ? "New policy" : "Compliance engine"}
      onClose={onClose}
      size="xl"
      zIndex={organizationalMode ? 110 : 50}
    >
      {step === "configure" ? (
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Policy name">
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Policy type">
          <ThemedSelect
            value={form.policy_type_id}
            onChange={(value) => setForm({ ...form, policy_type_id: value })}
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
        <Field label="Status">
          <ThemedSelect
            value={form.active === false ? "inactive" : "active"}
            onChange={(value) => setForm({ ...form, active: value === "active" })}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>
        <Field label="Applies to">
          <ThemedSelect
            value={form.applies_to}
            onChange={(value) =>
              setForm({ ...form, applies_to: value, scope_ids: [] })
            }
            options={[
              { value: "all", label: "All Employees" },
              { value: "department", label: "Departments" },
              { value: "grade", label: "Groups" },
              { value: "employee", label: "Employees" },
            ]}
          />
        </Field>
        <ScopeChecklist
          appliesTo={form.applies_to}
          items={scopeOptions}
          selected={form.scope_ids}
          onToggle={toggleScope}
        />

        <TypeSpecificFields
          typeCode={typeCode}
          form={form}
          setForm={setForm}
          targets={targets}
        />

        <div className="sm:col-span-2">
          <span className="label">Required documents</span>
          <PolicyTypeMultiSelect
            types={documents}
            selected={form.document_type_ids}
            onChange={(document_type_ids) =>
              setForm({ ...form, document_type_ids })
            }
            error={
              formError === "Select at least one required document type."
                ? formError
                : undefined
            }
          />
        </div>
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
        {typeCode !== "document_requirement" && typeCode !== "renewable_document" ? (
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
        <div>
          <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Policy name</dt>
              <dd className="font-bold text-slate-800">{form.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Policy type</dt>
              <dd className="text-slate-700">{selectedType?.name || "—"}</dd>
            </div>
            {form.description && (
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Description</dt>
                <dd className="text-right text-slate-700">{form.description}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Required document types</dt>
              <dd className="text-right text-slate-700">
                {selectedDocumentTypes.map((item: any) => item.name).join(", ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Applies to</dt>
              <dd className="text-right text-slate-700">{scopeLabels.join(", ")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Schedule</dt>
              <dd className="text-slate-700">
                {formatFieldLabel(form.schedule || "manual")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Effective date</dt>
              <dd className="text-slate-700">{form.effective_date}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Minimum documents</dt>
              <dd className="text-slate-700">{form.minimum_documents}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-slate-500">Grace period</dt>
              <dd className="text-slate-700">{form.grace_period_days} days</dd>
            </div>
          </dl>
          {submitError && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setStep("configure")}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={(event) => submit(event as unknown as FormEvent)}
              className="app-btn app-btn-primary"
            >
              {pending ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
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
        <Field label="Policy">
          <ThemedSelect value={form.policy_id} onChange={(value) => setForm({ ...form, policy_id: value })} placeholder="Select policy" options={policies.map((item: any) => ({ value: String(item.id), label: item.name }))} />
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
