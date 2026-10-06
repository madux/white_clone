"use client";

import {
  defaultRequestSchedule,
  REQUEST_TRIGGER_LABELS,
  type ComplianceRequestScheduleState,
} from "../../../lib/complianceRequestTasks";
import ThemedSelect from "./ThemedSelect";

export function complianceRequestScheduleFromPolicy(policy: Record<string, unknown>) {
  const base = defaultRequestSchedule();
  return {
    request_trigger: String(policy.request_trigger || base.request_trigger),
    request_start_date: String(policy.request_start_date || ""),
    repeat_every_months: Number(policy.repeat_every_months || 0),
    tasks_needed_mode: (policy.tasks_needed_mode as ComplianceRequestScheduleState["tasks_needed_mode"]) || base.tasks_needed_mode,
    tasks_needed_minimum: Number(policy.tasks_needed_minimum || 1),
    reopen_on_content_change: policy.reopen_on_content_change !== false,
  };
}

export default function ComplianceRequestScheduleFields({
  schedule,
  onChange,
  dueDays,
  gracePeriodDays,
  reminderDays,
  onDueDaysChange,
  onGraceChange,
  onReminderChange,
}: {
  schedule: ComplianceRequestScheduleState;
  onChange: (schedule: ComplianceRequestScheduleState) => void;
  dueDays: number;
  gracePeriodDays: string;
  reminderDays: number;
  onDueDaysChange: (value: number) => void;
  onGraceChange: (value: string) => void;
  onReminderChange: (value: number) => void;
}) {
  return (
    <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1">
        <span className="label">When it starts</span>
        <ThemedSelect
          value={schedule.request_trigger}
          onChange={(value) => onChange({ ...schedule, request_trigger: value })}
          options={Object.entries(REQUEST_TRIGGER_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </label>
      {schedule.request_trigger === "specific_date" ||
      schedule.request_trigger === "recurring" ? (
        <label className="block space-y-1">
          <span className="label">Start date</span>
          <input
            type="date"
            className="field"
            value={schedule.request_start_date}
            onChange={(event) =>
              onChange({ ...schedule, request_start_date: event.target.value })
            }
          />
        </label>
      ) : null}
      {schedule.request_trigger === "recurring" ? (
        <label className="block space-y-1">
          <span className="label">Repeat every (months)</span>
          <input
            type="number"
            min={1}
            className="field"
            value={schedule.repeat_every_months || ""}
            onChange={(event) =>
              onChange({
                ...schedule,
                repeat_every_months: Number(event.target.value),
              })
            }
          />
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="label">Due within (days)</span>
        <input
          type="number"
          min={1}
          className="field"
          value={dueDays}
          onChange={(event) => onDueDaysChange(Number(event.target.value))}
        />
      </label>
      <label className="block space-y-1">
        <span className="label">Grace period (days)</span>
        <input
          type="number"
          min={0}
          className="field"
          value={gracePeriodDays}
          onChange={(event) => onGraceChange(event.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="label">Reminder every (days)</span>
        <input
          type="number"
          min={0}
          className="field"
          value={reminderDays}
          onChange={(event) => onReminderChange(Number(event.target.value))}
        />
      </label>
      <label className="block space-y-1">
        <span className="label">Tasks needed</span>
        <ThemedSelect
          value={schedule.tasks_needed_mode}
          onChange={(value) =>
            onChange({
              ...schedule,
              tasks_needed_mode: value as ComplianceRequestScheduleState["tasks_needed_mode"],
            })
          }
          options={[
            { value: "all_required", label: "All required tasks" },
            { value: "any_required", label: "At least one required task" },
            { value: "minimum_count", label: "Minimum number" },
          ]}
        />
      </label>
      {schedule.tasks_needed_mode === "minimum_count" ? (
        <label className="block space-y-1">
          <span className="label">Minimum required tasks</span>
          <input
            type="number"
            min={1}
            className="field"
            value={schedule.tasks_needed_minimum}
            onChange={(event) =>
              onChange({
                ...schedule,
                tasks_needed_minimum: Number(event.target.value),
              })
            }
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={schedule.reopen_on_content_change}
          onChange={(event) =>
            onChange({
              ...schedule,
              reopen_on_content_change: event.target.checked,
            })
          }
          className="h-4 w-4 rounded accent-pink-600"
        />
        Reopen tasks if linked content changes during an open cycle
      </label>
    </div>
  );
}
