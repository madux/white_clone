"use client";

import { ClipboardList, Loader2, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { complianceRuleCreatePath } from "../../../../lib/complianceRuleCreatePath";
import { clearComplianceRuleCreateDraft } from "../../../../lib/complianceRuleCreateDraft";
import {
  buildCreatePolicyPayload,
  defaultPolicyForm,
  type PolicyCreateFormState,
  type PolicyReviewMeta,
} from "../../../../lib/policyCreateForm";
import { proposalToForm, reviewMetaFromProposal } from "../../../../lib/policyProposal";
import { documentTypesForCompliancePolicy } from "../../../../lib/complianceDocumentTypes";
import {
  useCreatePolicy,
  useComplianceTargets,
  useDocumentTypes,
  usePolicyTypes,
} from "../../../../hooks/useDocuments";
import { useAppDialog } from "../../../../hooks/useAppDialog";
import { api } from "../../../../lib/api";
import BackButton from "../BackButton";
import { AiPolicyDocumentTypePicker } from "./AiPolicyDocumentTypePicker";
import { PolicyForm } from "../CompliancePage";
import ThemedSelect from "../ThemedSelect";

const AI_BRIEF_CHIPS = [
  { label: "Who it applies to", text: "Applies to all employees." },
  { label: "What's required", text: "Staff must complete the required documents." },
  { label: "When it starts", text: "Takes effect from the activation date." },
];

type WizardProgress = {
  step: "configure" | "review";
  wizardStep: number;
};

export default function ComplianceRuleCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flow = searchParams.get("flow");
  const { showAlert } = useAppDialog();

  const types = usePolicyTypes();
  const documents = useDocumentTypes();
  const targets = useComplianceTargets();
  const createPolicy = useCreatePolicy();

  const [policyForm, setPolicyForm] = useState<PolicyCreateFormState>(() =>
    defaultPolicyForm(""),
  );
  const [policyReviewMeta, setPolicyReviewMeta] = useState<PolicyReviewMeta>();
  const [wizardProgress, setWizardProgress] = useState<WizardProgress>({
    step: "configure",
    wizardStep: 0,
  });
  const [submitError, setSubmitError] = useState("");

  const [aiName, setAiName] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiPolicyTypeId, setAiPolicyTypeId] = useState("");
  const [aiDocumentTypeIds, setAiDocumentTypeIds] = useState<number[]>([]);
  const [aiPending, setAiPending] = useState(false);

  useEffect(() => {
    clearComplianceRuleCreateDraft();
  }, []);

  const handleWizardStateChange = useCallback((next: WizardProgress) => {
    setWizardProgress((prev) =>
      prev.step === next.step && prev.wizardStep === next.wizardStep
        ? prev
        : next,
    );
  }, []);

  const handlePolicyTypeChange = useCallback(() => {
    setPolicyReviewMeta(undefined);
    setWizardProgress({ step: "configure", wizardStep: 0 });
    clearComplianceRuleCreateDraft();
  }, []);

  useEffect(() => {
    if (!policyForm.policy_type_id && types.data?.length) {
      const documentRequirement = types.data.find(
        (item) => item.code === "document_requirement",
      );
      setPolicyForm((prev) => ({
        ...prev,
        policy_type_id: String(
          (documentRequirement ?? types.data![0]).id,
        ),
      }));
    }
  }, [types.data, policyForm.policy_type_id]);

  useEffect(() => {
    if (!aiPolicyTypeId && types.data?.length) {
      setAiPolicyTypeId(String(types.data[0].id));
    }
  }, [types.data, aiPolicyTypeId]);

  const aiPolicyTypeCode = useMemo(() => {
    const match = (types.data ?? []).find(
      (item) => String(item.id) === aiPolicyTypeId,
    );
    return match?.code ?? "";
  }, [types.data, aiPolicyTypeId]);

  const policyTypeCode = useMemo(() => {
    const match = (types.data ?? []).find(
      (item) => String(item.id) === policyForm.policy_type_id,
    );
    return match?.code ?? "";
  }, [types.data, policyForm.policy_type_id]);

  const aiSelectableDocumentTypes = useMemo(
    () =>
      documentTypesForCompliancePolicy(aiPolicyTypeCode, documents.data ?? []),
    [aiPolicyTypeCode, documents.data],
  );

  const leaveCreateFlow = () => {
    clearComplianceRuleCreateDraft();
    router.push("/pages/compliance");
  };

  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await createPolicy.mutateAsync(
        buildCreatePolicyPayload(policyForm, policyTypeCode),
      );
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create rule.",
      );
      return;
    }
    clearComplianceRuleCreateDraft();
    await showAlert(
      "Rule saved as draft. Activate it in Compliance when ready.",
      { title: "Draft created" },
    );
    router.push("/pages/compliance");
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
      const form = proposalToForm(result.data, {
        ...defaultPolicyForm(
          types.data?.[0]?.id ? String(types.data[0].id) : "",
        ),
        document_type_ids: aiDocumentTypeIds,
      });
      setPolicyForm(form);
      setPolicyReviewMeta(reviewMetaFromProposal(result.data));
      setWizardProgress({ step: "review", wizardStep: 3 });
      router.push(complianceRuleCreatePath("wizard"));
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

  if (flow === "wizard") {
    return (
      <PolicyForm
        presentation="page"
        form={policyForm}
        setForm={setPolicyForm}
        types={types.data ?? []}
        documents={documents.data ?? []}
        targets={targets.data}
        pending={createPolicy.isPending}
        submitError={submitError}
        initialStep={wizardProgress.step}
        initialWizardStep={wizardProgress.wizardStep}
        onWizardStateChange={handleWizardStateChange}
        onPolicyTypeChange={handlePolicyTypeChange}
        reviewMeta={policyReviewMeta}
        onClose={leaveCreateFlow}
        onSubmit={submitPolicy}
      />
    );
  }

  if (flow === "ai") {
    return (
      <div className="app-page min-h-full w-full space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <BackButton variant="page" />
        </div>
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
            New rule
          </p>
          <h1 className="text-3xl font-medium text-slate-900">Create with AI</h1>
        </section>
        {aiPending ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
            <p className="text-sm font-semibold text-slate-700">Drafting rule…</p>
            <p className="text-xs text-slate-500">
              This can take a little while. Keep this page open.
            </p>
          </div>
        ) : (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-800">Rule name</span>
              <input
                className="field"
                value={aiName}
                onChange={(event) => setAiName(event.target.value)}
                placeholder="Remote work, Code of conduct…"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-800">What should it cover?</span>
              <textarea
                className="field min-h-24"
                value={aiDescription}
                onChange={(event) => setAiDescription(event.target.value)}
                placeholder="Optional: who it applies to, what is required, when it starts"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-800">Rule type</span>
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
              <div className="sm:col-span-2">
                <AiPolicyDocumentTypePicker
                  typeCode={aiPolicyTypeCode}
                  policyTypeId={aiPolicyTypeId}
                  documentTypeIds={aiDocumentTypeIds}
                  onDocumentTypeIdsChange={setAiDocumentTypeIds}
                  selectableDocumentTypes={aiSelectableDocumentTypes}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Link
                href={complianceRuleCreatePath()}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
              >
                Cancel
              </Link>
              <button
                type="button"
                className="app-btn app-btn-primary"
                disabled={!aiName.trim()}
                onClick={() => void runAiDraft()}
              >
                Generate draft
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="app-page min-h-full w-full space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton variant="page" />
      </div>
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
          Compliance
        </p>
        <h1 className="text-3xl font-medium text-slate-900">New rule</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Choose how you want to build the rule. You can review everything before it is saved as a
          draft.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={complianceRuleCreatePath("wizard")}
          className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-brand-pink hover:shadow-sm"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
            <ClipboardList className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-bold text-slate-900">Rule wizard</p>
          <p className="mt-1 text-sm text-slate-500">
            Step through each section, then confirm.
          </p>
        </Link>
        <Link
          href={complianceRuleCreatePath("ai")}
          className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-brand-pink hover:shadow-sm"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-bold text-slate-900">Create with AI</p>
          <p className="mt-1 text-sm text-slate-500">
            Describe what you need; AI proposes fields for your review.
          </p>
        </Link>
      </div>
      <p className="text-center text-xs text-slate-400">
        <Wand2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        New rules are saved as drafts until you activate them in Compliance.
      </p>
    </div>
  );
}
