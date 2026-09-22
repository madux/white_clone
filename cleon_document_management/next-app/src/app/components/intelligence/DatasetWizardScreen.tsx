"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useIntelligenceDataset,
  useIntelligenceTypes,
  useIntelligenceWizardEstimate,
  useIntelligenceWizardOptions,
  useRemoveIntelligenceUpload,
  useRunIntelligenceDataset,
  useSaveIntelligenceDataset,
  useUploadIntelligenceFiles,
} from "../../../../hooks/useIntelligence";
import { useRouter, useSearchParams } from "next/navigation";
import type { IntelligenceDocumentType } from "../../../../lib/intelligence-api";
import RepositoryStep from "./wizard/RepositoryStep";
import ScopeStep from "./wizard/ScopeStep";
import UploadFilesStep from "./wizard/UploadFilesStep";
import DocumentTypesStep from "./wizard/DocumentTypesStep";
import ValidationStep from "./wizard/ValidationStep";
import PreviewStep from "./wizard/PreviewStep";

const STEPS = [
  "Repository",
  "Scope",
  "Document types",
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
    | "company"
    | "selected_files";
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
  fields: [],
  scopeIds: [],
  confidencePreset: "balanced",
  ocrFallback: true,
  deduplicate: true,
  masking: true,
  auditLogging: true,
};

function fieldsForType(type?: IntelligenceDocumentType) {
  if (!type) return [];
  if (type.extraction_fields?.length) return type.extraction_fields;
  const profile = type.profile;
  if (profile && typeof profile === "object") return profile.fields || [];
  return [];
}

function fieldKeysForTypes(
  typeIds: number[],
  typeById: Map<number, IntelligenceDocumentType>,
) {
  return new Set(
    typeIds.flatMap((id) => fieldsForType(typeById.get(id)).map((field) => field.key)),
  );
}

function seedKeysForType(type?: IntelligenceDocumentType) {
  const fields = fieldsForType(type);
  const required = fields.filter((field) => field.required).map((field) => field.key);
  return required.length ? required : fields.map((field) => field.key);
}

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
  const wizardOptions = useIntelligenceWizardOptions();
  const existing = useIntelligenceDataset(datasetId);
  const saveDataset = useSaveIntelligenceDataset();
  const uploadFiles = useUploadIntelligenceFiles();
  const removeUpload = useRemoveIntelligenceUpload();
  const runDataset = useRunIntelligenceDataset();
  const busy =
    saveDataset.isPending ||
    runDataset.isPending ||
    uploadFiles.isPending ||
    removeUpload.isPending;
  const [uploads, setUploads] = useState<
    Array<{ id: number; name: string; mimetype: string; file_size: number }>
  >([]);
  const [uploadError, setUploadError] = useState("");
  const [hydrated, setHydrated] = useState(!datasetId);

  useEffect(() => {
    if (!existing.data) return;
    const item = existing.data;
    setDatasetPk(item.id);
    setStep(Math.min(item.wizard_step || 0, 4));
    setDraft({
      name: item.name === "Untitled draft" ? "" : item.name,
      source: (item.source as Draft["source"]) || "",
      processingMode: (item.processing_mode as Draft["processingMode"]) || "balanced",
      scopeKind:
        item.source === "organizational"
          ? "selected_files"
          : (item.scope_kind as Draft["scopeKind"]) || "company",
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
    setUploads(item.uploads || []);
    setHydrated(true);
  }, [existing.data]);

  const typeById = useMemo(
    () => new Map((types.data || []).map((item) => [item.id, item])),
    [types.data],
  );

  useEffect(() => {
    if (!hydrated || !types.data) return;
    setDraft((current) => {
      if (current.documentTypes.some((id) => !typeById.has(id))) return current;
      const allowed = fieldKeysForTypes(current.documentTypes, typeById);
      const next = current.fields.filter((key) => allowed.has(key));
      if (next.join() === current.fields.join()) return current;
      return { ...current, fields: next };
    });
  }, [draft.documentTypes, hydrated, typeById, types.data]);

  const selectedTypeNames = (types.data || [])
    .filter((item) => draft.documentTypes.includes(item.id))
    .map((item) => item.name);

  const thresholds = CONFIDENCE[draft.confidencePreset];
  const estimate = useIntelligenceWizardEstimate({
    id: datasetPk,
    source: draft.source,
    scope_kind:
      draft.source === "organizational" ? "selected_files" : draft.scopeKind,
    scope_ids:
      draft.source === "employee" || draft.source === "organizational"
        ? draft.scopeIds
        : [],
    document_type_ids: [],
    auto_classify: true,
    upload_count: uploads.length,
    processing_mode: draft.processingMode,
  });

  const scopedTypeIds = estimate.data?.document_type_ids;

  useEffect(() => {
    if (!Array.isArray(scopedTypeIds)) return;
    const allowed = new Set(scopedTypeIds);
    setDraft((current) => {
      const next = current.documentTypes.filter((id) => allowed.has(id));
      if (next.length === current.documentTypes.length) return current;
      return { ...current, documentTypes: next };
    });
  }, [scopedTypeIds]);

  const stepError = useMemo(() => {
    if (step === 0 && !draft.source) return "Choose a repository source.";
    if (step === 0 && draft.source === "external") {
      return "External connectors are not available in this application yet.";
    }
    if (step === 1 && draft.source === "upload" && uploads.length === 0) {
      return "Upload at least one file.";
    }
    if (
      step === 1 &&
      draft.source === "organizational" &&
      draft.scopeIds.length === 0
    ) {
      return "Open a folder and select at least one file.";
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
    if (step === 2 && !draft.autoClassify && draft.fields.length === 0) {
      return "Open a selected type and choose at least one field to extract.";
    }
    if (step === 4 && draft.source === "organizational" && draft.scopeIds.length === 0) {
      return "Open a folder and select at least one file.";
    }
    if (step === 4 && !draft.name.trim()) return "Give the dataset a name.";
    if (step === 4 && draft.documentTypes.length === 0 && !draft.autoClassify) {
      return "A dataset cannot run with zero document types.";
    }
    if (step === 4 && !draft.autoClassify && draft.fields.length === 0) {
      return "A dataset cannot run with zero fields.";
    }
    return "";
  }, [draft, step, uploads.length]);

  const toPayload = (forRun = false) => ({
    id: datasetPk,
    name: draft.name.trim(),
    source: draft.source || false,
    processing_mode: draft.processingMode,
    scope_kind:
      draft.source === "organizational" ? "selected_files" : draft.scopeKind,
    scope_ids: draft.scopeIds,
    auto_classify: draft.autoClassify,
    document_type_ids: draft.documentTypes,
    field_keys: draft.fields,
    confidence_preset: draft.confidencePreset,
    ocr_fallback: draft.ocrFallback,
    deduplicate: draft.deduplicate,
    masking: draft.masking,
    audit_logging: draft.auditLogging,
    wizard_step: forRun ? 4 : step,
  });

  const ensureDraft = async () => {
    if (datasetPk) {
      return datasetPk;
    }
    const saved = await saveDataset.mutateAsync({
      ...toPayload(),
      source: "upload",
      wizard_step: 1,
    });
    setDatasetPk(saved.id);
    setUploads(saved.uploads || []);
    router.replace(`/pages/document-intelligence/datasets/new?id=${saved.id}`);
    return saved.id;
  };

  const addUploadFiles = async (files: File[]) => {
    setUploadError("");
    try {
      const id = await ensureDraft();
      const saved = await uploadFiles.mutateAsync({ id, files });
      setDatasetPk(saved.id);
      setUploads(saved.uploads || []);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const dropUpload = async (documentId: number) => {
    if (!datasetPk) return;
    setUploadError("");
    try {
      const saved = await removeUpload.mutateAsync({
        id: datasetPk,
        documentId,
      });
      setUploads(saved.uploads || []);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not remove the file.");
    }
  };

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
      await runDataset.mutateAsync(toPayload(true));
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
          Five steps. Choose Employee Files, Organizational Files, or upload from
          your computer. Continue saves a draft so you can leave and come back.
        </p>
      </section>

      <ol className="grid gap-2 sm:grid-cols-5">
        {STEPS.map((label, index) => (
          <li
            key={index}
            className={`rounded-xl border px-3 py-2 text-xs font-bold ${
              index === step
                ? "border-brand-pink bg-pink-50 text-brand-text"
                : index < step
                  ? "border-slate-200 bg-white text-slate-700"
                  : "border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            {index + 1}.{" "}
            {index === 1 && draft.source === "upload" ? "Upload files" : label}
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
            loading={wizardOptions.isLoading}
            error={wizardOptions.isError}
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
                scopeKind:
                  value === "organizational" ? "selected_files" : draft.scopeKind,
                scopeIds: value === draft.source ? draft.scopeIds : [],
              })
            }
            onMode={(value) => setDraft({ ...draft, processingMode: value })}
          />
        )}

        {step === 1 && draft.source === "upload" && (
          <UploadFilesStep
            files={uploads}
            busy={uploadFiles.isPending || saveDataset.isPending}
            error={uploadError}
            onAdd={(files) => void addUploadFiles(files)}
            onRemove={(id) => void dropUpload(id)}
          />
        )}

        {step === 1 && draft.source !== "upload" && (
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
            selectedKeys={draft.fields}
            allowedTypeIds={scopedTypeIds}
            untypedCount={estimate.data?.untyped_count || 0}
            loadingEstimate={
              draft.source !== "upload" &&
              estimate.isFetching &&
              !Array.isArray(scopedTypeIds)
            }
            onAutoClassify={(value) => setDraft({ ...draft, autoClassify: value })}
            onToggle={(id) => {
              setDraft((current) => {
                const type = typeById.get(id);
                if (current.documentTypes.includes(id)) {
                  const remaining = current.documentTypes.filter((item) => item !== id);
                  const allowed = fieldKeysForTypes(remaining, typeById);
                  return {
                    ...current,
                    documentTypes: remaining,
                    fields: current.fields.filter((key) => allowed.has(key)),
                  };
                }
                return {
                  ...current,
                  documentTypes: [...current.documentTypes, id],
                  fields: Array.from(
                    new Set([...current.fields, ...seedKeysForType(type)]),
                  ),
                };
              });
            }}
            onToggleField={(key) =>
              setDraft((current) => ({
                ...current,
                fields: current.fields.includes(key)
                  ? current.fields.filter((item) => item !== key)
                  : [...current.fields, key],
              }))
            }
            onSetTypeFields={(typeId, mode) => {
              const typeKeys = fieldsForType(typeById.get(typeId)).map(
                (field) => field.key,
              );
              setDraft((current) => {
                if (mode === "all") {
                  return {
                    ...current,
                    fields: Array.from(new Set([...current.fields, ...typeKeys])),
                  };
                }
                const drop = new Set(typeKeys);
                return {
                  ...current,
                  fields: current.fields.filter((key) => !drop.has(key)),
                };
              });
            }}
          />
        )}

        {step === 3 && (
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

        {step === 4 && (
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
            pageCount={estimate.data?.page_count}
            estimatedSeconds={estimate.data?.estimated_seconds}
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
