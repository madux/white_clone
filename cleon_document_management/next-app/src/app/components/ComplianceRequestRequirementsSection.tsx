"use client";

import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import type { DocumentType } from "../../../lib/types";
import type { ComplianceLinkableContext } from "../../../lib/complianceRequestTasks";
import ComplianceRequestScheduleFields from "./ComplianceRequestScheduleFields";
import { PolicyWizardGraceAndNonComplianceFields } from "./compliance/PolicyWizardGraceAndNonComplianceFields";
import ComplianceRequestTaskList from "./ComplianceRequestTaskList";
import ThemedSelect from "./ThemedSelect";
import { Users } from "lucide-react";

export default function ComplianceRequestRequirementsSection({
  form,
  setForm,
  documentTypes,
  linkableContext,
  forms,
  targets,
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  documentTypes: DocumentType[];
  linkableContext: ComplianceLinkableContext;
  forms: { id: number; name: string }[];
  targets?: { users?: { id: number; name: string }[] };
}) {
  const schedule = {
    request_trigger: form.request_trigger,
    request_start_date: form.request_start_date,
    repeat_every_months: form.repeat_every_months,
    tasks_needed_mode: form.tasks_needed_mode as
      | "all_required"
      | "any_required"
      | "minimum_count",
    tasks_needed_minimum: form.tasks_needed_minimum,
    reopen_on_content_change: form.reopen_on_content_change,
  };

  return (
    <div className="sm:col-span-2 space-y-8">
      <ComplianceRequestTaskList
        variant="cards"
        tasks={form.request_tasks}
        onChange={(request_tasks) => setForm({ ...form, request_tasks })}
        documentTypes={documentTypes}
        linkableContext={linkableContext}
        forms={forms}
      />

      <ComplianceRequestScheduleFields
        layout="sections"
        schedule={schedule}
        onChange={(next) => setForm({ ...form, ...next })}
        dueDays={form.due_days}
        gracePeriodDays={form.grace_period_days}
        reminderDays={form.reminder_frequency_days}
        onDueDaysChange={(due_days) => setForm({ ...form, due_days })}
        onGraceChange={(grace_period_days) =>
          setForm({ ...form, grace_period_days })
        }
        onReminderChange={(reminder_frequency_days) =>
          setForm({ ...form, reminder_frequency_days })
        }
        showGracePeriod={false}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <PolicyWizardGraceAndNonComplianceFields
          form={form}
          setForm={setForm}
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Oversight</h3>
        <label className="block space-y-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-slate-400" aria-hidden />
            Who follows up?
          </span>
          <ThemedSelect
            value={String(form.assigned_reviewer_id || "")}
            onChange={(val) => setForm({ ...form, assigned_reviewer_id: val })}
            placeholder="Select HR contact"
            options={(targets?.users || []).map((u) => ({
              value: String(u.id),
              label: u.name,
            }))}
          />
          <p className="text-xs text-slate-500">
            HR contact for escalations, declaration issues, and overdue cycles.
          </p>
        </label>
      </section>
    </div>
  );
}
