"use client";

import { Bell, Calendar, Clock } from "lucide-react";
import type { ReactNode } from "react";
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
    tasks_needed_mode:
      (policy.tasks_needed_mode as ComplianceRequestScheduleState["tasks_needed_mode"]) ||
      base.tasks_needed_mode,
    tasks_needed_minimum: Number(policy.tasks_needed_minimum || 1),
    reopen_on_content_change: policy.reopen_on_content_change !== false,
  };
}

function ScheduleField({
  icon,
  label,
  hint,
  children,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span
        className={
          icon
            ? "flex items-center gap-2 text-sm font-semibold text-slate-800"
            : "block text-sm font-semibold text-slate-800"
        }
      >
        {icon}
        {label}
      </span>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </label>
  );
}

function DaysInput({
  value,
  onChange,
  min = 0,
}: {
  value: number | string;
  onChange: (value: string) => void;
  min?: number;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-brand-pink focus-within:ring-2 focus-within:ring-pink-100">
      <input
        type="number"
        min={min}
        className="field min-w-0 flex-1 border-0 bg-transparent shadow-none focus:ring-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500">
        days
      </span>
    </div>
  );
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
  layout = "grid",
}: {
  schedule: ComplianceRequestScheduleState;
  onChange: (schedule: ComplianceRequestScheduleState) => void;
  dueDays: number;
  gracePeriodDays: string;
  reminderDays: number;
  onDueDaysChange: (value: number) => void;
  onGraceChange: (value: string) => void;
  onReminderChange: (value: number) => void;
  layout?: "grid" | "sections";
}) {
  const iconMuted = "h-4 w-4 shrink-0 text-slate-400";

  const triggerFields =
    schedule.request_trigger === "specific_date" ||
    schedule.request_trigger === "recurring" ? (
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-semibold text-slate-800">Start date</span>
        <input
          type="date"
          className="field"
          value={schedule.request_start_date}
          onChange={(event) =>
            onChange({ ...schedule, request_start_date: event.target.value })
          }
        />
      </label>
    ) : null;

  const recurringField =
    schedule.request_trigger === "recurring" ? (
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-semibold text-slate-800">
          Repeat every (months)
        </span>
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
    ) : null;

  const timelineGrid = (
    <div className="grid gap-4 sm:grid-cols-2">
      <ScheduleField
        icon={<Calendar className={iconMuted} aria-hidden />}
        label="When it starts"
        hint="Trigger moment when tasks appear in the employee action queue."
      >
        <ThemedSelect
          value={schedule.request_trigger}
          onChange={(value) => onChange({ ...schedule, request_trigger: value })}
          options={Object.entries(REQUEST_TRIGGER_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </ScheduleField>
      <ScheduleField
        icon={<Clock className={iconMuted} aria-hidden />}
        label="Due within (days)"
        hint="Window allowed for completion before marking overdue."
      >
        <DaysInput
          value={dueDays}
          min={1}
          onChange={(value) => onDueDaysChange(Number(value))}
        />
      </ScheduleField>
      <ScheduleField
        icon={<Clock className={iconMuted} aria-hidden />}
        label="Grace period (days)"
        hint="Buffer period after due date before escalation notices trigger."
      >
        <DaysInput
          value={gracePeriodDays}
          onChange={(value) => onGraceChange(value)}
        />
      </ScheduleField>
      <ScheduleField
        icon={<Bell className={iconMuted} aria-hidden />}
        label="Reminder every (days)"
        hint="Automated cadence of email and in-app digest reminders."
      >
        <DaysInput
          value={reminderDays}
          onChange={(value) => onReminderChange(Number(value))}
        />
      </ScheduleField>
      {triggerFields}
      {recurringField}
    </div>
  );

  const logicBlock = (
    <div className="space-y-4">
      <ScheduleField icon={null} label="Tasks needed">
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
      </ScheduleField>
      {schedule.tasks_needed_mode === "minimum_count" ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">
            Minimum required tasks
          </span>
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
        <label className="flex cursor-pointer gap-3">
          <input
            type="checkbox"
            checked={schedule.reopen_on_content_change}
            onChange={(event) =>
              onChange({
                ...schedule,
                reopen_on_content_change: event.target.checked,
              })
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-pink-600"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold text-slate-800">
              Reopen tasks if linked content changes during an open cycle
            </span>
            <span className="block text-xs leading-relaxed text-slate-500">
              If the policy guidelines, security clauses, or health documents are
              revised, completed read and acknowledge tasks reset to pending.
            </span>
          </span>
        </label>
      </div>
    </div>
  );

  if (layout === "sections") {
    return (
      <>
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Timeline &amp; Reminders
          </h3>
          {timelineGrid}
        </section>
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Logic &amp; Automation</h3>
          {logicBlock}
        </section>
      </>
    );
  }

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
      {triggerFields}
      {recurringField}
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
      {logicBlock}
    </div>
  );
}
