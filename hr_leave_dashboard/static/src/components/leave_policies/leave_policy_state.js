/** @odoo-module **/

export const newLine = (typeId = "", typeName = "", defaults = {}) => ({
    leave_type_id: typeId ? Number(typeId) : "",
    new_leave_type_name: typeName || "",
    classification: "other",
    compensation: "paid",
    unit: defaults.unit || "days",
    entitlement_type: "fixed",
    accrual_period: "annually",
    accrual_basis: "join_date",
    accrual_amount: 21,
    waiting_period_days: 0,
    exclude_public_holidays: true,
    exclude_non_working_days: true,
    minimum_notice_days: Number(defaults.minimum_notice_days || 0),
    minimum_duration: 0,
    maximum_duration: 0,
    allow_backdated: false,
    allow_half_day: defaults.allow_half_day !== false,
    allow_overlap: false, // Individual request overlap must not be conflated with team block_overlap_threshold
    document_policy: defaults.supporting_document_policy === "always" ? "required" : (defaults.supporting_document_policy === "conditional" ? "optional" : "not_required"),
    document_required_after_days: 0,
    accepted_document_types: "",
    allow_negative_balance: Boolean(defaults.allow_negative_balance),
    blackout_period_ids: [],
});

export const newForm = (mode = "simple", defaults = {}) => ({
    id: false,
    mode, // "simple" | "advanced"
    advancedOpen: false,
    organisation_defaults: { ...defaults },
    name: "",
    code: "",
    description: "",
    policy_type: "paid",
    applicable_gender: "all",
    category: "General",
    color: "#E91E78",
    ai_enabled: true,
    state: "active",
    apply_to: "all", // "all" | "selected" | "conditions"
    condition_match: "all",
    minimum_tenure_months: 0,
    // Simple mode specific helpers
    simple_leave_type_ids: [],
    custom_type_names: [],
    new_custom_name: "",
    simple_accrual: {
        compensation: "paid",
        unit: defaults.unit || "days",
        accrual_period: "annually",
        accrual_basis: "join_date",
        accrual_amount: 21,
        waiting_period_days: 0,
        exclude_public_holidays: true,
        exclude_non_working_days: true,
    },
    selected: {
        employee_ids: [],
        department_ids: [],
        unit_ids: [],
        grade_ids: [],
        location_ids: [],
        employee_type_ids: [],
        job_ids: [],
    },
    carry: {
        enabled: Boolean(defaults.allow_carryover),
        maximum: 5, // Maximum balance cap is total balance ceiling; carry.maximum defaults cleanly to 5
        expiry_type: "period", // "never" | "period"
        expiry_value: 3,
        expiry_unit: "months",
        priority: "current", // "current" | "carried"
    },
    approval: {
        required: defaults.approval_workflow !== "none",
        workflow: "default", // "default" | "custom"
        workflow_type_id: false,
        chain_id: false,
        template_id: false,
    },
    rules: {
        multiple: true,
        withdrawal: true,
        half_day: defaults.allow_half_day !== false,
        before_accrual: true,
        team_overlap_percent: Number(defaults.team_overlap_percent || 0),
        block_overlap_threshold: Boolean(defaults.block_overlap_threshold),
    },
    lines: [newLine("", "", defaults)],
    conflict_resolution: "review", // "review" | "keep" | "replace"
});

/**
 * Authoritative override detector: returns true if the policy configuration contains
 * actual granular differences, advanced policy criteria, or divergent per-type rules.
 * Merely expanding Advanced Settings in the UI does NOT make this true.
 */
export function hasAdvancedOverrides(form) {
    if (!form) return false;

    // 1. Advanced Policy-level settings
    if (form.apply_to === "conditions") return true;
    if (form.applicable_gender && form.applicable_gender !== "all") return true;
    if (Number(form.minimum_tenure_months || 0) > 0) return true;
    if (form.approval && form.approval.workflow === "custom") return true;
    if (form.selected) {
        if ((form.selected.grade_ids || []).length > 0) return true;
        if ((form.selected.job_ids || []).length > 0) return true;
        if ((form.selected.unit_ids || []).length > 0) return true;
        if ((form.selected.employee_type_ids || []).length > 0) return true;
    }

    const lines = form.lines || [];
    if (!lines.length) return false;

    // 2. Line-level granular rules & overrides compared to organisation defaults
    const defaults = form.organisation_defaults || {};
    const defaultNotice = Number(defaults.minimum_notice_days || 0);
    const defaultNegative = Boolean(defaults.allow_negative_balance);
    const defaultDocPolicy = defaults.supporting_document_policy === "always" ? "required" : (defaults.supporting_document_policy === "conditional" ? "optional" : "not_required");
    const defaultHalfDay = defaults.allow_half_day !== false;

    for (const line of lines) {
        if (Number(line.minimum_notice_days || 0) !== defaultNotice) return true;
        if (Boolean(line.allow_negative_balance) !== defaultNegative) return true;
        if (line.document_policy && line.document_policy !== defaultDocPolicy) return true;
        if (Number(line.document_required_after_days || 0) > 0) return true;
        if ((line.accepted_document_types || "").trim() !== "") return true;
        if ((line.blackout_period_ids || []).length > 0) return true;
        if (Number(line.minimum_duration || 0) > 0) return true;
        if (Number(line.maximum_duration || 0) > 0) return true;
        if (Boolean(line.allow_backdated)) return true;
        if (Boolean(line.allow_overlap)) return true;
        if (line.allow_half_day !== defaultHalfDay) return true;
        if (Number(line.waiting_period_days || 0) > 0) return true;
    }

    // 3. Per-Leave-Type differences across lines
    const first = lines[0];
    for (let i = 1; i < lines.length; i++) {
        const l = lines[i];
        if (Number(l.accrual_amount) !== Number(first.accrual_amount)) return true;
        if (l.unit !== first.unit) return true;
        if (l.compensation !== first.compensation) return true;
        if (l.accrual_period !== first.accrual_period) return true;
        if (l.accrual_basis !== first.accrual_basis) return true;
        if (Boolean(l.exclude_public_holidays) !== Boolean(first.exclude_public_holidays)) return true;
        if (Boolean(l.exclude_non_working_days) !== Boolean(first.exclude_non_working_days)) return true;
    }

    return false;
}
