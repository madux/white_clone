"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useIntelligenceDataset,
  useIntelligenceProfiles,
  useIntelligenceTypes,
  useRunIntelligenceDataset,
  useSaveIntelligenceDataset,
} from "../../../../hooks/useIntelligence";
import { useRouter, useSearchParams } from "next/navigation";
import { formatFieldLabel } from "../../../../lib/formatLabel";

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
  const existing = useIntelligenceDataset(datasetId);
  const saveDataset = useSaveIntelligenceDataset();
  const runDataset = useRunIntelligenceDataset();
  const busy = saveDataset.isPending || runDataset.isPending;
  const [hydrated, setHydrated] = useState(!datasetId);

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

  const stepError = useMemo(() => {
    if (step === 0 && !draft.source) return "Choose a repository source.";
    if (step === 0 && draft.source === "external") {
      return "External connectors are not available in this application yet.";
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

  const goNext = () => {
    setAttempted(true);
    if (stepError) return;
    setAttempted(false);
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
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
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Repository</h2>
            {(
              [
                ["employee", "Employee Files"],
                ["organizational", "Organizational Files"],
                ["upload", "Direct upload"],
                ["external", "External source (unavailable)"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="source"
                  checked={draft.source === value}
                  onChange={() => setDraft({ ...draft, source: value })}
                />
                {label}
              </label>
            ))}
            <div>
              <p className="label">Processing mode</p>
              <select
                className="field"
                value={draft.processingMode}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    processingMode: event.target.value as Draft["processingMode"],
                  })
                }
              >
                <option value="fast">Fast</option>
                <option value="balanced">Balanced (recommended)</option>
                <option value="conservative">Conservative</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Scope</h2>
            <p className="text-sm text-slate-500">
              Scope is stored as structured filters and resolved on the server.
              The browser will not download every document to filter locally.
            </p>
            <select
              className="field"
              value={draft.scopeKind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  scopeKind: event.target.value as Draft["scopeKind"],
                })
              }
            >
              <option value="one_employee">One employee</option>
              <option value="multiple_employees">Multiple employees</option>
              <option value="department">Department</option>
              <option value="business_unit">Business unit</option>
              <option value="location">Location</option>
              <option value="grade">Grade</option>
              <option value="employment_type">Employment type</option>
              <option value="company">Entire company</option>
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Document types</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.autoClassify}
                onChange={(event) =>
                  setDraft({ ...draft, autoClassify: event.target.checked })
                }
              />
              Automatic classification on arrival
            </label>
            {types.isError ? (
              <p className="text-sm text-red-600">
                Document types could not be loaded from Odoo.
              </p>
            ) : null}
            {(types.data || [])
              .filter((item) => item.active)
              .map((item) => {
              const selected = draft.documentTypes.includes(item.id);
              return (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        documentTypes: selected
                          ? draft.documentTypes.filter((id) => id !== item.id)
                          : [...draft.documentTypes, item.id],
                      })
                    }
                  />
                  {item.name}
                </label>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Business fields</h2>
            {!catalog.length ? (
              <p className="text-sm text-slate-500">
                Select document types that have an extraction profile, or create a
                profile in Configuration.
              </p>
            ) : null}
            {catalog.map((field) => {
              const selected = draft.fields.includes(field.key);
              return (
                <label
                  key={field.key}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-3 text-sm"
                >
                  <span>
                    <span className="block font-semibold text-slate-900">
                      {field.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {field.field_type}
                      {field.required ? " · required" : ""} · {field.profile}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        fields: selected
                          ? draft.fields.filter((item) => item !== field.key)
                          : [...draft.fields, field.key],
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Validation rules</h2>
            <p className="text-sm text-slate-500">
              Auto-approve at {thresholds.autoApprove}% or above. Send to review
              below {thresholds.reviewBelow}%. Thresholds will be stored on the
              dataset so later setting changes do not rewrite this job.
            </p>
            <select
              className="field"
              value={draft.confidencePreset}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  confidencePreset: event.target.value as Draft["confidencePreset"],
                })
              }
            >
              <option value="relaxed">Relaxed — 75% / 40%</option>
              <option value="balanced">Balanced — 85% / 50%</option>
              <option value="strict">Strict — 92% / 65%</option>
            </select>
            {(
              [
                ["ocrFallback", "OCR fallback for unreadable PDFs"],
                ["deduplicate", "Deduplicate source documents"],
                ["masking", "Mask sensitive values on export"],
                ["auditLogging", "Audit logging"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Preview and run</h2>
            <label className="block">
              <span className="label">Dataset name</span>
              <input
                className="field"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder="Q3 employment contracts"
              />
            </label>
            <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <div>Source: {draft.source || "—"}</div>
              <div>Scope: {formatFieldLabel(draft.scopeKind)}</div>
              <div>Types: {selectedTypeNames.join(", ") || (draft.autoClassify ? "auto" : "none")}</div>
              <div>Fields: {draft.fields.length}</div>
              <div>Mode: {draft.processingMode}</div>
              <div>
                Thresholds: auto {thresholds.autoApprove}% / review{" "}
                {thresholds.reviewBelow}%
              </div>
              <div>Estimated documents: not available until the job resolver exists</div>
              <div>Estimated cost: omitted (provider does not expose a reliable estimate)</div>
            </dl>
          </div>
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
              className="inline-flex rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white"
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
              Run extraction
            </button>
          </>
        )}
      </div>
    </div>
  );
}
