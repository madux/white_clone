"use client";

import { formatFieldLabel } from "../../../lib/formatLabel";
import type { PolicyCreateFormState, PolicyReviewMeta } from "../../../lib/policyCreateForm";
import { validatePolicyCreateForm } from "../../../lib/policyCreateValidation";

type ComplianceRuleReviewScreenProps = {
  form: PolicyCreateFormState;
  typeName: string;
  typeCode: string;
  documentTypeNames: string[];
  scopeLabels: string[];
  reviewMeta?: PolicyReviewMeta;
  submitError?: string;
  pending?: boolean;
  confirmLabel?: string;
  /** Compliance engine uses "rule"; organisational policy flows use "policy". */
  entityName?: "rule" | "policy";
  onBack: () => void;
  onConfirm: () => void;
};

export default function ComplianceRuleReviewScreen({
  form,
  typeName,
  typeCode,
  documentTypeNames,
  scopeLabels,
  reviewMeta,
  submitError,
  pending,
  confirmLabel = "Confirm",
  entityName = "rule",
  onBack,
  onConfirm,
}: ComplianceRuleReviewScreenProps) {
  const validation = validatePolicyCreateForm(
    form,
    typeCode,
    reviewMeta,
    entityName,
  );
  const entity =
    entityName === "policy"
      ? { cap: "Policy", lower: "policy" }
      : { cap: "Rule", lower: "rule" };

  return (
    <div>
      {reviewMeta?.sourceDocumentName ? (
        <p className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Source file:{" "}
          <span className="font-semibold text-slate-800">
            {reviewMeta.sourceDocumentName}
          </span>
        </p>
      ) : null}
      {reviewMeta?.aiSuggested ? (
        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          AI-suggested values — review and edit before confirming. The {entity.lower} will
          be saved as a <strong>draft</strong> until you activate it in Compliance.
        </p>
      ) : (
        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Saved as a <strong>draft</strong> when you confirm. Activate it in
          Compliance when ready.
        </p>
      )}
      <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <ReviewRow label={`${entity.cap} name`} value={form.name || "—"} strong />
        <ReviewRow label={`${entity.cap} type`} value={typeName || "—"} />
        {form.description ? (
          <ReviewRow label="Description" value={form.description} multiline />
        ) : null}
        <ReviewRow
          label="Required document types"
          value={documentTypeNames.join(", ") || "—"}
          multiline
        />
        <ReviewRow label="Applies to" value={scopeLabels.join(", ") || "—"} />
        <ReviewRow
          label="Schedule"
          value={formatFieldLabel(form.schedule || "manual")}
        />
        <ReviewRow label="Effective date" value={form.effective_date || "—"} />
        <ReviewRow label="Minimum documents" value={form.minimum_documents} />
        <ReviewRow
          label="Grace period"
          value={`${form.grace_period_days} days`}
        />
      </dl>
      {validation.warnings.length ? (
        <ul className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {validation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {!validation.canConfirm && validation.missingFields.length ? (
        <ul className="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <li className="font-semibold">Complete before confirming:</li>
          {validation.missingFields.map((field) => (
            <li key={field}>• {field}</li>
          ))}
        </ul>
      ) : null}
      {submitError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {submitError}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={pending || !validation.canConfirm}
          onClick={onConfirm}
          className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  strong,
  multiline,
}: {
  label: string;
  value: string;
  strong?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 font-semibold text-slate-500">{label}</dt>
      <dd
        className={`text-right text-slate-700 ${strong ? "font-bold text-slate-800" : ""} ${multiline ? "max-w-[60%] whitespace-pre-wrap" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
