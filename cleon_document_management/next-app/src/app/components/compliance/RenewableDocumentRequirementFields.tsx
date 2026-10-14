"use client";

import type { PolicyCreateFormState } from "../../../../lib/policyCreateForm";
import { AlertCadenceSelector } from "./AlertCadenceSelector";
import ThemedSelect from "../ThemedSelect";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";
import { PinkSwitchRow } from "../PinkSwitch";
import type { PolicyWizardFieldId } from "../../../../lib/policyWizardFieldErrors";
import { PolicyWizardField } from "./PolicyWizardField";
const AUTO_REQUEST_RENEWAL_HELP =
  "When on, the employee gets a to-do (activity) when a renewal reminder day hits from your alert schedule, and again if a required document is already expired when compliance runs. Reminder emails still send when this is off; this only controls the to-do.";

type Props = {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  layout?: "wizard" | "grid";
};

const DEFAULT_EFFECTIVE_DATE_HELP =
  "The rule starts checking employees and sending renewal reminders on or after this date. Evaluation runs when documents change, when you run the rule manually, or from daily renewal jobs—not on a recurring compliance schedule.";

export function RenewableEffectiveDateField({
  form,
  setForm,
  fieldErrors = {},
  onFieldEdit,
  full = true,
  helpText = DEFAULT_EFFECTIVE_DATE_HELP,
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  fieldErrors?: Partial<Record<PolicyWizardFieldId, string>>;
  onFieldEdit?: (id: PolicyWizardFieldId) => void;
  full?: boolean;
  helpText?: string;
}) {
  return (
    <PolicyWizardField
      label="Effective date"
      full={full}
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
      {helpText ? (
        <p className="mt-2 text-xs text-slate-500">{helpText}</p>
      ) : null}
    </PolicyWizardField>
  );
}

export function RenewableDocumentRequirementFields({
  form,
  setForm,
  layout = "wizard",
}: Props) {
  const cadenceClass = layout === "wizard" ? "sm:col-span-2" : "";
  const renewalClass = layout === "wizard" ? "sm:col-span-2" : "sm:col-span-2";

  return (
    <>
      <div className={cadenceClass}>
        <AlertCadenceSelector
          value={form.alert_schedule_days}
          onChange={(val) => setForm({ ...form, alert_schedule_days: val })}
        />
      </div>
      <PolicyWizardField label="Also notify HR">
        <ThemedSelect
          value={String(form.escalate_hr_days)}
          onChange={(val) =>
            setForm({ ...form, escalate_hr_days: Number(val) })
          }
          options={[
            { value: "15", label: "15 days before expiry" },
            { value: "7", label: "7 days before expiry" },
            { value: "3", label: "3 days before expiry" },
            { value: "1", label: "1 day before expiry" },
            { value: "0", label: "On expiry day" },
          ]}
        />
      </PolicyWizardField>
      <div className={renewalClass}>
        <PinkSwitchRow
          className="rounded-xl border border-slate-200 bg-white px-3 py-3"
          label={
            <span className="inline-flex items-center gap-2 text-sm text-slate-800">
              <span>Create renewal task for the employee</span>
              <SettingsFieldHelp
                label="Create renewal task for the employee"
                text={AUTO_REQUEST_RENEWAL_HELP}
              />
            </span>
          }
          description="To-do on reminder days and when a document is expired"
          checked={form.auto_request_renewal}
          onCheckedChange={(auto_request_renewal) =>
            setForm({ ...form, auto_request_renewal })
          }
        />
      </div>
    </>
  );
}
