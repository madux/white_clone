"use client";

import { Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  useComplianceTargets,
  useCreatePolicy,
  useDocumentTypes,
  useDocuments,
  usePolicies,
  usePolicyTypes,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";
import type { DocDocument } from "../../../lib/types";
import {
  buildCreatePolicyPayload,
  defaultPolicyForm,
  type PolicyReviewMeta,
} from "../../../lib/policyCreateForm";
import { proposalToForm, reviewMetaFromProposal } from "../../../lib/policyProposal";
import { PolicyForm } from "./CompliancePage";
import ModalDialog from "./ModalDialog";
import ComplianceDocumentPickerModal from "./ComplianceDocumentPickerModal";
import ComplianceImportAnalyzeProgressModal from "./ComplianceImportAnalyzeProgressModal";
import ComplianceDocumentTypeMultiSelect from "./ComplianceDocumentTypeMultiSelect";
import ThemedSelect from "./ThemedSelect";

const AI_BRIEF_CHIPS = [
  { label: "Who it applies to", text: "Applies to all employees." },
  { label: "What's required", text: "Staff must complete the required documents." },
  { label: "When it starts", text: "Takes effect from the activation date." },
];

export type OrgPolicyCreatePath = "scratch" | "import" | "ai";

export default function OrganizationalCreatePolicyFlow({
  folderId,
  path,
  onClose,
  folderDocuments: folderDocumentsProp,
}: {
  folderId: number;
  path: OrgPolicyCreatePath;
  onClose: () => void;
  folderDocuments?: DocDocument[];
}) {
  const { showAlert } = useAppDialog();
  const types = usePolicyTypes();
  const documents = useDocumentTypes();
  const {
    data: fetchedFolderDocuments = [],
    refetch: refetchFolderDocuments,
    isLoading: folderDocumentsLoading,
  } = useDocuments(folderId, true, !folderDocumentsProp);
  const folderDocumentsList =
    folderDocumentsProp?.length ? folderDocumentsProp : fetchedFolderDocuments;
  const targets = useComplianceTargets();
  const createPolicy = useCreatePolicy();
  const policies = usePolicies();

  const [policyPath, setPolicyPath] = useState<OrgPolicyCreatePath | null>(path);
  const [policyForm, setPolicyForm] = useState(() => defaultPolicyForm(""));
  const [policySubmitError, setPolicySubmitError] = useState("");
  const [policyReviewMeta, setPolicyReviewMeta] = useState<PolicyReviewMeta>();
  const [policyFormInitialStep, setPolicyFormInitialStep] = useState<
    "configure" | "review"
  >("configure");
  const [importDocumentId, setImportDocumentId] = useState("");
  const [importConfirmDocumentId, setImportConfirmDocumentId] = useState<number>();
  const [importAnalyzing, setImportAnalyzing] = useState(false);
  const [aiName, setAiName] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiPolicyTypeId, setAiPolicyTypeId] = useState("");
  const [aiDocumentTypeIds, setAiDocumentTypeIds] = useState<number[]>([]);
  const [aiPending, setAiPending] = useState(false);

  useEffect(() => {
    if (policyPath === "import") {
      void refetchFolderDocuments();
    }
  }, [policyPath, folderId, refetchFolderDocuments]);

  useEffect(() => {
    if (!policyForm.policy_type_id && types.data?.[0]?.id) {
      setPolicyForm((prev) => ({
        ...prev,
        policy_type_id: String(types.data![0].id),
      }));
    }
  }, [types.data, policyForm.policy_type_id]);

  useEffect(() => {
    if (!aiPolicyTypeId && types.data?.[0]?.id) {
      setAiPolicyTypeId(String(types.data[0].id));
    }
  }, [types.data, aiPolicyTypeId]);

  useEffect(() => {
    if (aiDocumentTypeIds.length || !documents.data?.length) return;
    setAiDocumentTypeIds([documents.data[0].id]);
  }, [documents.data, aiDocumentTypeIds.length]);

  const closeAll = () => {
    setPolicyPath(null);
    onClose();
  };

  const resetReviewState = () => {
    setPolicyReviewMeta(undefined);
    setImportConfirmDocumentId(undefined);
    setPolicyFormInitialStep("configure");
    setPolicySubmitError("");
  };

  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    setPolicySubmitError("");
    try {
      await createPolicy.mutateAsync(buildCreatePolicyPayload(policyForm));
      await showAlert(
        "Policy saved as draft. Activate it in Compliance when ready.",
        { title: "Draft created" },
      );
      closeAll();
    } catch (error: unknown) {
      setPolicySubmitError(
        error instanceof Error ? error.message : "Failed to create policy.",
      );
    }
  };

  const appendAiBrief = (text: string) => {
    setAiDescription((current) => (current ? `${current}\n${text}` : text));
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
      if (!result.success || !result.data) {
        await showAlert(result.message || "Unable to draft this policy.", {
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
      setPolicyPath("scratch");
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

  const endImportAnalyzing = () => {
    flushSync(() => setImportAnalyzing(false));
  };

  const analyzeImport = async () => {
    const docId = Number(importDocumentId);
    if (!docId) return;
    setImportAnalyzing(true);
    try {
      const result = await api.analyzePolicyDocument(docId);
      if (!result.success || !result.data) {
        endImportAnalyzing();
        await showAlert(result.message || "Unable to analyze.", {
          title: "Import policy",
        });
        return;
      }
      endImportAnalyzing();
      setPolicyForm(
        proposalToForm(result.data.proposal, defaultPolicyForm("")),
      );
      setPolicyReviewMeta(
        reviewMetaFromProposal(result.data.proposal, {
          sourceDocumentId: result.data.document_id,
          sourceDocumentName: result.data.document_name,
        }),
      );
      setImportConfirmDocumentId(docId);
      setPolicyFormInitialStep("review");
      setPolicyPath("scratch");
    } catch (error: unknown) {
      endImportAnalyzing();
      const message =
        error instanceof Error ? error.message : "Unable to analyze this document.";
      await showAlert(
        /timeout/i.test(message)
          ? "Analysis took too long. Try again with a smaller file."
          : message,
        { title: "Import policy" },
      );
    }
  };

  const importSelectedDocument = folderDocumentsList.find(
    (item) => String(item.id) === importDocumentId,
  );

  return (
    <>
      {policyPath === "scratch" ? (
        <PolicyForm
          form={policyForm}
          setForm={setPolicyForm}
          types={types.data ?? []}
          documents={documents.data ?? []}
          targets={targets.data}
          pending={createPolicy.isPending}
          submitError={policySubmitError}
          organizationalMode
          initialStep={policyFormInitialStep}
          reviewMeta={policyReviewMeta}
          importDocumentId={importConfirmDocumentId}
          onClose={() => {
            resetReviewState();
            closeAll();
          }}
          onImportComplete={async () => {
            await policies.refetch();
            await showAlert(
              "Policy saved as draft and linked to the file.",
              { title: "Policy imported" },
            );
            closeAll();
          }}
          onSubmit={submitPolicy}
        />
      ) : null}
      {policyPath === "import" && importAnalyzing && importSelectedDocument ? (
        <ComplianceImportAnalyzeProgressModal
          document={importSelectedDocument}
          eyebrow="Import as policy"
          zIndex={110}
        />
      ) : null}
      {policyPath === "import" && !importAnalyzing ? (
        <ComplianceDocumentPickerModal
          title="Import existing document"
          eyebrow="Import as policy"
          description="Choose a file from this folder. AI will propose compliance fields for your review."
          documents={folderDocumentsList}
          loading={folderDocumentsLoading}
          selectedId={importDocumentId}
          onSelectedIdChange={setImportDocumentId}
          onClose={closeAll}
          onConfirm={() => void analyzeImport()}
          confirmLabel="Analyze and review"
          zIndex={110}
          showFolderName={false}
          emptyTitle="No files in this folder"
          emptyDescription="Upload or add a file to this folder first, then import it as a policy."
        />
      ) : null}
      {policyPath === "ai" ? (
        <ModalDialog
          title="Create with AI"
          eyebrow="New policy"
          description="AI proposes policy fields for review. Nothing is saved until you confirm."
          onClose={() => {
            if (!aiPending) closeAll();
          }}
          size="md"
          zIndex={110}
        >
          {aiPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
              <p className="text-sm font-semibold text-slate-700">
                Preparing proposal…
              </p>
            </div>
          ) : (
            <>
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
                  <ComplianceDocumentTypeMultiSelect
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
                  onClick={closeAll}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!aiName.trim()}
                  onClick={() => void runAiDraft()}
                >
                  Continue to review
                </button>
              </div>
            </>
          )}
        </ModalDialog>
      ) : null}
    </>
  );
}
