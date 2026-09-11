/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SettingsPanel, TagsPicker } from "../policy_controls";

const newLine = (typeId = "", typeName = "", defaults = {}) => ({
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
    allow_overlap: false,
    document_policy: defaults.supporting_document_policy === "never" || !defaults.supporting_document_policy ? "not_required" : "required",
    document_required_after_days: defaults.supporting_document_policy === "conditional" ? 3 : 0,
    accepted_document_types: "",
    allow_negative_balance: Boolean(defaults.allow_negative_balance),
    blackout_period_ids: [],
});

const newForm = (mode = "simple", defaults = {}) => ({
    id: false,
    mode, // "simple" | "advanced"
    advancedOpen: false,
    organisation_defaults: { ...defaults },
    name: "",
    code: "",
    description: "",
    policy_type: "paid",
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
        maximum: 5,
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
    },
    lines: [newLine("", "", defaults)],
    conflict_resolution: "review", // "review" | "keep" | "replace"
});

export class LeavePoliciesPage extends Component {
    static components = { SettingsPanel, TagsPicker };
    static template = "hr_leave_dashboard.LeavePoliciesPage";
    static props = { embedded: { type: Boolean, optional: true } };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({
            loading: true,
            saving: false,
            rows: [],
            options: {},
            search: "",
            listState: "current",
            statusFilter: "all",
            menuId: false,
            wizard: false,
            step: 1,
            form: newForm("simple"),
            detail: false,
            conflicts: [],
            assign: false,
            assignEmployeeIds: [],
            assignDate: new Date().toISOString().slice(0, 10),
            assignResolution: "review",
            activateConflict: null,
            typeDropdownOpen: false,
        });
        onWillStart(() => this.load());
    }

    get steps() {
        return this.state.form.advancedOpen
            ? ["Basic Info & Eligibility", "Leave Types & Accrual", "Rules & Restrictions", "Carry Forward & Approval", "Review & Save"]
            : ["Policy Setup", "Carry Forward & Approval", "Review & Save"];
    }

    get isReview() {
        return this.state.step === this.steps.length;
    }

    get currentStepLabel() {
        return this.steps[this.state.step - 1];
    }

    get visibleRows() {
        let rows = this.state.rows;
        if (this.state.listState === "current" && this.state.statusFilter !== "all") {
            rows = rows.filter(row => row.state === this.state.statusFilter);
        }
        const search = this.state.search.trim().toLowerCase();
        return search
            ? rows.filter(row =>
                [row.name, row.code, row.policy_type_label, row.category, row.state, ...row.leave_types.map(item => item.name)]
                    .join(" ")
                    .toLowerCase()
                    .includes(search)
            )
            : rows;
    }

    setStatusFilter(value) {
        this.state.statusFilter = value;
    }

    async load() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("hr.leave.policy", "get_policy_page_data", [], {
                search: "",
                state: this.state.listState,
            });
            this.state.rows = data.rows || [];
            this.state.options = data.options || {};
        } finally {
            this.state.loading = false;
        }
    }

    // Every policy starts in the normal form using organisation defaults.
    openChooser() {
        this.state.form = newForm("simple", this.state.options.policy_defaults || {});
        this.state.conflicts = [];
        this.state.step = 1;
        this.state.wizard = true;
    }

    toggleAdvanced() {
        if (!this.state.form.advancedOpen && this.state.form.mode !== "advanced") {
            this.syncSimpleLines();
            // This is retained for backward-compatible persistence only. It is
            // configuration depth, not a separate kind of Leave Policy.
            this.state.form.mode = "advanced";
        }
        this.state.form.advancedOpen = !this.state.form.advancedOpen;
        this.state.step = 1;
    }

    closeWizard() {
        this.state.wizard = false;
        this.state.typeDropdownOpen = false;
    }

    // ── Simple Mode Leave Type Management ──
    addSimpleType(typeId) {
        const id = Number(typeId);
        if (id && !this.state.form.simple_leave_type_ids.includes(id)) {
            this.state.form.simple_leave_type_ids.push(id);
            this.syncSimpleLines();
        }
        this.state.typeDropdownOpen = false;
    }

    removeSimpleType(typeId) {
        const id = Number(typeId);
        const index = this.state.form.simple_leave_type_ids.indexOf(id);
        if (index >= 0) {
            this.state.form.simple_leave_type_ids.splice(index, 1);
            this.syncSimpleLines();
        }
    }

    addCustomType() {
        const name = (this.state.form.new_custom_name || "").trim();
        if (name && !this.state.form.custom_type_names.includes(name)) {
            this.state.form.custom_type_names.push(name);
            this.state.form.new_custom_name = "";
            this.syncSimpleLines();
        }
    }

    removeCustomType(index) {
        this.state.form.custom_type_names.splice(index, 1);
        this.syncSimpleLines();
    }

    syncSimpleLines() {
        const accrual = this.state.form.simple_accrual;
        const newLines = [];

        // For each selected existing leave type
        for (const typeId of this.state.form.simple_leave_type_ids) {
            const existing = this.state.form.lines.find(l => l.leave_type_id === typeId);
            newLines.push({
                ...(existing || newLine(typeId, "", this.state.form.organisation_defaults)),
                leave_type_id: typeId,
                new_leave_type_name: "",
                compensation: accrual.compensation,
                unit: accrual.unit,
                entitlement_type: accrual.accrual_period === "none" ? "fixed" : "accrued",
                accrual_period: accrual.accrual_period,
                accrual_basis: accrual.accrual_basis,
                accrual_amount: accrual.accrual_amount,
                waiting_period_days: accrual.waiting_period_days,
                exclude_public_holidays: accrual.exclude_public_holidays,
                exclude_non_working_days: accrual.exclude_non_working_days,
            });
        }

        // For each custom type name
        for (const customName of this.state.form.custom_type_names) {
            const existing = this.state.form.lines.find(l => l.new_leave_type_name === customName);
            newLines.push({
                ...(existing || newLine("", customName, this.state.form.organisation_defaults)),
                leave_type_id: "",
                new_leave_type_name: customName,
                compensation: accrual.compensation,
                unit: accrual.unit,
                entitlement_type: accrual.accrual_period === "none" ? "fixed" : "accrued",
                accrual_period: accrual.accrual_period,
                accrual_basis: accrual.accrual_basis,
                accrual_amount: accrual.accrual_amount,
                waiting_period_days: accrual.waiting_period_days,
                exclude_public_holidays: accrual.exclude_public_holidays,
                exclude_non_working_days: accrual.exclude_non_working_days,
            });
        }

        this.state.form.lines = newLines.length ? newLines : [newLine("", "", this.state.form.organisation_defaults)];
    }

    syncFromLines() {
        const lines = this.state.form.lines || [];
        const typeIds = [];
        const customNames = [];
        for (const line of lines) {
            if (line.leave_type_id) typeIds.push(line.leave_type_id);
            else if (line.new_leave_type_name) customNames.push(line.new_leave_type_name);
        }
        this.state.form.simple_leave_type_ids = typeIds;
        this.state.form.custom_type_names = customNames;
        if (lines.length && lines[0]) {
            const first = lines[0];
            this.state.form.simple_accrual = {
                compensation: first.compensation || "paid",
                unit: first.unit || "days",
                accrual_period: first.accrual_period || "annually",
                accrual_basis: first.accrual_basis || "join_date",
                accrual_amount: first.accrual_amount || 0,
                waiting_period_days: first.waiting_period_days || 0,
                exclude_public_holidays: first.exclude_public_holidays !== false,
                exclude_non_working_days: first.exclude_non_working_days !== false,
            };
        }
    }

    getLeaveTypeName(typeId) {
        const found = (this.state.options.leave_types || []).find(t => t.id === Number(typeId));
        return found ? found.name : `Leave Type #${typeId}`;
    }

    get selectedTypeOptions() {
        return [...this.state.form.simple_leave_type_ids.map(id => ({ id, name: this.getLeaveTypeName(id) })), ...this.state.form.custom_type_names.map(name => ({ id: name, name }))];
    }
    toggleType(id) {
        if (typeof id === "string") this.removeCustomType(this.state.form.custom_type_names.indexOf(id));
        else if (this.state.form.simple_leave_type_ids.includes(id)) this.removeSimpleType(id);
        else this.addSimpleType(id);
    }
    createType(name) { this.state.form.new_custom_name = name; this.addCustomType(); }
    selectedOptions(group, source) { return (this.state.options[source] || []).filter(item => this.state.form.selected[group].includes(item.id)); }

    get availableLeaveTypes() {
        const selected = this.state.form.simple_leave_type_ids || [];
        return (this.state.options.leave_types || []).filter(t => !selected.includes(t.id));
    }

    // ── Advanced Mode Line Operations ──
    addLine() {
        this.state.form.lines.push(newLine("", "", this.state.form.organisation_defaults));
    }

    removeLine(index) {
        if (this.state.form.lines.length > 1) {
            this.state.form.lines.splice(index, 1);
        }
    }

    toggleSelected(group, id) {
        const values = this.state.form.selected[group];
        const number = Number(id);
        const index = values.indexOf(number);
        index >= 0 ? values.splice(index, 1) : values.push(number);
        if (!this.state.form.advancedOpen) {
            this.state.form.apply_to = "selected";
        }
    }

    isSelected(group, id) {
        return this.state.form.selected[group].includes(Number(id));
    }

    validateStep() {
        const isAdv = this.state.form.advancedOpen;
        if (this.state.step === 1 && !this.state.form.name.trim()) {
            return "Policy Name is required.";
        }
        if (!isAdv && this.state.step === 1) {
            const hasTypes = (this.state.form.simple_leave_type_ids.length > 0) || (this.state.form.custom_type_names.length > 0);
            if (!hasTypes) {
                return "Select or add at least one Leave Type.";
            }
            if (this.state.form.simple_accrual.accrual_amount < 0) {
                return "Accrual amount cannot be negative.";
            }
        }
        if (isAdv && this.state.step === 2) {
            if (!this.state.form.lines.length || this.state.form.lines.some(l => !l.leave_type_id && !(l.new_leave_type_name || "").trim())) {
                return "Select or add at least one Leave Type.";
            }
        }
        return "";
    }

    next() {
        const error = this.validateStep();
        if (error) return this.notification.add(error, { type: "warning" });
        if (!this.state.form.advancedOpen) {
            this.syncSimpleLines();
        }
        this.state.step++;
    }

    back() {
        if (this.state.step > 1) this.state.step--;
    }

    goStep(step) {
        if (step <= this.state.step) {
            this.state.step = step;
        } else {
            this.next();
        }
    }

    toggleBlackout(line, id) {
        const index = line.blackout_period_ids.indexOf(id);
        index >= 0 ? line.blackout_period_ids.splice(index, 1) : line.blackout_period_ids.push(id);
    }

    async save(asDraft = false) {
        const error = this.validateStep();
        if (error) return this.notification.add(error, { type: "warning" });

        if (!this.state.form.advancedOpen) {
            this.syncSimpleLines();
        }

        this.state.saving = true;
        try {
            const payload = JSON.parse(JSON.stringify(this.state.form));
            // Fixed entitlement has no accrual schedule; the stored period is
            // only used when entitlement_type is accrued.
            for (const line of payload.lines) {
                if (line.accrual_period === "none") {
                    line.entitlement_type = "fixed";
                    line.accrual_period = "annually";
                }
            }
            if (payload.carry.expiry_type === "never") payload.carry.expiry_value = 0;
            payload.state = asDraft === true ? "draft" : "active";

            if (payload.state === "active") {
                this.state.conflicts = await this.orm.call("hr.leave.policy", "preview_policy_conflicts", [payload]);
                if (this.state.conflicts.length && payload.conflict_resolution === "review") {
                    this.notification.add(
                        "Review the policy assignment conflicts below. Choose 'Keep Existing' or 'Replace' to proceed.",
                        { type: "warning", sticky: true }
                    );
                    return;
                }
            }

            await this.orm.call("hr.leave.policy", "save_policy", [payload]);
            this.notification.add(asDraft ? "Policy saved as Draft." : "Leave policy saved and active.", { type: "success" });
            this.state.wizard = false;
            await this.load();
        } catch (error) {
            this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true });
        } finally {
            this.state.saving = false;
        }
    }

    async view(row) {
        this.state.menuId = false;
        this.state.detail = await this.orm.call("hr.leave.policy", "get_policy_details", [row.id]);
    }

    async edit(row) {
        this.state.menuId = false;
        this.state.detail = false;
        const detail = await this.orm.call("hr.leave.policy", "get_policy_details", [row.id]);
        this.state.form = {
            ...newForm("simple", this.state.options.policy_defaults || {}),
            ...detail,
            mode: detail.mode,
            advancedOpen: false,
            lines: detail.lines.length ? detail.lines.map(line => ({ ...newLine(), ...line })) : [newLine()],
        };
        this.syncFromLines();
        this.state.form.carry.expiry_type = detail.carry.expiry_value ? "period" : "never";
        this.state.conflicts = [];
        this.state.step = 1;
        this.state.wizard = true;
    }

    async changeDetailStatus() {
        const row = this.state.detail;
        if (!row) return;
        this.state.detail = false;
        if (row.state === "active") {
            await this.changeStatus(row, "inactive");
        } else {
            await this.activatePolicy(row);
        }
    }

    async duplicate(row) {
        this.state.detail = false;
        await this.orm.call("hr.leave.policy", "duplicate_policy", [row.id]);
        this.notification.add("Policy duplicated as Draft.", { type: "success" });
        this.state.menuId = false;
        await this.load();
    }

    openAssign(row) {
        this.state.menuId = false;
        this.state.assign = row;
        this.state.assignEmployeeIds = [];
        this.state.assignResolution = "review";
    }

    toggleAssignEmployee(id) {
        const number = Number(id);
        const index = this.state.assignEmployeeIds.indexOf(number);
        index >= 0 ? this.state.assignEmployeeIds.splice(index, 1) : this.state.assignEmployeeIds.push(number);
    }

    async assignPolicy() {
        if (!this.state.assignEmployeeIds.length) {
            return this.notification.add("Select at least one employee.", { type: "warning" });
        }
        try {
            const result = await this.orm.call("hr.leave.policy", "assign_policy", [
                this.state.assign.id,
                this.state.assignEmployeeIds,
                this.state.assignDate,
                this.state.assignResolution,
            ]);
            this.notification.add(`${result.assigned} employee(s) assigned.`, { type: "success" });
            this.state.assign = false;
            await this.load();
        } catch (error) {
            this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true });
        }
    }

    async changeStatus(row, targetState = null, resolution = "review") {
        const next = targetState || (row.state === "active" ? "inactive" : "active");
        try {
            await this.orm.call("hr.leave.policy", "change_policy_status", [row.id, next, resolution]);
            this.notification.add(`Policy status changed to ${next}.`, { type: "success" });
        } catch (error) {
            this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true });
        }
        this.state.menuId = false;
        await this.load();
    }

    displayStatus(row) {
        return !row.active ? "archived" : (row.display_status || row.state);
    }

    async activatePolicy(row) {
        this.state.menuId = false;
        try {
            const conflicts = await this.orm.call("hr.leave.policy", "get_assignment_conflicts", [row.id]);
            if (conflicts && conflicts.length) {
                this.state.activateConflict = {
                    row,
                    conflicts,
                    resolution: "",
                };
                return;
            }
            await this.changeStatus(row, "active", "review");
        } catch (error) {
            this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true });
        }
    }

    async confirmActivateConflict() {
        if (!this.state.activateConflict) return;
        const { row, resolution } = this.state.activateConflict;
        this.state.activateConflict = null;
        await this.changeStatus(row, "active", resolution);
    }

    cancelActivateConflict() {
        this.state.activateConflict = null;
    }

    async archive(row) {
        if (!window.confirm(`Archive policy "${row.name}"? It will be removed from Current Policies, but historical records are preserved.`)) return;
        try {
            await this.orm.call("hr.leave.policy", "archive_policy", [row.id]);
            this.notification.add("Policy archived.", { type: "success" });
        } catch (error) {
            this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true });
        }
        this.state.menuId = false;
        await this.load();
    }

    async restore(row) {
        try {
            const result = await this.orm.call("hr.leave.policy", "restore_policy", [row.id]);
            this.notification.add(
                result.state === "inactive"
                    ? "Policy restored as Inactive. Review details and click Activate when ready."
                    : "Policy restored.",
                { type: "success" }
            );
        } catch (error) {
            this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true });
        }
        this.state.menuId = false;
        await this.load();
    }

    async setListState(value) {
        this.state.listState = value;
        this.state.statusFilter = "all";
        await this.load();
    }
}
