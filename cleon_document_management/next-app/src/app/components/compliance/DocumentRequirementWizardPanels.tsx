"use client";

import { GripVertical, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  changePolicyFormType,
  type PolicyCreateFormState,
} from "../../../../lib/policyCreateForm";
import {
  dedupeDocumentTypeIds,
  filterExpiryApplicableDocumentTypes,
} from "../../../../lib/complianceDocumentTypes";
import type { PolicyDocumentPickerVariant } from "../../../../lib/policyDocumentPicker";
import type { DocumentType } from "../../../../lib/types";
import { EVENT_TRIGGER_LABELS } from "../../../../lib/complianceCopy";
import { graceDaysFromForm } from "../../../../lib/policyGraceAndNonCompliance";
import {
  PolicyWizardGraceAndNonComplianceFields,
  previewNonComplianceDate,
} from "./PolicyWizardGraceAndNonComplianceFields";
import {
  DOCUMENTS_TO_VERIFY_HELP,
  pruneVerificationDocumentTypeIds,
} from "../../../../lib/policyVerification";
import {
  VERIFIED_BY_LABELS,
  approverHandoffTypes,
} from "../../../../lib/verificationPolicy";
import { PolicyVerificationDocumentTypePicker } from "./PolicyVerificationDocumentTypePicker";
import {
  buildScopePayload,
  type PolicyScopeTargets,
} from "../../../../lib/policyScope";
import ComplianceDocumentTypeMultiSelect from "../ComplianceDocumentTypeMultiSelect";
import ModalDialog from "../ModalDialog";
import { PolicyAudienceFilters } from "../PolicyAudienceFilters";
import ThemedSelect from "../ThemedSelect";
import ApproverHandoffNotice from "../ApproverHandoffNotice";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";
import { WizardSectionHeader } from "./WizardSectionHeader";
import {
  PolicyWizardAudienceSection,
  PolicyWizardBasicsSection,
  PolicyWizardTimingSection,
} from "./PolicyWizardGenericPanels";
import type { PolicyWizardFieldId } from "../../../../lib/policyWizardFieldErrors";
import {
  PolicyWizardField,
  PolicyWizardHint,
  PolicyWizardSectionError,
} from "./PolicyWizardField";
import VerificationSlaContactPicker from "./VerificationSlaContactPicker";

function formatShortDate(iso: string) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function addCalendarDays(iso: string, days: number) {
  const base = iso ? new Date(`${iso}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  base.setDate(base.getDate() + days);
  return base;
}

type PanelProps = {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  entityName: "rule" | "policy";
  types: { id: number; name: string; code?: string }[];
  documentTypes: DocumentType[];
  selectableDocumentTypes: DocumentType[];
  targets?: PolicyScopeTargets;
  formError?: string;
};

export function DocumentRequirementBasicsPanel({
  form,
  setForm,
  entityName,
  types,
  documentTypes,
  fieldErrors = {},
  onFieldEdit,
  onPolicyTypeChange,
}: Pick<
  PanelProps,
  "form" | "setForm" | "entityName" | "types" | "documentTypes"
> & {
  fieldErrors?: Partial<Record<PolicyWizardFieldId, string>>;
  onFieldEdit?: (id: PolicyWizardFieldId) => void;
  onPolicyTypeChange?: (newTypeId: string) => void;
}) {
  const cap = entityName === "policy" ? "Policy" : "Rule";
  return (
    <PolicyWizardBasicsSection>
      <PolicyWizardField label={`${cap} name`} error={fieldErrors.name}>
        <input
          required
          className="field"
          value={form.name}
          onChange={(e) => {
            setForm({ ...form, name: e.target.value });
            onFieldEdit?.("name");
          }}
        />
      </PolicyWizardField>
      <PolicyWizardField label={`${cap} type`} error={fieldErrors.policy_type_id}>
        <ThemedSelect
          value={form.policy_type_id}
          onChange={(value) => {
            if (onPolicyTypeChange) {
              onPolicyTypeChange(value);
            } else {
              setForm(changePolicyFormType(form, value));
            }
            onFieldEdit?.("policy_type_id");
          }}
          placeholder="Select type"
          options={types.map((item) => ({
            value: String(item.id),
            label: item.name,
          }))}
        />
      </PolicyWizardField>
      <PolicyWizardField label="Description" full>
        <textarea
          rows={3}
          className="field min-h-[4.5rem]"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional context for HR and employees"
        />
      </PolicyWizardField>
    </PolicyWizardBasicsSection>
  );
}

type RequiredDocumentsPanelVariant = PolicyDocumentPickerVariant;

const REQUIRED_DOCUMENTS_COPY: Record<
  RequiredDocumentsPanelVariant,
  {
    letter: string;
    title: string;
    description: string;
    modalEyebrow: string;
    modalDescription: string;
    listSubtitle: string;
  }
> = {
  document_requirement: {
    letter: "A",
    title: "Required documents",
    description:
      "Specify the exact compliance certificates, permits, or proofs required from the target audience.",
    modalEyebrow: "Required documents",
    modalDescription:
      "Choose which document types employees must provide for this rule.",
    listSubtitle: "Required for compliance under this rule",
  },
  renewable_document: {
    letter: "",
    title: "Renewable document types",
    description:
      "Choose expiring document types this rule tracks. Employees must keep them current before they lapse.",
    modalEyebrow: "Renewable documents",
    modalDescription:
      "Only document types with expiry tracking are listed. You can create new expiry-enabled types here.",
    listSubtitle: "Monitored for expiry and renewal",
  },
  retention: {
    letter: "A",
    title: "Document types",
    description:
      "Only document types with complete retention rules in Settings can be added.",
    modalEyebrow: "Document types",
    modalDescription:
      "Choose from document types that already have retention configured under Settings → Retention Settings.",
    listSubtitle: "Included in this retention policy",
  },
};

export function DocumentRequirementDocumentsPanel({
  form,
  setForm,
  selectableDocumentTypes,
  documentTypeError,
  onDocumentTypesChange,
  variant = "document_requirement",
  expiryTypesOnly = false,
}: Pick<PanelProps, "form" | "setForm" | "selectableDocumentTypes"> & {
  documentTypeError?: string;
  onDocumentTypesChange?: () => void;
  variant?: RequiredDocumentsPanelVariant;
  expiryTypesOnly?: boolean;
}) {
  const copy = REQUIRED_DOCUMENTS_COPY[variant];
  const [pickerOpen, setPickerOpen] = useState(false);
  const typesForPicker = useMemo(
    () =>
      expiryTypesOnly
        ? filterExpiryApplicableDocumentTypes(selectableDocumentTypes)
        : selectableDocumentTypes,
    [expiryTypesOnly, selectableDocumentTypes],
  );
  const selectedIds = useMemo(
    () => dedupeDocumentTypeIds(form.document_type_ids),
    [form.document_type_ids],
  );
  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) =>
          typesForPicker.find((type) => Number(type.id) === id),
        )
        .filter(Boolean) as DocumentType[],
    [selectedIds, typesForPicker],
  );

  const removeId = (id: number) => {
    const normalized = Number(id);
    const ids = form.document_type_ids.filter(
      (item) => Number(item) !== normalized,
    );
    setForm({
      ...form,
      document_type_ids: ids,
      verification_document_type_ids: pruneVerificationDocumentTypeIds(
        ids,
        form.verification_document_type_ids,
      ),
    });
    onDocumentTypesChange?.();
  };

  return (
    <div className="space-y-4">
      <WizardSectionHeader
        letter={copy.letter}
        title={copy.title}
        badgeCount={selectedItems.length || undefined}
        description={copy.description}
        action={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3.5 py-2 text-xs font-semibold text-brand-pink hover:bg-pink-100"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {variant === "retention" ? "Add" : "Add document"}
          </button>
        }
      />

      {pickerOpen && typeof document !== "undefined"
        ? createPortal(
            <ModalDialog
              title="Select document types"
              eyebrow={copy.modalEyebrow}
              description={copy.modalDescription}
              onClose={() => setPickerOpen(false)}
              size="lg"
              footer={
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="app-btn app-btn-primary"
                    onClick={() => setPickerOpen(false)}
                  >
                    Done
                  </button>
                </div>
              }
            >
              <ComplianceDocumentTypeMultiSelect
                presentation="panel"
                listMaxHeightClassName="max-h-[min(24rem,50vh)]"
                types={typesForPicker}
                selected={selectedIds}
                onChange={(document_type_ids) => {
                  const ids = dedupeDocumentTypeIds(document_type_ids);
                  setForm({
                    ...form,
                    document_type_ids: ids,
                    verification_document_type_ids:
                      pruneVerificationDocumentTypeIds(
                        ids,
                        form.verification_document_type_ids,
                      ),
                  });
                  onDocumentTypesChange?.();
                }}
                error={documentTypeError}
                placeholder="Search and select document types"
                expiryTypesOnly={expiryTypesOnly}
              />
            </ModalDialog>,
            document.body,
          )
        : null}

      <div
        className={`overflow-hidden rounded-2xl border ${
          documentTypeError ? "border-red-300" : "border-slate-200"
        }`}
      >
        {selectedItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">
            No documents selected yet. Use{" "}
            <span className="font-semibold text-brand-pink">Add document</span>{" "}
            to choose required types.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {selectedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <GripVertical
                  className="h-4 w-4 shrink-0 text-slate-300"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{copy.listSubtitle}</p>
                </div>
                <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-pink">
                  Required
                </span>
                <button
                  type="button"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => removeId(item.id)}
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PolicyWizardSectionError error={documentTypeError} />
    </div>
  );
}

export function DocumentRequirementAudiencePanel({
  form,
  setForm,
  targets,
  audienceError,
  onAudienceChange,
}: Pick<PanelProps, "form" | "setForm" | "targets"> & {
  audienceError?: string;
  onAudienceChange?: () => void;
}) {
  return (
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
          onAudienceChange?.();
        }}
      />
      <PolicyWizardSectionError error={audienceError} className="mt-2" />
    </PolicyWizardAudienceSection>
  );
}

const TRIGGER_OPTIONS = Object.entries(EVENT_TRIGGER_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function DocumentRequirementTimingPanel({
  form,
  setForm,
  fieldErrors = {},
  onFieldEdit,
}: Pick<PanelProps, "form" | "setForm"> & {
  fieldErrors?: Partial<Record<PolicyWizardFieldId, string>>;
  onFieldEdit?: (id: PolicyWizardFieldId) => void;
}) {
  const dueDays = Math.max(0, Number(form.due_days) || 0);
  const graceDays = graceDaysFromForm(
    form.grace_period_enabled,
    form.grace_period_days,
  );
  const assigned = form.effective_date;
  const dueDate = addCalendarDays(assigned, dueDays);
  const nonCompliantPreview = previewNonComplianceDate(form, assigned, dueDays);

  const minimumMode =
    Number(form.minimum_documents) >= form.document_type_ids.length &&
    form.document_type_ids.length > 0
      ? "all"
      : "custom";

  return (
    <PolicyWizardTimingSection>
      <PolicyWizardField label="Trigger" className="sm:col-span-1">
        <ThemedSelect
          value={form.event_trigger || "onboarding"}
          onChange={(value) => setForm({ ...form, event_trigger: value })}
          options={TRIGGER_OPTIONS}
        />
      </PolicyWizardField>
      <PolicyWizardField label="Due within" className="sm:col-span-1">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="field"
            value={form.due_days}
            onChange={(e) =>
              setForm({ ...form, due_days: Number(e.target.value) || 0 })
            }
          />
          <PolicyWizardHint>days</PolicyWizardHint>
        </div>
      </PolicyWizardField>
      <PolicyWizardGraceAndNonComplianceFields
        form={form}
        setForm={setForm}
        fieldErrors={fieldErrors}
        onFieldEdit={onFieldEdit}
      />
      <PolicyWizardField label="Documents needed">
        <ThemedSelect
          value={minimumMode}
          onChange={(value) => {
            if (value === "all") {
              setForm({
                ...form,
                minimum_documents: String(
                  Math.max(1, form.document_type_ids.length),
                ),
              });
            }
          }}
          options={[
            { value: "all", label: "All required documents" },
            {
              value: "custom",
              label: `Minimum count (${form.minimum_documents})`,
            },
          ]}
        />
      </PolicyWizardField>
      <PolicyWizardField label="Reminders">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            className="field"
            value={form.reminder_frequency_days}
            onChange={(e) =>
              setForm({
                ...form,
                reminder_frequency_days: Math.max(
                  1,
                  Number(e.target.value) || 1,
                ),
              })
            }
          />
          <PolicyWizardHint>days between</PolicyWizardHint>
        </div>
      </PolicyWizardField>
      <PolicyWizardField
        label="Effective date"
        full
        error={fieldErrors.effective_date}
      >
        <input
          required
          type="date"
          className="field max-w-xs"
          value={form.effective_date}
          onChange={(e) => {
            setForm({ ...form, effective_date: e.target.value });
            onFieldEdit?.("effective_date");
          }}
        />
      </PolicyWizardField>
      <label className="flex items-center gap-2 pb-1 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.allow_waiver}
          onChange={(e) =>
            setForm({ ...form, allow_waiver: e.target.checked })
          }
          className="h-4 w-4 rounded accent-pink-600"
        />
        Allow exceptions (waivers)
      </label>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <span className="inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          Assigned {formatShortDate(assigned)} → Due{" "}
          {formatShortDate(dueDate.toISOString().slice(0, 10))}
        </span>
        {form.grace_period_enabled && graceDays > 0 ? (
          <span className="inline-flex rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
            Grace {graceDays} days
          </span>
        ) : null}
        {nonCompliantPreview.dateIso ? (
          <span className="inline-flex rounded-full bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white">
            {nonCompliantPreview.label}{" "}
            {formatShortDate(nonCompliantPreview.dateIso)}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white">
            {nonCompliantPreview.label}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Grace does not move the due date. It only delays the non-compliant
        status.
      </p>
    </PolicyWizardTimingSection>
  );
}

export function PolicyWizardVerificationPanel({
  form,
  setForm,
  documentTypes,
  entityName,
  typeCode,
  sectionLetter = "",
}: Pick<PanelProps, "form" | "setForm" | "documentTypes" | "entityName"> & {
  typeCode: string;
  sectionLetter?: string;
}) {
  const handoffTypes = approverHandoffTypes(form, typeCode, documentTypes);
  const verificationIds = form.verification_document_type_ids ?? [];
  const verificationCount = verificationIds.length;

  return (
    <div className="space-y-4">
      <WizardSectionHeader
        letter={sectionLetter}
        title="Verification"
        description="Choose which required documents need manual verification and who verifies them."
      />
      <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
        <PolicyWizardField
          full
          wrapper="div"
          label={
            <span className="inline-flex items-center gap-2">
              <span>Documents to verify</span>
              <SettingsFieldHelp
                label="Documents to verify"
                text={DOCUMENTS_TO_VERIFY_HELP}
              />
            </span>
          }
        >
          <PolicyVerificationDocumentTypePicker
            documentTypes={documentTypes}
            requiredTypeIds={form.document_type_ids}
            verificationTypeIds={verificationIds}
            onChange={(verification_document_type_ids) =>
              setForm({ ...form, verification_document_type_ids })
            }
          />
          {verificationCount ? (
            <p className="mt-2 text-xs text-slate-500">
              {verificationCount} type(s) will route to the verifier after upload.
              Other required types can satisfy the rule without manual
              verification.
            </p>
          ) : null}
        </PolicyWizardField>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PolicyWizardField
            label="Verified by"
            className={verificationCount ? "" : "pointer-events-none opacity-60"}
          >
            <ThemedSelect
              value={form.verified_by}
              onChange={(value) => setForm({ ...form, verified_by: value })}
              disabled={!verificationCount}
              options={Object.entries(VERIFIED_BY_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </PolicyWizardField>
          <PolicyWizardField
            label="Verification SLA"
            full
            className={verificationCount ? "" : "pointer-events-none opacity-60"}
          >
            <div className="flex max-w-xs items-center gap-2">
              <input
                type="number"
                min={1}
                className="field"
                disabled={!verificationCount}
                value={form.verification_sla_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    verification_sla_days: Math.max(
                      1,
                      Number(e.target.value) || 3,
                    ),
                  })
                }
              />
              <PolicyWizardHint>working days</PolicyWizardHint>
            </div>
          </PolicyWizardField>
        </div>
        <PolicyWizardField
          full
          label="SLA alert contact"
          className={`mt-4 ${verificationCount ? "" : "opacity-60"}`}
        >
          <VerificationSlaContactPicker
            disabled={!verificationCount}
            value={{
              userId: form.verification_sla_escalation_user_id
                ? Number(form.verification_sla_escalation_user_id)
                : null,
              label: form.verification_sla_escalation_user_label || "",
            }}
            onChange={(next) =>
              setForm({
                ...form,
                verification_sla_escalation_user_id: next.userId
                  ? String(next.userId)
                  : "",
                verification_sla_escalation_user_label: next.label,
              })
            }
          />
        </PolicyWizardField>
        {verificationCount ? (
          <ApproverHandoffNotice
            types={handoffTypes}
            verifiedBy={form.verified_by}
            entityName={entityName}
            className="mt-4"
          />
        ) : null}
      </div>
    </div>
  );
}

export function DocumentRequirementVerificationPanel(
  props: Pick<PanelProps, "form" | "setForm" | "documentTypes" | "entityName">,
) {
  return (
    <PolicyWizardVerificationPanel
      {...props}
      typeCode="document_requirement"
      sectionLetter="E"
    />
  );
}
