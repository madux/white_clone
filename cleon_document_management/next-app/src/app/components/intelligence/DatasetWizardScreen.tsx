"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useIntelligenceDataset,
  useIntelligenceProfiles,
  useIntelligenceTypes,
  useIntelligenceWizardEstimate,
  useIntelligenceWizardOptions,
  useRunIntelligenceDataset,
  useSaveIntelligenceDataset,
} from "../../../../hooks/useIntelligence";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../../lib/api";
import RepositoryStep from "./wizard/RepositoryStep";
import ScopeStep from "./wizard/ScopeStep";
import DocumentTypesStep from "./wizard/DocumentTypesStep";
import BusinessFieldsStep from "./wizard/BusinessFieldsStep";
import ValidationStep from "./wizard/ValidationStep";
import PreviewStep from "./wizard/PreviewStep";

const STEPS = [
  "Repository",
  "Scope",
  "Document types",
  "Business fields",
  "Validation rules",
  "Preview and run",
] as const;

const CONFIDENCE = {
  relaxed: { autoApprove: 75, reviewBelow: 40 },
  balanced: { autoApprove: 85, reviewBelow: 50 },
  strict: { autoApprove: 92, reviewBelow: 65 },
} as const;

type Draft = {
  name: string;
  source: "employee" | "organizational" | "upload" | "external" | "";
  processingMode: "fast" | "balanced" | "conservative";
  scopeKind:
    | "one_employee"
    | "multiple_employees"
    | "department"
    | "business_unit"
    | "location"
    | "grade"
    | "employment_type"
    | "company";
  autoClassify: boolean;
  documentTypes: number[];
  fields: string[];
  scopeIds: number[];
  confidencePreset: keyof typeof CONFIDENCE;
  ocrFallback: boolean;
  deduplicate: boolean;
  masking: boolean;
  auditLogging: boolean;
};

const INITIAL: Draft = {
  name: "",
  source: "",
  processingMode: "balanced",
  scopeKind: "company",
  autoClassify: false,
  documentTypes: [],
  fields: ["employee_name", "start_date"],
  scopeIds: [],
  confidencePreset: "balanced",
  ocrFallback: true,
  deduplicate: true,
  masking: true,
  auditLogging: true,
};

export default function DatasetWizardScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const datasetId = Number(searchParams.get("id") || 0) || undefined;
  const [step, setStep] = useState(0);
  const [datasetPk, setDatasetPk] = useState<number | undefined>(datasetId);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [attempted, setAttempted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const types = useIntelligenceTypes();
  const profiles = useIntelligenceProfiles();
  const wizardOptions = useIntelligenceWizardOptions();
  const existing = useIntelligenceDataset(datasetId);
  const saveDataset = useSaveIntelligenceDataset();
  const runDataset = useRunIntelligenceDataset();
  const busy = saveDataset.isPending || runDataset.isPending;
  const [hydrated, setHydrated] = useState(!datasetId);
  const isAdmin = Boolean(
    api.injectedUser()?.is_admin || api.injectedUser()?.is_document_manager,
  );

  useEffect(() => {
    if (!existing.data) return;
    const item = existing.data;
    setDatasetPk(item.id);
    setStep(Math.min(item.wizard_step || 0, 5));
    setDraft({
      name: item.name === "Untitled draft" ? "" : item.name,
      source: (item.source as Draft["source"]) || "",
      processingMode: (item.processing_mode as Draft["processingMode"]) || "balanced",
      scopeKind: (item.scope_kind as Draft["scopeKind"]) || "company",
      autoClassify: item.auto_classify,
      documentTypes: item.document_type_ids,
      fields: item.field_keys,
      scopeIds: item.scope_ids || [],
      confidencePreset: item.confidence_preset,
      ocrFallback: item.ocr_fallback,
      deduplicate: item.deduplicate,
      masking: item.masking,
      auditLogging: item.audit_logging,
    });
    setHydrated(true);
  }, [existing.data]);

  const catalog = useMemo(() => {
    const selectedTypes = new Set(draft.documentTypes);
    const selectedProfiles = (profiles.data || []).filter(
      (profile) =>
        profile.active &&
        (selectedTypes.size === 0 || selectedTypes.has(profile.document_type_id)),
    );
    const fields = selectedProfiles.flatMap((profile) =>
      profile.fields.map((field) => ({
        ...field,
        profile: `${profile.name} v${profile.version}`,
      })),
    );
    const unique = new Map(fields.map((field) => [field.key, field]));
    return Array.from(unique.values());
  }, [draft.documentTypes, profiles.data]);

  useEffect(() => {
    if (!hydrated || !catalog.length) return;
    setDraft((current) => {
      const allowed = new Set(catalog.map((field) => field.key));
      const next = current.fields.filter((key) => allowed.has(key));
      const seeded = next.length
        ? next
        : catalog.filter((field) => field.required).map((field) => field.key);
      if (seeded.join() === current.fields.join()) return current;
      return { ...current, fields: seeded };
    });
  }, [catalog, hydrated]);

  const selectedTypeNames = (types.data || [])
    .filter((item) => draft.documentTypes.includes(item.id))
    .map((item) => item.name);

  const thresholds = CONFIDENCE[draft.confidencePreset];
  const estimate = useIntelligenceWizardEstimate({
    source: draft.source,
    scope_kind: draft.source === "organizational" ? "company" : draft.scopeKind,
    scope_ids: draft.source === "employee" ? draft.scopeIds : [],
    document_type_ids: draft.documentTypes,
    auto_classify: draft.autoClassify,
  });

  const stepError = useMemo(() => {
    if (step === 0 && !draft.source) return "Choose a repository source.";
    if (step === 0 && draft.source === "external") {
      return "External connectors are not available in this application yet.";
    }
    if (step === 0 && draft.source === "upload") {
      return "Direct upload is not available yet. Choose Employee or Organizational Files.";
    }
    if (
      step === 1 &&
      draft.source === "employee" &&
      draft.scopeKind !== "company" &&
      draft.scopeIds.length === 0
    ) {
      return "Select who this dataset covers.";
    }
    if (step === 2 && !draft.autoClassify && draft.documentTypes.length === 0) {
      return "Select at least one document type, or enable automatic classification.";
    }
    if (step === 3 && draft.fields.length === 0) {
      return "Select at least one business field.";
    }
    if (step === 5 && !draft.name.trim()) return "Give the dataset a name.";
    if (step === 5 && draft.documentTypes.length === 0 && !draft.autoClassify) {
      return "A dataset cannot run with zero document types.";
    }
    if (step === 5 && draft.fields.length === 0) {
      return "A dataset cannot run with zero fields.";
    }
    return "";
  }, [draft, step]);

  const toPayload = (forRun = false) => ({
    id: datasetPk,
    name: draft.name.trim(),
    source: draft.source || false,
    processing_mode: draft.processingMode,
    scope_kind: draft.scopeKind,
    scope_ids: draft.scopeIds,
    auto_classify: draft.autoClassify,
    document_type_ids: draft.documentTypes,
    field_keys: draft.fields,
    confidence_preset: draft.confidencePreset,
    ocr_fallback: draft.ocrFallback,
    deduplicate: draft.deduplicate,
    masking: draft.masking,
    audit_logging: draft.auditLogging,
    wizard_step: forRun ? 5 : step,
  });

  const goNext = async () => {
    setAttempted(true);
    if (stepError) return;
    setAttempted(false);
    const nextStep = Math.min(step + 1, STEPS.length - 1);
    try {
      const saved = await saveDataset.mutateAsync({
        ...toPayload(),
        wizard_step: nextStep,
      });
      setDatasetPk(saved.id);
      if (!datasetId) {
        router.replace(`/pages/document-intelligence/datasets/new?id=${saved.id}`);
      }
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Could not save draft.");
      return;
    }
    setStep(nextStep);
  };

  const saveDraft = async () => {
    setBanner(null);
    try {
      const saved = await saveDataset.mutateAsync(toPayload());
      setDatasetPk(saved.id);
      if (!datasetId) {
        router.replace(`/pages/document-intelligence/datasets/new?id=${saved.id}`);
      }
      setBanner(`Draft saved as “${saved.name}”.`);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Could not save draft.");
    }
  };

  const runJob = async () => {
    setAttempted(true);
    if (stepError) return;
    setBanner(null);
    try {
      const saved = await runDataset.mutateAsync(toPayload(true));
      setDatasetPk(saved.id);
      setBanner(saved.message || "Dataset queued.");
      router.push("/pages/document-intelligence/datasets");
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Run was rejected.");
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
          New dataset
        </p>
        <h1 className="text-3xl font-medium text-slate-900">Extraction wizard</h1>
        <p className="max-w-2xl text-sm font-light text-slate-400">
          Six steps. Start by choosing Employee or Organizational Files, then who
          the job covers. Continue saves a draft so you can leave and come back.
        </p>
      </section>

      <ol className="grid gap-2 sm:grid-cols-6">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`rounded-xl border px-3 py-2 text-xs font-bold ${
              index === step
                ? "border-brand-pink bg-pink-50 text-brand-text"
                : index < step
                  ? "border-slate-200 bg-white text-slate-700"
                  : "border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {banner ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          {banner}
        </p>
      ) : null}

      {attempted && stepError ? (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {stepError}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        {step === 0 && (
          <RepositoryStep
            source={draft.source}
            processingMode={draft.processingMode}
            counts={
              wizardOptions.data?.sources || {
                employee: 0,
                organizational: 0,
                upload: 0,
                external: 0,
              }
            }
            onSource={(value) =>
              setDraft({
                ...draft,
                source: value,
                scopeKind: value === "organizational" ? "company" : draft.scopeKind,
                scopeIds: value === draft.source ? draft.scopeIds : [],
              })
            }
            onMode={(value) => setDraft({ ...draft, processingMode: value })}
          />
        )}

        {step === 1 && (
          <ScopeStep
            source={draft.source}
            scopeKind={draft.scopeKind}
            scopeIds={draft.scopeIds}
            options={{
              employees: wizardOptions.data?.employees || [],
              departments: wizardOptions.data?.departments || [],
              grades: wizardOptions.data?.grades || [],
              business_units: wizardOptions.data?.business_units || [],
              employment_types: wizardOptions.data?.employment_types || [],
              locations: wizardOptions.data?.locations || [],
            }}
            estimate={estimate.data}
            onKind={(value) => setDraft({ ...draft, scopeKind: value as Draft["scopeKind"], scopeIds: [] })}
            onIds={(value) => setDraft({ ...draft, scopeIds: value })}
          />
        )}

        {step === 2 && (
          <DocumentTypesStep
            types={types.data || []}
            loading={types.isLoading}
            error={types.isError}
            source={draft.source}
            autoClassify={draft.autoClassify}
            selectedIds={draft.documentTypes}
            isAdmin={isAdmin}
            onAutoClassify={(value) => setDraft({ ...draft, autoClassify: value })}
            onToggle={(id) =>
              setDraft({
                ...draft,
                documentTypes: draft.documentTypes.includes(id)
                  ? draft.documentTypes.filter((item) => item !== id)
                  : [...draft.documentTypes, id],
              })
            }
            onCreated={(type) =>
              setDraft((current) => ({
                ...current,
                documentTypes: current.documentTypes.includes(type.id)
                  ? current.documentTypes
                  : [...current.documentTypes, type.id],
              }))
            }
          />
        )}

        {step === 3 && (
          <BusinessFieldsStep
            catalog={catalog}
            selectedKeys={draft.fields}
            types={(() => {
              const selected = (types.data || []).filter(
                (item) =>
                  draft.documentTypes.includes(item.id) ||
                  (draft.autoClassify && item.active),
              );
              return selected.length
                ? selected
                : (types.data || []).filter((item) => item.active);
            })()}
            profiles={profiles.data || []}
            isAdmin={isAdmin}
            onChange={(keys) => setDraft({ ...draft, fields: keys })}
            onAddedField={(typeId, key) =>
              setDraft((current) => ({
                ...current,
                documentTypes: current.documentTypes.includes(typeId)
                  ? current.documentTypes
                  : [...current.documentTypes, typeId],
                fields: current.fields.includes(key)
                  ? current.fields
                  : [...current.fields, key],
              }))
            }
          />
        )}

        {step === 4 && (
          <ValidationStep
            confidencePreset={draft.confidencePreset}
            ocrFallback={draft.ocrFallback}
            deduplicate={draft.deduplicate}
            masking={draft.masking}
            auditLogging={draft.auditLogging}
            onPreset={(value) => setDraft({ ...draft, confidencePreset: value })}
            onFlag={(key, value) => setDraft({ ...draft, [key]: value })}
          />
        )}

        {step === 5 && (
          <PreviewStep
            name={draft.name}
            source={draft.source}
            scopeKind={draft.scopeKind}
            typeNames={selectedTypeNames}
            autoClassify={draft.autoClassify}
            fieldCount={draft.fields.length}
            processingMode={draft.processingMode}
            autoApprove={thresholds.autoApprove}
            reviewBelow={thresholds.reviewBelow}
            documentCount={estimate.data?.document_count}
            employeeCount={estimate.data?.employee_count}
            estimating={estimate.isFetching && !estimate.data}
            onName={(value) => setDraft({ ...draft, name: value })}
          />
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/pages/document-intelligence/datasets"
          className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
        >
          Cancel
        </Link>
        {step > 0 ? (
          <button
            type="button"
            className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={() => {
              setAttempted(false);
              setStep((value) => value - 1);
            }}
          >
            Back
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="inline-flex rounded-full border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink disabled:opacity-50"
              onClick={saveDraft}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={goNext}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              className="inline-flex rounded-full border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink disabled:opacity-50"
              onClick={saveDraft}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={runJob}
            >
              Save and run extraction
            </button>
          </>
        )}
      </div>
    </div>
  );
}
