"use client";

import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import {
  REVIEW_COMPLETION_LABELS,
  REVIEW_OVERDUE_LABELS,
  REVIEW_REVIEWER_LABELS,
  REVIEW_TRIGGER_LABELS,
} from "../../../lib/reviewSchedule";
import ComplianceReviewMilestoneList from "./ComplianceReviewMilestoneList";
import ThemedSelect from "./ThemedSelect";

export default function ComplianceReviewScheduleFields({
  form,
  setForm,
  forms,
  targets,
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  forms: { id: number; name: string }[];
  targets?: { users?: { id: number; name: string }[] };
}) {
  return (
    <>
      <ComplianceReviewMilestoneList
        milestones={form.review_milestones}
        onChange={(review_milestones) => setForm({ ...form, review_milestones })}
        forms={forms}
      />
      <label>
        <span className="label">When reviews start</span>
        <ThemedSelect
          value={form.review_trigger}
          onChange={(v) => setForm({ ...form, review_trigger: v })}
          options={Object.entries(REVIEW_TRIGGER_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </label>
      <label>
        <span className="label">Anchor date (optional)</span>
        <input
          type="date"
          className="field"
          value={form.review_start_date}
          onChange={(e) => setForm({ ...form, review_start_date: e.target.value })}
        />
      </label>
      <label>
        <span className="label">Reviewer</span>
        <ThemedSelect
          value={form.review_reviewer_mode}
          onChange={(v) => setForm({ ...form, review_reviewer_mode: v })}
          options={Object.entries(REVIEW_REVIEWER_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </label>
      {form.review_reviewer_mode === "assigned_reviewer" ? (
        <label>
          <span className="label">Assigned reviewer</span>
          <ThemedSelect
            value={String(form.assigned_reviewer_id || "")}
            onChange={(v) => setForm({ ...form, assigned_reviewer_id: v })}
            placeholder="Select reviewer"
            options={(targets?.users || []).map((u) => ({
              value: String(u.id),
              label: u.name,
            }))}
          />
        </label>
      ) : null}
      <label>
        <span className="label">Reviews needed</span>
        <ThemedSelect
          value={form.review_completion_mode}
          onChange={(v) => setForm({ ...form, review_completion_mode: v })}
          options={Object.entries(REVIEW_COMPLETION_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </label>
      {form.review_completion_mode === "minimum_count" ? (
        <label>
          <span className="label">Minimum required reviews</span>
          <input
            type="number"
            min={1}
            className="field"
            value={form.review_completion_minimum}
            onChange={(e) =>
              setForm({
                ...form,
                review_completion_minimum: Number(e.target.value),
              })
            }
          />
        </label>
      ) : null}
      <label>
        <span className="label">Mark as overdue</span>
        <ThemedSelect
          value={form.review_overdue_mode}
          onChange={(v) => setForm({ ...form, review_overdue_mode: v })}
          options={Object.entries(REVIEW_OVERDUE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </label>
      <label>
        <span className="label">Grace period (days)</span>
        <input
          type="number"
          min={0}
          className="field"
          value={form.grace_period_days}
          onChange={(e) =>
            setForm({ ...form, grace_period_days: e.target.value })
          }
        />
      </label>
      <p className="sm:col-span-2 text-xs text-slate-500">
        Reviewers are resolved from People when each review is created; legal hold and
        exemptions follow standard compliance rules.
      </p>
    </>
  );
}
