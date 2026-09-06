/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

const newLine = () => ({
    leave_type_id: "", new_leave_type_name: "", classification: "other",
    compensation: "paid", unit: "days", entitlement_type: "fixed",
    accrual_period: "annually", accrual_basis: "join_date", accrual_amount: 0,
    waiting_period_days: 0, exclude_public_holidays: true, exclude_non_working_days: true,
    minimum_notice_days: 0, minimum_duration: 0, maximum_duration: 0,
    allow_backdated: false, allow_half_day: true, allow_overlap: false,
    document_policy: "not_required", document_required_after_days: 0, accepted_document_types: "", allow_negative_balance: false, blackout_period_ids: [],
});

const newForm = (mode = "simple") => ({
    id: false, mode, name: "", code: "", description: "", category: "General", color: "#E91E78",
    state: "active", apply_to: mode === "simple" ? "selected" : "all", condition_match: "all", minimum_tenure_months: 0,
    selected: { employee_ids: [], department_ids: [], unit_ids: [], grade_ids: [], location_ids: [], employee_type_ids: [], job_ids: [] },
    carry: { enabled: false, maximum: 0, expiry_value: 0, expiry_unit: "months", priority: "current" },
    approval: { required: true, workflow: "default", chain_id: false, template_id: false },
    rules: { multiple: true, withdrawal: true, half_day: true },
    lines: [newLine()], conflict_resolution: "review",
});

export class LeavePoliciesPage extends Component {
    static template = "hr_leave_dashboard.LeavePoliciesPage";
    static props = { embedded: { type: Boolean, optional: true } };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({
            loading: true, saving: false, rows: [], options: {}, search: "", listState: "current",
            menuId: false, chooser: false, wizard: false, step: 1, form: newForm(), detail: false, conflicts: [],
            assign: false, assignEmployeeIds: [], assignDate: new Date().toISOString().slice(0, 10), assignResolution: "review",
        });
        onWillStart(() => this.load());
    }

    get steps() {
        return this.state.form.mode === "advanced"
            ? ["Basic Info & Eligibility", "Leave Types & Accrual", "Rules & Restrictions", "Carry Forward & Approval", "Review & Save"]
            : ["Policy Setup", "Carry Forward & Approval", "Review & Save"];
    }
    get isReview() { return this.state.step === this.steps.length; }
    get currentStepLabel() { return this.steps[this.state.step - 1]; }
    get visibleRows() {
        const search = this.state.search.trim().toLowerCase();
        return search ? this.state.rows.filter(row => [row.name, row.code, row.category, ...row.leave_types.map(item => item.name)].join(" ").toLowerCase().includes(search)) : this.state.rows;
    }
    async load() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("hr.leave.policy", "get_policy_page_data", [], { search: "", state: this.state.listState });
            this.state.rows = data.rows || [];
            this.state.options = data.options || {};
        } finally { this.state.loading = false; }
    }
    openChooser() { this.state.chooser = true; this.state.menuId = false; }
    chooseMode(mode) { this.state.form = newForm(mode); this.state.conflicts = []; this.state.step = 1; this.state.chooser = false; this.state.wizard = true; }
    closeWizard() { this.state.wizard = false; this.state.chooser = false; }
    addLine() { this.state.form.lines.push(newLine()); }
    removeLine(index) { if (this.state.form.lines.length > 1) this.state.form.lines.splice(index, 1); }
    toggleSelected(group, id) {
        const values = this.state.form.selected[group];
        const number = Number(id); const index = values.indexOf(number);
        index >= 0 ? values.splice(index, 1) : values.push(number);
        if (this.state.form.mode === "simple") {
            this.state.form.apply_to = "selected";
        }
    }
    isSelected(group, id) { return this.state.form.selected[group].includes(Number(id)); }
    validateStep() {
        const advanced = this.state.form.mode === "advanced";
        if ((this.state.step === 1) && !this.state.form.name.trim()) return "Policy Name is required.";
        if ((!advanced && this.state.step === 1) || (advanced && this.state.step === 2)) {
            if (!this.state.form.lines.length || this.state.form.lines.some(line => !line.leave_type_id && !(line.new_leave_type_name || "").trim())) return "Select or add at least one Leave Type.";
        }
        return "";
    }
    next() { const error = this.validateStep(); if (error) return this.notification.add(error, { type: "warning" }); this.state.step++; }
    back() { if (this.state.step > 1) this.state.step--; }
    goStep(step) { if (step <= this.state.step) this.state.step = step; else this.next(); }
    toggleBlackout(line, id) {
        const index = line.blackout_period_ids.indexOf(id);
        index >= 0 ? line.blackout_period_ids.splice(index, 1) : line.blackout_period_ids.push(id);
    }
    async save(asDraft = false) {
        this.state.saving = true;
        try {
            const payload = JSON.parse(JSON.stringify(this.state.form));
            payload.state = asDraft === true ? "draft" : "active";
            if (payload.state === "active") {
                this.state.conflicts = await this.orm.call("hr.leave.policy", "preview_policy_conflicts", [payload]);
                if (this.state.conflicts.length && payload.conflict_resolution === "review") {
                    this.notification.add("Review the conflicts below, then explicitly choose Keep Existing or Replace. No changes have been saved.", { type: "warning" });
                    return;
                }
            }
            await this.orm.call("hr.leave.policy", "save_policy", [payload]);
            this.notification.add("Leave policy saved.", { type: "success" });
            this.state.wizard = false; await this.load();
        } catch (error) { this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true }); }
        finally { this.state.saving = false; }
    }
    async view(row) { this.state.menuId = false; this.state.detail = await this.orm.call("hr.leave.policy", "get_policy_details", [row.id]); }
    async edit(row) {
        this.state.menuId = false;
        const detail = await this.orm.call("hr.leave.policy", "get_policy_details", [row.id]);
        this.state.form = { ...newForm(detail.mode), ...detail, lines: detail.lines.length ? detail.lines.map(line => ({ ...newLine(), ...line })) : [newLine()] };
        if (detail.mode === "simple") this.state.form.apply_to = "selected";
        this.state.conflicts = [];
        this.state.step = 1; this.state.wizard = true;
    }
    async duplicate(row) { await this.orm.call("hr.leave.policy", "duplicate_policy", [row.id]); this.notification.add("Policy duplicated as Draft.", { type: "success" }); this.state.menuId = false; await this.load(); }
    openAssign(row) { this.state.menuId = false; this.state.assign = row; this.state.assignEmployeeIds = []; this.state.assignResolution = "review"; }
    toggleAssignEmployee(id) { const number = Number(id); const index = this.state.assignEmployeeIds.indexOf(number); index >= 0 ? this.state.assignEmployeeIds.splice(index, 1) : this.state.assignEmployeeIds.push(number); }
    async assignPolicy() {
        if (!this.state.assignEmployeeIds.length) return this.notification.add("Select at least one employee.", { type: "warning" });
        try {
            const result = await this.orm.call("hr.leave.policy", "assign_policy", [this.state.assign.id, this.state.assignEmployeeIds, this.state.assignDate, this.state.assignResolution]);
            this.notification.add(`${result.assigned} employee(s) assigned.`, { type: "success" }); this.state.assign = false; await this.load();
        } catch (error) { this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true }); }
    }
    async changeStatus(row) {
        const next = row.state === "active" ? "inactive" : "active";
        try { await this.orm.call("hr.leave.policy", "change_policy_status", [row.id, next]); this.notification.add(`Policy ${next}.`, { type: "success" }); }
        catch (error) { this.notification.add(error.data?.message || error.message, { type: "danger", sticky: true }); }
        this.state.menuId = false; await this.load();
    }
    async remove(row) {
        if (!window.confirm(`Delete ${row.name}? Policies with history will be archived instead.`)) return;
        const result = await this.orm.call("hr.leave.policy", "delete_policy", [row.id]);
        this.notification.add(result.archived ? "Policy archived to preserve history." : "Policy deleted.", { type: "success" });
        this.state.menuId = false; await this.load();
    }
    async setListState(value) { this.state.listState = value; await this.load(); }
}
