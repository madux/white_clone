"use client";

import { Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  useComplianceTargets,
  useCreateDocument,
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
  canImportDocumentAsPolicy,
  importPolicyBlockReason,
  policyDocumentFileName,
} from "../../../lib/policyDocumentName";
import { PolicyForm } from "./CompliancePage";
import ModalDialog from "./ModalDialog";
import PolicyTypeMultiSelect from "./PolicyTypeMultiSelect";
import ThemedSelect from "./ThemedSelect";

const AI_BRIEF_CHIPS = [
  { label: "Who it applies to", text: "Applies to all employees." },
  { label: "What's required", text: "Staff must complete the required documents." },
  { label: "When it starts", text: "Takes effect from the activation date." },
];

export type OrgPolicyCreatePath = "scratch" | "import" | "ai";

function defaultPolicyForm(policyTypeId: string) {
  return {
    name: "",
    description: "",
    policy_type_id: policyTypeId,
    document_type_ids: [] as number[],
    applies_to: "all",
    scope_ids: [] as number[],
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
  };
}

export default function OrganizationalCreatePolicyFlow({
  folderId,
  path,
  onClose,
  folderDocuments: folderDocumentsProp,
}: {
  folderId: number;
  path: OrgPolicyCreatePath;
  onClose: () => void;
  /** Same list as the folder table; avoids an empty import picker when cache lags. */
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
    folderDocumentsProp?.length
      ? folderDocumentsProp
      : fetchedFolderDocuments;
  const targets = useComplianceTargets();
  const createPolicy = useCreatePolicy();
  const createDocument = useCreateDocument();
  const policies = usePolicies();

  const [policyPath, setPolicyPath] = useState<OrgPolicyCreatePath | null>(path);
  const [policyForm, setPolicyForm] = useState(() =>
    defaultPolicyForm(""),
  );
  const [policySubmitError, setPolicySubmitError] = useState("");
  const [importDocumentId, setImportDocumentId] = useState("");
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
      const policyId = Number((created as { id?: number })?.id || 0);
      const typeId =
        policyForm.document_type_ids[0] || documents.data?.[0]?.id;
      if (policyId && typeId) {
        await createDocument.mutateAsync({
          name: policyDocumentFileName(policyForm.name),
          folder_id: folderId,
          document_type_id: typeId,
          is_policy: true,
          linked_policy_id: policyId,
        });
      }
      await showAlert("Policy created.", { title: "Policy created" });
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
      if (!result.success) {
        await showAlert(result.message || "Unable to draft this policy.", {
          title: "Create with AI",
        });
        return;
      }
      const policyId = Number(result.data?.policy_id || 0);
      const typeId = aiDocumentTypeIds[0] || documents.data?.[0]?.id;
      if (policyId && typeId) {
        await createDocument.mutateAsync({
          name: policyDocumentFileName(title),
          folder_id: folderId,
          document_type_id: typeId,
          is_policy: true,
          linked_policy_id: policyId,
        });
      }
      await policies.refetch();
      await showAlert(
        "Draft policy created. Activate it in Compliance when ready.",
        { title: "Draft created" },
      );
      closeAll();
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

  const folderDocOptions = folderDocumentsList.filter(canImportDocumentAsPolicy);

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
          onClose={closeAll}
          onSubmit={submitPolicy}
        />
      ) : null}
      {policyPath === "import" ? (
        <ModalDialog
          title="Import existing document"
          eyebrow="Import as policy"
          description="Choose a file already in this folder to register as a compliance policy."
          onClose={closeAll}
          size="md"
          zIndex={110}
        >
          {folderDocumentsLoading && !folderDocumentsList.length ? (
            <p className="text-sm text-slate-500">Loading documents…</p>
          ) : folderDocumentsList.length === 0 ? (
            <p className="text-sm text-slate-600">
              Upload or add a file to this folder first, then import it as a
              policy.
            </p>
          ) : (
            <>
              {folderDocOptions.length === 0 ? (
                <p className="mb-3 text-sm text-amber-800">
                  Files in this folder are already policy documents. Upload a
                  regular document (not created via Create policy) to import it
                  here.
                </p>
              ) : null}
              <ul
                className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2"
                role="listbox"
                aria-label="Documents in this folder"
              >
                {folderDocumentsList.map((item) => {
                  const blockReason = importPolicyBlockReason(item);
                  const importable = !blockReason;
                  const selected =
                    importable && importDocumentId === String(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={!importable}
                        title={blockReason ?? undefined}
                        onClick={() => {
                          if (!importable) return;
                          setImportDocumentId(String(item.id));
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? "bg-pink-50 font-semibold text-brand-pink"
                            : importable
                              ? "text-slate-700 hover:bg-slate-50"
                              : "text-slate-400"
                        }`}
                      >
                        <span className="block truncate">{item.name}</span>
                        {blockReason ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">
                            {blockReason}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="secondary-button" onClick={closeAll}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!importDocumentId}
              onClick={() =>
                void (async () => {
                  const result = await api.importOrganizationalPolicy(
                    Number(importDocumentId),
                  );
                  if (!result.success) {
                    await showAlert(result.message || "Unable to import.", {
                      title: "Import policy",
                    });
                    return;
                  }
                  await showAlert(
                    "The file is now linked as a policy in Compliance.",
                    { title: "Policy imported" },
                  );
                  closeAll();
                })()
              }
            >
              Import as policy
            </button>
          </div>
        </ModalDialog>
      ) : null}
      {policyPath === "ai" ? (
        <ModalDialog
          title="Create with AI"
          eyebrow="New policy"
          description="Creates a draft compliance policy and a placeholder policy file in this folder."
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
                Drafting policy…
              </p>
              <p className="text-xs text-muted-foreground">
                This can take a little while. Keep this window open.
              </p>
            </div>
          ) : (
            <>
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                AI writes a short description and saves this as a{" "}
                <strong>Draft</strong> in Compliance. Activate it when it looks
                right.
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
                  Generate draft
                </button>
              </div>
            </>
          )}
        </ModalDialog>
      ) : null}
    </>
  );
}
