"use client";

import type { PolicyCreateFormState } from "../../../../lib/policyCreateForm";
import {
  coerceNonComplianceMode,
  graceDaysFromForm,
  nonComplianceModeOptions,
} from "../../../../lib/policyGraceAndNonCompliance";
import type { PolicyWizardFieldId } from "../../../../lib/policyWizardFieldErrors";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";
import { PinkSwitch } from "../PinkSwitch";
import { PolicyWizardField, PolicyWizardHint } from "./PolicyWizardField";
import ThemedSelect from "../ThemedSelect";

type OverdueModeKey = "non_compliance_mode" | "review_overdue_mode";

type Props = {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  nonComplianceLabel?: string;
  modeKey?: OverdueModeKey;
  fieldErrors?: Partial<Record<PolicyWizardFieldId, string>>;
  onFieldEdit?: (id: PolicyWizardFieldId) => void;
};

export function PolicyWizardGraceAndNonComplianceFields({
  form,
  setForm,
  nonComplianceLabel = "Mark as non-compliant",
  modeKey = "non_compliance_mode",
  fieldErrors = {},
  onFieldEdit,
}: Props) {
  const graceEnabled = Boolean(form.grace_period_enabled);
  const mode = coerceNonComplianceMode(form[modeKey], graceEnabled);
  const modeOptions = nonComplianceModeOptions(graceEnabled)
    .filter((opt) => !opt.disabled)
    .map(({ value, label }) => ({ value, label }));

  const setGraceEnabled = (enabled: boolean) => {
    const nextMode = coerceNonComplianceMode(form[modeKey], enabled);
    setForm({
      ...form,
      grace_period_enabled: enabled,
      [modeKey]: nextMode,
      grace_period_days: enabled
        ? String(Math.max(1, Number(form.grace_period_days) || 1))
        : "0",
    });
    onFieldEdit?.("grace_period_days");
  };

  return (
    <>
      <PolicyWizardField
        className="sm:col-span-2"
        wrapper="div"
        error={fieldErrors.grace_period_days}
        label={
          <span className="inline-flex items-center gap-2">
            <span>Grace period</span>
            <SettingsFieldHelp
              label="Grace period"
              text="Allow extra time after the due date."
            />
            <PinkSwitch
              checked={graceEnabled}
              onCheckedChange={setGraceEnabled}
              label="Grace period"
              size="sm"
            />
          </span>
        }
      >
        {graceEnabled ? (
          <div className="mt-1 flex max-w-xs items-center gap-2">
            <input
              type="number"
              min={1}
              required
              className="field"
              value={form.grace_period_days}
              onChange={(e) => {
                setForm({ ...form, grace_period_days: e.target.value });
                onFieldEdit?.("grace_period_days");
              }}
            />
            <PolicyWizardHint>days</PolicyWizardHint>
          </div>
        ) : null}
      </PolicyWizardField>
      <PolicyWizardField label={nonComplianceLabel}>
        <ThemedSelect
          value={mode}
          onChange={(value: string) => {
            if (value === "after_grace" && !graceEnabled) {
              return;
            }
            setForm({
              ...form,
              [modeKey]: value,
            });
          }}
          options={modeOptions}
        />
      </PolicyWizardField>
    </>
  );
}

export function previewNonComplianceDate(
  form: PolicyCreateFormState,
  dueAnchorIso: string,
  dueDays: number,
): { label: string; dateIso: string | null } {
  const assigned = dueAnchorIso;
  const dueDate = addDays(assigned, dueDays);
  const graceDays = graceDaysFromForm(
    form.grace_period_enabled,
    form.grace_period_days,
  );
  const mode = coerceNonComplianceMode(
    form.non_compliance_mode,
    form.grace_period_enabled,
  );
  if (mode === "never") {
    return { label: "No automatic non-compliance", dateIso: null };
  }
  if (mode === "after_due") {
    return { label: "Non-compliant from", dateIso: dueDate };
  }
  return {
    label: "Non-compliant from",
    dateIso: addDays(dueDate, graceDays),
  };
}

function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}
