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
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ComplianceRequestRequirementsSection from "./ComplianceRequestRequirementsSection";
import { formatFieldLabel, formatStatusLabel } from "../../../lib/formatLabel";
import {
  buildCreatePolicyPayload,
  changePolicyFormType,
  type PolicyCreateFormState,
} from "../../../lib/policyCreateForm";
import {
  validatePolicyCreateForm,
  type PolicyWizardStep,
} from "../../../lib/policyCreateValidation";
import {
  fieldErrorsForWizardStep,
  fieldErrorsFromMissingFields,
  type PolicyWizardFieldId,
} from "../../../lib/policyWizardFieldErrors";
import { complianceRuleCreatePath } from "../../../lib/complianceRuleCreatePath";
import {
  clearSessionFormDraft,
  readSessionFormDraft,
  writeSessionFormDraft,
} from "../../../lib/sessionFormDraft";
import { TASK_TYPE_LABELS } from "../../../lib/complianceRequestTasks";
import {
  coerceEffectiveDate,
  coercePolicyAppliesTo,
  coercePolicyAuditFrequency,
  coercePolicyEventTrigger,
  coercePolicySchedule,
} from "../../../lib/policyFieldCoercion";
import {
  buildScopePayload,
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
  useDeletePolicy,
  useDocumentTypes,
  useEvaluatePolicy,
  useEvaluationRuns,
  useExceptions,
  useReactivateException,
  useRejectException,
  usePolicies,
  usePolicyTypes,
  useRetentionComplianceSettings,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { useComplianceRunToast } from "../../../hooks/useComplianceRunToast";
import { api } from "../../../lib/api";
import BulkActionBar from "./BulkActionBar";
import ComplianceRuleActions from "./ComplianceRuleActions";
import ModalDialog from "./ModalDialog";
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
import ComplianceReviewScheduleFields from "./ComplianceReviewScheduleFields";
import ComplianceVerificationFields from "./ComplianceVerificationFields";
import PolicyEngineWizardChrome from "./compliance/PolicyEngineWizardChrome";
import RetentionPolicyWizardPanel from "./compliance/RetentionPolicyWizardPanel";
import {
  PolicyWizardAudienceSection,
  PolicyWizardBasicsSection,
  PolicyWizardRequirementsSection,
  PolicyWizardRetentionConfigureSection,
  PolicyWizardTimingSection,
} from "./compliance/PolicyWizardGenericPanels";
import { PolicyWizardSectionError } from "./compliance/PolicyWizardField";
import {
  DOCUMENT_REQUIREMENT_WIZARD_LABELS,
  isDocumentRequirementPageWizard,
  policyEngineWizardLabels,
  policyEngineWizardTitle,
  policyWizardStepKeys,
} from "../../../lib/documentRequirementWizard";
import {
  DocumentRequirementAudiencePanel,
  DocumentRequirementBasicsPanel,
  DocumentRequirementDocumentsPanel,
  DocumentRequirementTimingPanel,
  DocumentRequirementVerificationPanel,
} from "./compliance/DocumentRequirementWizardPanels";
import { PolicyRequirementsDocumentsSection } from "./compliance/PolicyRequirementsDocumentsSection";
import {
  RenewableDocumentRequirementFields,
  RenewableEffectiveDateField,
} from "./compliance/RenewableDocumentRequirementFields";
import { policyTypeUsesDocumentTypeList } from "../../../lib/policyDocumentPicker";
import { PolicyWizardGraceAndNonComplianceFields } from "./compliance/PolicyWizardGraceAndNonComplianceFields";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type Tab = "rules" | "exceptions" | "history" | "reports";
const COMPLIANCE_EXCEPTION_FORM_DRAFT_KEY = "compliance/exception-form";

type ComplianceExceptionFormState = {
  employee_ids: number[];
  policy_id: string;
  reason: string;
  valid_until: string;
};

const emptyExceptionForm = (): ComplianceExceptionFormState => ({
  employee_ids: [],
  policy_id: "",
  reason: "",
  valid_until: "",
});

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
  const { runPolicyEvaluation, runManyPolicyEvaluations } = useComplianceRunToast();
  const [tab, setTab] = useState<Tab>("rules");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [reviewPolicyId, setReviewPolicyId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const policies = usePolicies();
  const exceptions = useExceptions();
  const runs = useEvaluationRuns();
  const types = usePolicyTypes();
  const documents = useDocumentTypes();
  const targets = useComplianceTargets();
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
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setTab("rules");
    const path = searchParams.get("path");
    if (path === "ai") {
      router.replace(complianceRuleCreatePath("ai"));
      return;
    }
    if (path === "wizard" || path === "scratch") {
      router.replace(complianceRuleCreatePath("wizard"));
      return;
    }
    router.replace(complianceRuleCreatePath());
  }, [searchParams, router]);

  useEffect(() => {
    const ruleId = Number(
      searchParams.get("rule") || searchParams.get("policy") || 0,
    );
    if (ruleId > 0) {
      setTab("rules");
      setReviewPolicyId(ruleId);
    }
  }, [searchParams]);

  const [exceptionForm, setExceptionForm] = useState<ComplianceExceptionFormState>(
    emptyExceptionForm,
  );
  const exceptionDraftHydrated = useRef(false);

  useEffect(() => {
    if (!exceptionDraftHydrated.current) {
      exceptionDraftHydrated.current = true;
      const saved = readSessionFormDraft<ComplianceExceptionFormState>(
        COMPLIANCE_EXCEPTION_FORM_DRAFT_KEY,
      );
      if (saved) setExceptionForm(saved);
      return;
    }
    writeSessionFormDraft(COMPLIANCE_EXCEPTION_FORM_DRAFT_KEY, exceptionForm);
  }, [exceptionForm]);
  const displayedPolicies = (policies.data ?? []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const displayedExceptions = (exceptions.data ?? []).filter((item) =>
    `${item.employee} ${item.policy} ${item.reason}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
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
    clearSessionFormDraft(COMPLIANCE_EXCEPTION_FORM_DRAFT_KEY);
    setExceptionForm(emptyExceptionForm());
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
      await runPolicyEvaluation(target.name, () => evaluate.mutateAsync(target.id));
    } finally {
      setRunning(false);
    }
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
              if (tab === "exceptions") {
                setShowForm(true);
                return;
              }
              router.push(complianceRuleCreatePath());
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
                    const selected = (policies.data ?? []).filter((policy) =>
                      selectedPolicyIds.includes(policy.id),
                    );
                    await runManyPolicyEvaluations(selected, (id) =>
                      evaluate.mutateAsync(id),
                    );
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
      {showForm && tab === "exceptions" ? (
        <ExceptionForm
          form={exceptionForm}
          setForm={setExceptionForm}
          employees={targets.data?.employees ?? []}
          policies={policies.data ?? []}
          pending={createException.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={submitException}
        />
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

export { AlertCadenceSelector } from "./compliance/AlertCadenceSelector";

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
        <PolicyWizardGraceAndNonComplianceFields
          form={form}
          setForm={setForm}
        />
        <div className="flex items-end pb-1 sm:col-span-2">
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
  initialWizardStep = 0,
  onWizardStateChange,
  onPolicyTypeChange,
  reviewMeta,
  importDocumentId,
  presentation = "modal",
}: any) {
  const isPage = presentation === "page" && !organizationalMode;
  const [step, setStep] = useState<"configure" | "review">(initialStep);
  const [wizardStep, setWizardStep] = useState<number>(initialWizardStep);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<PolicyWizardFieldId, string>>
  >({});
  const [importPending, setImportPending] = useState(false);
  const [formTemplates, setFormTemplates] = useState<{ id: number; name: string }[]>([]);
  const entityName = organizationalMode ? "policy" : "rule";

  const applyPolicyTypeChange = useCallback(
    (newTypeId: string) => {
      if (String(form.policy_type_id) === String(newTypeId)) return;
      setForm((prev: PolicyCreateFormState) =>
        changePolicyFormType(prev, newTypeId),
      );
      if (isPage) {
        setWizardStep(0);
        setStep("configure");
        setFieldErrors({});
      }
      onPolicyTypeChange?.();
    },
    [form.policy_type_id, isPage, onPolicyTypeChange, setForm],
  );

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    setWizardStep(initialWizardStep);
  }, [initialWizardStep]);

  useEffect(() => {
    if (!isPage || !onWizardStateChange) return;
    onWizardStateChange({ wizardStep, step });
  }, [isPage, onWizardStateChange, wizardStep, step]);

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

  const retentionSettingsQuery = useRetentionComplianceSettings(
    typeCode === "retention",
  );

  useEffect(() => {
    if (typeCode !== "renewable_document") return;
    setForm((prev: PolicyCreateFormState) => {
      if (!prev.schedule && prev.minimum_documents === "1") return prev;
      return {
        ...prev,
        schedule: "",
        minimum_documents: "1",
      };
    });
  }, [typeCode, setForm]);

  useEffect(() => {
    if (typeCode !== "retention") return;
    setForm((prev: PolicyCreateFormState) => {
      if (!prev.schedule) return prev;
      return { ...prev, schedule: "" };
    });
  }, [typeCode, setForm]);

  const docReqWizard = isDocumentRequirementPageWizard(
    typeCode,
    isPage,
    organizationalMode,
  );
  const activeWizardStepKeys = useMemo(
    () => policyWizardStepKeys(typeCode, docReqWizard),
    [typeCode, docReqWizard],
  );

  useEffect(() => {
    if (!isPage || step === "review") return;
    const maxIndex = Math.max(0, activeWizardStepKeys.length - 1);
    if (wizardStep > maxIndex) {
      setWizardStep(maxIndex);
    }
  }, [isPage, step, wizardStep, activeWizardStepKeys.length, typeCode]);

  const wizardStepperLabels = docReqWizard
    ? DOCUMENT_REQUIREMENT_WIZARD_LABELS
    : policyEngineWizardLabels(typeCode);
  const policyPageWizard = isPage;
  const reviewStepIndex = activeWizardStepKeys.length;
  const allDocumentTypes = documents as DocumentType[];
  const selectableDocumentTypes = useMemo(
    () =>
      documentTypesForCompliancePolicy(
        typeCode,
        allDocumentTypes,
        retentionSettingsQuery.data,
      ),
    [typeCode, allDocumentTypes, retentionSettingsQuery.data],
  );

  const clearFieldError = (id: PolicyWizardFieldId) => {
    setFieldErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const applyStepValidationErrors = (stepKey: PolicyWizardStep) => {
    const errors = fieldErrorsForWizardStep(
      stepKey,
      form,
      typeCode,
      reviewMeta,
      entityName,
    );
    if (Object.keys(errors).length === 0) return false;
    setFieldErrors((current) => ({ ...current, ...errors }));
    return true;
  };

  useEffect(() => {
    if (typeCode !== "compliance_request" && typeCode !== "review_schedule") return;
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
    event.preventDefault();
    if (!form.policy_type_id) {
      if (isPage) {
        setFieldErrors((current) => ({
          ...current,
          policy_type_id: organizationalMode
            ? "Select a policy type."
            : "Select a rule type.",
        }));
      } else {
        setFormError(
          organizationalMode
            ? "Please select a policy type."
            : "Please select a rule type.",
        );
      }
      return;
    }
    const validation = validatePolicyCreateForm(
      form,
      typeCode,
      reviewMeta,
      organizationalMode ? "policy" : "rule",
    );
    if (!validation.canConfirm && step === "review") {
      if (isPage) {
        setFieldErrors(
          fieldErrorsFromMissingFields(
            validation.missingFields,
            entityName,
          ),
        );
      } else {
        setFormError(
          validation.missingFields[0] || "Complete required fields.",
        );
      }
      return;
    }
    if (step === "configure" && isPage) {
      const stepKey = activeWizardStepKeys[wizardStep];
      if (applyStepValidationErrors(stepKey)) {
        return;
      }
      if (wizardStep < activeWizardStepKeys.length - 1) {
        setFieldErrors({});
        setWizardStep((value) => value + 1);
        return;
      }
      if (!validation.canConfirm) {
        setFieldErrors(
          fieldErrorsFromMissingFields(
            validation.missingFields,
            entityName,
          ),
        );
        return;
      }
      setFieldErrors({});
      setStep("review");
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
        setFormError(
          configureValidation.missingFields[0] || "Complete required fields.",
        );
        return;
      }
    } else if (typeCode !== "compliance_request" && !form.document_type_ids.length) {
      setFormError("Select at least one required document type.");
      return;
    }
    setFormError("");
    if (step === "configure") {
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
  const showBasics = !isPage || wizardStep === 0;
  const showDocuments = docReqWizard && isPage && wizardStep === 1;
  const showAudience = docReqWizard
    ? isPage && wizardStep === 2
    : !isPage || wizardStep === 1;
  const showRequirements = docReqWizard
    ? false
    : !isPage || wizardStep === 2;
  const showTiming = docReqWizard
    ? isPage && wizardStep === 3
    : typeCode === "renewable_document" || typeCode === "retention"
      ? false
      : !isPage || wizardStep === 3;
  const showVerification = docReqWizard && isPage && wizardStep === 4;
  const pageStepIndex = step === "review" ? reviewStepIndex : wizardStep;

  const goToWizardCard = (index: number) => {
    if (index === reviewStepIndex) {
      if (step === "review") return;
      for (let i = 0; i < activeWizardStepKeys.length; i++) {
        const stepKey = activeWizardStepKeys[i];
        const errors = fieldErrorsForWizardStep(
          stepKey,
          form,
          typeCode,
          reviewMeta,
          entityName,
        );
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          setStep("configure");
          setWizardStep(i);
          return;
        }
      }
      setFieldErrors({});
      setStep("review");
      return;
    }
    if (index < pageStepIndex) {
      setStep("configure");
      setWizardStep(index);
      return;
    }
    if (index === pageStepIndex) return;
    for (let i = wizardStep; i < index; i++) {
      const stepKey = activeWizardStepKeys[i];
      const errors = fieldErrorsForWizardStep(
        stepKey,
        form,
        typeCode,
        reviewMeta,
        entityName,
      );
      if (Object.keys(errors).length) {
        setFieldErrors((current) => ({ ...current, ...errors }));
        setWizardStep(i);
        return;
      }
    }
    setStep("configure");
    setWizardStep(index);
  };

  const reviewScreen = (
    <ComplianceRuleReviewScreen
      form={form}
      typeName={selectedType?.name || ""}
      typeCode={typeCode}
      documentTypeNames={selectedDocumentTypes.map((item: any) => item.name)}
      documentTypes={allDocumentTypes}
      scopeLabels={scopeLabels}
      retentionPreview={retentionPreview}
      reviewMeta={reviewMeta}
      submitError={submitError || formError}
      pending={pending || importPending}
      entityName={entityName}
      confirmLabel={importDocumentId ? "Confirm import" : "Confirm"}
      onBack={() => {
        setStep("configure");
        if (isPage) {
          setWizardStep(Math.max(0, activeWizardStepKeys.length - 1));
        }
      }}
      onConfirm={() =>
        void (async () => {
          if (importDocumentId) {
            setImportPending(true);
            try {
              const result = await api.confirmPolicyImport(
                importDocumentId,
                buildCreatePolicyPayload(form, typeCode),
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
  );

  const configureForm = docReqWizard ? (
    <form
      id="compliance-policy-wizard-form"
      onSubmit={submit}
      className="space-y-2"
    >
      {showBasics ? (
        <DocumentRequirementBasicsPanel
          form={form}
          setForm={setForm}
          entityName={entityName}
          types={types || []}
          documentTypes={allDocumentTypes}
          fieldErrors={fieldErrors}
          onFieldEdit={clearFieldError}
          onPolicyTypeChange={applyPolicyTypeChange}
        />
      ) : null}
      {showDocuments ? (
        <DocumentRequirementDocumentsPanel
          form={form}
          setForm={setForm}
          selectableDocumentTypes={selectableDocumentTypes}
          documentTypeError={fieldErrors.document_type_ids}
          onDocumentTypesChange={() => clearFieldError("document_type_ids")}
        />
      ) : null}
      {showAudience ? (
        <DocumentRequirementAudiencePanel
          form={form}
          setForm={setForm}
          targets={targets}
          audienceError={fieldErrors.audience}
          onAudienceChange={() => clearFieldError("audience")}
        />
      ) : null}
      {showTiming ? (
        <DocumentRequirementTimingPanel
          form={form}
          setForm={setForm}
          fieldErrors={fieldErrors}
          onFieldEdit={clearFieldError}
        />
      ) : null}
      {showVerification ? (
        <DocumentRequirementVerificationPanel
          form={form}
          setForm={setForm}
          documentTypes={allDocumentTypes}
          entityName={entityName}
        />
      ) : null}
      {submitError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {submitError}
        </p>
      ) : null}
    </form>
  ) : (
    <form
      id="compliance-policy-wizard-form"
      onSubmit={submit}
      className={policyPageWizard ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}
    >
      {showBasics ? (
        policyPageWizard ? (
          <PolicyWizardBasicsSection>
            <Field
              label={organizationalMode ? "Policy name" : "Rule name"}
              error={fieldErrors.name}
            >
              <input
                required
                className="field"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  clearFieldError("name");
                }}
              />
            </Field>
            <Field
              label={organizationalMode ? "Policy type" : "Rule type"}
              error={fieldErrors.policy_type_id}
            >
              <ThemedSelect
                value={form.policy_type_id}
                onChange={(value) => {
                  applyPolicyTypeChange(value);
                  clearFieldError("policy_type_id");
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
                rows={3}
                className="field min-h-[5rem] sm:col-span-2"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
            {typeCode === "renewable_document" ? (
              <RenewableEffectiveDateField
                form={form}
                setForm={setForm}
                fieldErrors={fieldErrors}
                onFieldEdit={clearFieldError}
              />
            ) : null}
            {typeCode === "retention" ? (
              <RenewableEffectiveDateField
                form={form}
                setForm={setForm}
                fieldErrors={fieldErrors}
                onFieldEdit={clearFieldError}
                helpText="This policy starts evaluating retention dates for in-scope documents on or after this date."
              />
            ) : null}
          </PolicyWizardBasicsSection>
        ) : (
          <>
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
                onChange={(value) => applyPolicyTypeChange(value)}
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
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
            {typeCode === "renewable_document" ? (
              <RenewableEffectiveDateField
                form={form}
                setForm={setForm}
                full={false}
              />
            ) : null}
            {typeCode === "retention" ? (
              <RenewableEffectiveDateField
                form={form}
                setForm={setForm}
                full={false}
                helpText="This policy starts evaluating retention dates for in-scope documents on or after this date."
              />
            ) : null}
          </>
        )
      ) : null}
      {showAudience ? (
        policyPageWizard ? (
          <PolicyWizardAudienceSection>
            <PolicyAudienceFilters
              hideTitle
              scope={form.scope}
              targets={targets}
              onChange={(scope) => {
                setForm({
                  ...form,
                  scope,
                  applies_to: buildScopePayload(scope).applies_to,
                });
                clearFieldError("audience");
              }}
            />
            <PolicyWizardSectionError
              error={fieldErrors.audience}
              className="mt-2"
            />
          </PolicyWizardAudienceSection>
        ) : (
          <div className="sm:col-span-2">
            <PolicyAudienceFilters
              scope={form.scope}
              targets={targets}
              onChange={(scope) =>
                setForm({
                  ...form,
                  scope,
                  applies_to: buildScopePayload(scope).applies_to,
                })
              }
            />
          </div>
        )
      ) : null}

      {showRequirements ? (
        policyPageWizard ? (
          typeCode === "retention" ? (
          <PolicyWizardRetentionConfigureSection>
            <RetentionPolicyWizardPanel
              form={form}
              setForm={setForm}
              selectableDocumentTypes={selectableDocumentTypes}
              fieldErrors={fieldErrors}
              onFieldEdit={clearFieldError}
            />
            <PolicyWizardSectionError
              error={fieldErrors.requirements}
              className="mt-2"
            />
          </PolicyWizardRetentionConfigureSection>
        ) : (
          <PolicyWizardRequirementsSection typeName={selectedType?.name}>
        {typeCode === "renewable_document" ? (
          <>
            <div className="sm:col-span-2">
              <PolicyRequirementsDocumentsSection
                typeCode={typeCode}
                form={form}
                setForm={setForm}
                selectableDocumentTypes={selectableDocumentTypes}
                documentTypeError={fieldErrors.document_type_ids}
                onDocumentTypesChange={() =>
                  clearFieldError("document_type_ids")
                }
              />
            </div>
            <RenewableDocumentRequirementFields
              form={form}
              setForm={setForm}
            />
            <ComplianceVerificationFields
              form={form}
              setForm={setForm}
              typeCode={typeCode}
              documentTypes={allDocumentTypes}
              entityName={entityName}
            />
          </>
        ) : typeCode === "review_schedule" ? (
          <ComplianceReviewScheduleFields
            form={form}
            setForm={setForm}
            forms={formTemplates}
            targets={targets}
          />
        ) : (
          <>
            {policyTypeUsesDocumentTypeList(typeCode) ? (
              <div className="sm:col-span-2">
                <PolicyRequirementsDocumentsSection
                  typeCode={typeCode}
                  form={form}
                  setForm={setForm}
                  selectableDocumentTypes={selectableDocumentTypes}
                  documentTypeError={fieldErrors.document_type_ids}
                  onDocumentTypesChange={() =>
                    clearFieldError("document_type_ids")
                  }
                />
              </div>
            ) : null}
            <TypeSpecificFields
              typeCode={typeCode}
              form={form}
              setForm={setForm}
              targets={targets}
            />
            {typeCode === "compliance_request" ? (
              <ComplianceRequestRequirementsSection
                form={form}
                setForm={setForm}
                documentTypes={allDocumentTypes}
                linkableContext={{
                  applies_to: form.applies_to,
                  scope: form.scope,
                }}
                forms={formTemplates}
                targets={targets}
              />
            ) : null}
            <ComplianceVerificationFields
              form={form}
              setForm={setForm}
              typeCode={typeCode}
              documentTypes={allDocumentTypes}
              entityName={entityName}
            />
          </>
        )}
            <PolicyWizardSectionError
              error={fieldErrors.requirements}
              className="sm:col-span-2"
            />
          </PolicyWizardRequirementsSection>
        )
        ) : (
        <>
        {typeCode === "retention" ? (
          <RetentionPolicyWizardPanel
            form={form}
            setForm={setForm}
            selectableDocumentTypes={selectableDocumentTypes}
          />
        ) : typeCode === "renewable_document" ? (
          <>
            <div className="sm:col-span-2">
              <PolicyRequirementsDocumentsSection
                typeCode={typeCode}
                form={form}
                setForm={setForm}
                selectableDocumentTypes={selectableDocumentTypes}
                documentTypeError={
                  formError === "Select at least one required document type."
                    ? formError
                    : undefined
                }
              />
            </div>
            <RenewableDocumentRequirementFields
              form={form}
              setForm={setForm}
              layout="grid"
            />
            <ComplianceVerificationFields
              form={form}
              setForm={setForm}
              typeCode={typeCode}
              documentTypes={allDocumentTypes}
              entityName={entityName}
            />
          </>
        ) : typeCode === "review_schedule" ? (
          <ComplianceReviewScheduleFields
            form={form}
            setForm={setForm}
            forms={formTemplates}
            targets={targets}
          />
        ) : (
          <>
            {policyTypeUsesDocumentTypeList(typeCode) ? (
              <div className="sm:col-span-2">
                <PolicyRequirementsDocumentsSection
                  typeCode={typeCode}
                  form={form}
                  setForm={setForm}
                  selectableDocumentTypes={selectableDocumentTypes}
                  documentTypeError={
                    formError === "Select at least one required document type."
                      ? formError
                      : undefined
                  }
                />
              </div>
            ) : null}
            <TypeSpecificFields
              typeCode={typeCode}
              form={form}
              setForm={setForm}
              targets={targets}
            />
            {typeCode === "compliance_request" ? (
              <ComplianceRequestRequirementsSection
                form={form}
                setForm={setForm}
                documentTypes={allDocumentTypes}
                linkableContext={{
                  applies_to: form.applies_to,
                  scope: form.scope,
                }}
                forms={formTemplates}
                targets={targets}
              />
            ) : null}
            <ComplianceVerificationFields
              form={form}
              setForm={setForm}
              typeCode={typeCode}
              documentTypes={allDocumentTypes}
              entityName={entityName}
            />
          </>
        )}
        </>
        )
      ) : null}

      {showTiming &&
      typeCode !== "renewable_document" &&
      typeCode !== "retention" ? (
        policyPageWizard ? (
          <PolicyWizardTimingSection>
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
        <Field label="Effective date" error={fieldErrors.effective_date}>
          <input
            required
            type="date"
            className="field"
            value={form.effective_date}
            onChange={(e) => {
              setForm({ ...form, effective_date: e.target.value });
              clearFieldError("effective_date");
            }}
          />
        </Field>
        {typeCode !== "compliance_request" &&
        typeCode !== "retention" &&
        typeCode !== "review_schedule" ? (
          <Field label="Copies needed" error={fieldErrors.minimum_documents}>
            <input
              required
              min="1"
              type="number"
              className="field"
              value={form.minimum_documents}
              onChange={(e) => {
                setForm({ ...form, minimum_documents: e.target.value });
                clearFieldError("minimum_documents");
              }}
            />
          </Field>
        ) : null}
          </PolicyWizardTimingSection>
        ) : (
        <>
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
        {typeCode !== "compliance_request" &&
        typeCode !== "retention" &&
        typeCode !== "review_schedule" ? (
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
        </>
        )
      ) : null}
      {(formError || submitError) && !policyPageWizard ? (
        <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {formError || submitError}
        </p>
      ) : null}
      {policyPageWizard && submitError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {submitError}
        </p>
      ) : null}
      {!isPage ? (
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-3 sm:col-span-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button className="app-btn app-btn-primary">Review</button>
        </div>
      ) : null}
    </form>
  );

  if (isPage) {
    const stepperLabels = [...wizardStepperLabels];
    const stepperActiveIndex =
      step === "review"
        ? docReqWizard
          ? stepperLabels.length
          : reviewStepIndex
        : wizardStep;
    const onLastConfigureStep =
      wizardStep >= activeWizardStepKeys.length - 1;

    return (
      <PolicyEngineWizardChrome
        title={policyEngineWizardTitle(selectedType?.name || "rule", step)}
        stepperLabels={stepperLabels}
        stepperActiveIndex={stepperActiveIndex}
        onStepSelect={goToWizardCard}
        showFooter={step === "configure"}
        wizardStep={wizardStep}
        onCancel={onClose}
        onBack={() => {
          setWizardStep((value) => value - 1);
        }}
        continueLabel={
          onLastConfigureStep
            ? typeCode === "retention"
              ? "Preview & Save"
              : "Review"
            : "Continue"
        }
        showContinueArrow={!onLastConfigureStep}
        formId="compliance-policy-wizard-form"
        fullWidth={typeCode === "retention"}
      >
        {step === "configure" ? configureForm : reviewScreen}
      </PolicyEngineWizardChrome>
    );
  }

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
      {step === "configure" ? configureForm : reviewScreen}
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
function Field({ label, full, error, children }: any) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
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
