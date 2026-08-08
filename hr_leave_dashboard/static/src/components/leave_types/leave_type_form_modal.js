/** @odoo-module **/

import { Component, useRef, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class LeaveTypeFormModal extends Component {
    static template = "hr_leave_dashboard.LeaveTypeFormModal";
    static props = {
        mode: String, // "create" | "edit"
        leaveTypeData: { type: Object, optional: true },
        departments: Array,
        units: Array,
        grades: Array,
        employees: Array,
        employmentTypes: Array,
        locations: Array,
        close: Function,
        onSaved: Function,
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.modalBodyRef = useRef("modalBody");

        const initialForm = this.buildInitialFormState(this.props.leaveTypeData);

        this.state = useState({
            form: initialForm,
            errors: {},
            saving: false,
            showDiscardPrompt: false,
            expandedSections: {
                basic: true,
                settings: true,
                appliesTo: true,
                accrual: true,
                advanced: true,
            },
        });

        this.initialSnapshot = JSON.stringify(this.serializeForm(this.state.form));
    }

    buildInitialFormState(data = null) {
        if (!data) {
            return {
                id: null,
                name: "",
                code: "",
                description: "",
                colorHex: "#3B82F6",
                category: "paid",
                maxEntitlement: 20,
                unlimitedEntitlement: false,
                applicableGender: "all",

                eligibilityScope: "all",
                departmentIds: [],
                unitIds: [],
                gradeIds: [],
                employeeIds: [],
                employeeTypeIds: [],
                locationIds: this.props.locations.length ? [this.props.locations[0].id] : [],
                minimumServiceMonths: 0,

                accrualMethod: "year_start",
                tenureBasedAccrual: false,
                tenureTiers: [{ id: "temp_1", year_from: 1, year_to: 5, days_per_year: 20 }],

                suspensionUnpaidLeave: false,
                suspensionDisciplinary: false,
                suspensionExtendedSick: false,
                suspensionProbation: false,
                suspensionUnauthorizedAbsence: false,

                allowCarryForward: true,
                allowEncashment: false,
                maxBalanceCap: 0,

                approvalWorkflow: "single",
                supportingDocumentPolicy: "never",
                minimumNoticeDays: 0,
                allowHalfDay: true,

                maxConsecutiveDays: 0,
                allowNegativeBalance: false,
                teamOverlapPercent: 0,
                blockOverlapThreshold: false,

                active: true,
                visibleToEmployees: true,

                assignedEmployeeCount: 0,
                activeRequestCount: 0,
            };
        }

        return {
            id: data.id || null,
            name: data.name || "",
            code: data.code || "",
            description: data.description || "",
            colorHex: data.color_hex || "#3B82F6",
            category: data.category || "paid",
            maxEntitlement: data.max_entitlement !== undefined ? data.max_entitlement : 20,
            unlimitedEntitlement: Boolean(data.unlimited_entitlement),
            applicableGender: data.applicable_gender || "all",

            eligibilityScope: data.eligibility_scope || "all",
            departmentIds: [...(data.department_ids || [])],
            unitIds: [...(data.unit_ids || [])],
            gradeIds: [...(data.grade_ids || [])],
            employeeIds: [...(data.employee_ids || [])],
            employeeTypeIds: [...(data.employee_type_ids || [])],
            // Older Odoo leave types predate the CleonHR location policy. An
            // empty value means they applied everywhere, so represent that as
            // all configured locations instead of blocking an unrelated edit.
            locationIds: data.location_ids && data.location_ids.length
                ? [...data.location_ids]
                : this.props.locations.map(location => location.id),
            minimumServiceMonths: data.minimum_service_months || 0,

            accrualMethod: data.accrual_method || "year_start",
            tenureBasedAccrual: Boolean(data.tenure_based_accrual),
            tenureTiers: data.tenure_tiers && data.tenure_tiers.length
                ? [...data.tenure_tiers]
                : [{ id: "temp_1", year_from: 1, year_to: 5, days_per_year: 20 }],

            suspensionUnpaidLeave: Boolean(data.suspension_unpaid_leave),
            suspensionDisciplinary: Boolean(data.suspension_disciplinary),
            suspensionExtendedSick: Boolean(data.suspension_extended_sick),
            suspensionProbation: Boolean(data.suspension_probation),
            suspensionUnauthorizedAbsence: Boolean(data.suspension_unauthorized_absence),

            allowCarryForward: data.allow_carry_forward !== undefined ? Boolean(data.allow_carry_forward) : true,
            allowEncashment: Boolean(data.allow_encashment),
            maxBalanceCap: data.max_balance_cap || 0,

            approvalWorkflow: data.approval_workflow || "single",
            supportingDocumentPolicy: data.supporting_document_policy || "never",
            minimumNoticeDays: data.minimum_notice_days || 0,
            allowHalfDay: data.allow_half_day !== undefined ? Boolean(data.allow_half_day) : true,

            maxConsecutiveDays: data.max_consecutive_days || 0,
            allowNegativeBalance: Boolean(data.allow_negative_balance),
            teamOverlapPercent: data.team_overlap_percent || 0,
            blockOverlapThreshold: Boolean(data.block_overlap_threshold),

            active: data.active !== undefined ? Boolean(data.active) : true,
            visibleToEmployees: data.visible_to_employees !== undefined ? Boolean(data.visible_to_employees) : true,

            assignedEmployeeCount: data.assigned_count || 0,
            activeRequestCount: data.active_request_count || 0,
        };
    }

    serializeForm(f) {
        return {
            name: f.name,
            code: f.code,
            description: f.description,
            colorHex: f.colorHex,
            category: f.category,
            maxEntitlement: f.maxEntitlement,
            unlimitedEntitlement: f.unlimitedEntitlement,
            applicableGender: f.applicableGender,
            eligibilityScope: f.eligibilityScope,
            departmentIds: f.departmentIds,
            unitIds: f.unitIds,
            gradeIds: f.gradeIds,
            employeeIds: f.employeeIds,
            employeeTypeIds: f.employeeTypeIds,
            locationIds: f.locationIds,
            minimumServiceMonths: f.minimumServiceMonths,
            accrualMethod: f.accrualMethod,
            tenureBasedAccrual: f.tenureBasedAccrual,
            tenureTiers: f.tenureTiers,
            suspensionUnpaidLeave: f.suspensionUnpaidLeave,
            suspensionDisciplinary: f.suspensionDisciplinary,
            suspensionExtendedSick: f.suspensionExtendedSick,
            suspensionProbation: f.suspensionProbation,
            suspensionUnauthorizedAbsence: f.suspensionUnauthorizedAbsence,
            allowCarryForward: f.allowCarryForward,
            allowEncashment: f.allowEncashment,
            maxBalanceCap: f.maxBalanceCap,
            approvalWorkflow: f.approvalWorkflow,
            supportingDocumentPolicy: f.supportingDocumentPolicy,
            minimumNoticeDays: f.minimumNoticeDays,
            allowHalfDay: f.allowHalfDay,
            maxConsecutiveDays: f.maxConsecutiveDays,
            allowNegativeBalance: f.allowNegativeBalance,
            teamOverlapPercent: f.teamOverlapPercent,
            blockOverlapThreshold: f.blockOverlapThreshold,
            active: f.active,
            visibleToEmployees: f.visibleToEmployees,
        };
    }

    get isDirty() {
        return JSON.stringify(this.serializeForm(this.state.form)) !== this.initialSnapshot;
    }

    get presetSwatches() {
        return [
            "#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#F59E0B", "#06B6D4", "#EC4899", "#84CC16",
            "#2563EB", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2", "#DB2777", "#65A30D",
        ];
    }

    selectPresetColor(hex) {
        this.state.form.colorHex = hex;
    }

    toggleSection(secName) {
        this.state.expandedSections[secName] = !this.state.expandedSections[secName];
    }

    onMultiSelectChange(field, ev) {
        const selectedOptions = Array.from(ev.target.selectedOptions).map(o => Number(o.value));
        this.state.form[field] = selectedOptions;
    }

    addTenureTier() {
        const tiers = this.state.form.tenureTiers;
        const lastTier = tiers[tiers.length - 1];
        const nextFrom = lastTier ? (lastTier.year_to ? lastTier.year_to + 1 : lastTier.year_from + 5) : 1;
        tiers.push({
            id: `temp_${Date.now()}`,
            year_from: nextFrom,
            year_to: nextFrom + 4,
            days_per_year: 25,
        });
    }

    removeTenureTier(idx) {
        if (this.state.form.tenureTiers.length > 1) {
            this.state.form.tenureTiers.splice(idx, 1);
        }
    }

    get accrualSummaryPreviewText() {
        const f = this.state.form;
        const daysText = f.unlimitedEntitlement ? "Unlimited leave" : `${f.maxEntitlement} days`;
        if (f.accrualMethod === "year_start") {
            return `All ${daysText} are credited upfront at the start of each calendar year on January 1st.`;
        } else if (f.accrualMethod === "monthly") {
            return `${daysText} accrue gradually on a monthly prorated basis throughout the year.`;
        } else if (f.accrualMethod === "hire_anniversary") {
            return `Leave entitlement renews on each employee's hire date anniversary.`;
        } else if (f.accrualMethod === "first_year_prorated") {
            return `Pro-rated allocation based on joining date during the first year of employment.`;
        } else {
            return `No automatic accrual. Leave balances are assigned manually by HR administrators.`;
        }
    }

    get policySummaryItems() {
        const f = this.state.form;
        const docText = { always: "Always", conditional: "Conditional (>3 days)", never: "Never" }[f.supportingDocumentPolicy];
        const overlapText = Number(f.teamOverlapPercent) > 0
            ? `${f.teamOverlapPercent}% ${f.blockOverlapThreshold ? "(blocks requests)" : "(warns only)"}`
            : "Disabled";

        return [
            `Notice: ${f.minimumNoticeDays || 0} days`,
            `Document required: ${docText}`,
            `Negative balance: ${f.allowNegativeBalance ? "Allowed" : "Not allowed"}`,
            `Team overlap limit: ${overlapText}`,
            `Half-day requests: ${f.allowHalfDay ? "Allowed" : "Disabled"}`,
        ];
    }

    get validationMessages() {
        return Object.values(this.state.errors).filter(Boolean);
    }

    validateForm() {
        const errors = {};
        const f = this.state.form;

        if (!f.name || !f.name.trim()) {
            errors.name = "Leave type name is required.";
        }
        if (!f.code || !f.code.trim()) {
            f.code = (f.name || "LT").trim().substring(0, 3).toUpperCase();
        }
        if (!/^#[0-9A-F]{6}$/i.test((f.colorHex || "").trim())) {
            errors.colorHex = "Enter a valid six-digit hex colour, for example #3B82F6.";
        }
        if (this.props.locations && this.props.locations.length > 0 && (!f.locationIds || f.locationIds.length === 0)) {
            errors.locations = "At least one applicable location is required.";
        }

        if (f.eligibilityScope === "departments" && f.departmentIds.length === 0) {
            errors.eligibility = "Please select at least one department.";
        } else if (f.eligibilityScope === "units" && f.unitIds.length === 0) {
            errors.eligibility = "Please select at least one unit.";
        } else if (f.eligibilityScope === "grades" && f.gradeIds.length === 0) {
            errors.eligibility = "Please select at least one grade level.";
        } else if (f.eligibilityScope === "employees" && f.employeeIds.length === 0) {
            errors.eligibility = "Please select at least one employee.";
        }

        this.state.errors = errors;
        return Object.keys(errors).length === 0;
    }

    async saveForm(addAnother = false) {
        if (!this.validateForm()) {
            this.state.expandedSections.basic = true;
            this.state.expandedSections.appliesTo = true;
            requestAnimationFrame(() => {
                this.modalBodyRef.el?.scrollTo({ top: 0, behavior: "smooth" });
            });
            return;
        }

        this.state.saving = true;
        try {
            const f = this.state.form;
            const res = await this.orm.call(
                "hr.leave.type",
                "save_leave_type_configuration",
                [f]
            );

            this.notification.add(
                f.id ? `Leave type '${f.name}' updated successfully.` : `New leave type '${f.name}' created successfully.`,
                { type: "success" }
            );

            await this.props.onSaved();

            if (addAnother) {
                this.state.form = this.buildInitialFormState(null);
                this.state.errors = {};
                this.initialSnapshot = JSON.stringify(this.serializeForm(this.state.form));
            } else {
                this.props.close();
            }
        } catch (err) {
            console.error("Failed to save leave type configuration", err);
            this.notification.add(err.message || "Failed to save leave type configuration.", { type: "danger" });
        } finally {
            this.state.saving = false;
        }
    }

    handleCancel() {
        if (this.isDirty) {
            if (confirm("You have unsaved changes. Are you sure you want to discard them?")) {
                this.props.close();
            }
        } else {
            this.props.close();
        }
    }
}
