export type ReviewMilestoneDefinition = {
  id?: number;
  name: string;
  offset_months: number;
  repeat_every_months: number;
  repeat_every_years: number;
  requirement: "required" | "optional";
  linked_form_id?: number | false;
};

export const REVIEW_TRIGGER_LABELS: Record<string, string> = {
  policy_effective: "Policy effective date",
  employee_start: "Employee start date",
  joined_scope: "Joined scope",
  people_change: "Role / department / location change",
};

export const REVIEW_REVIEWER_LABELS: Record<string, string> = {
  line_manager: "Line manager",
  hr: "HR",
  manager_and_hr: "Manager and HR",
  assigned_reviewer: "Assigned reviewer",
  employee_and_manager: "Employee and manager",
};

export const REVIEW_COMPLETION_LABELS: Record<string, string> = {
  all_scheduled: "All scheduled reviews",
  any_one: "At least one required review",
  minimum_count: "Minimum number of required reviews",
};

export const REVIEW_OVERDUE_LABELS: Record<string, string> = {
  after_due: "After due date",
  after_grace: "After grace period",
};

export function defaultReviewMilestone(): ReviewMilestoneDefinition {
  return {
    name: "",
    offset_months: 3,
    repeat_every_months: 0,
    repeat_every_years: 0,
    requirement: "required",
    linked_form_id: false,
  };
}

export function validateReviewScheduleConfig(
  milestones: ReviewMilestoneDefinition[],
): string[] {
  const errors: string[] = [];
  const names = milestones.map((m) => m.name.trim()).filter(Boolean);
  if (new Set(names).size !== names.length) {
    errors.push("Each milestone name must be unique.");
  }
  if (!milestones.some((m) => m.requirement === "required" && m.name.trim())) {
    errors.push("Add at least one required milestone.");
  }
  for (const milestone of milestones) {
    if (!milestone.name.trim()) {
      errors.push("Each milestone requires a name.");
      break;
    }
    if (milestone.offset_months < 0) {
      errors.push("Milestone timing cannot be negative.");
      break;
    }
  }
  return errors;
}
