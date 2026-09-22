/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SettingsPanel, TagsPicker } from "../policy_controls";
import { newLine, newForm, hasAdvancedOverrides } from "./leave_policy_state";

export { newLine, newForm, hasAdvancedOverrides };

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
            page: 1,
            pageSize: 6,
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

    get pageCount() {
        return Math.max(1, Math.ceil(this.visibleRows.length / this.state.pageSize));
    }

    get currentPage() {
        return Math.min(this.state.page, this.pageCount);
    }

    get pagedRows() {
        const start = (this.currentPage - 1) * this.state.pageSize;
        return this.visibleRows.slice(start, start + this.state.pageSize);
    }

    get pageNumbers() {
        return Array.from({ length: this.pageCount }, (_, index) => index + 1);
    }

    get pageStart() {
        return this.visibleRows.length ? (this.currentPage - 1) * this.state.pageSize + 1 : 0;
    }

    get pageEnd() {
        return Math.min(this.currentPage * this.state.pageSize, this.visibleRows.length);
    }

    get listMinHeight() {
        // Reserve the height of the fullest page so the pager does not jump on the last page.
        return 42 + 62 * Math.min(this.state.pageSize, this.visibleRows.length);
    }

    changePageSize(event) {
        const size = Number(event.target.value);
        if (![6, 10, 25, 50].includes(size)) return;
        this.state.pageSize = size;
        this.state.page = 1;
        this.state.menuId = false;
    }

    goToPage(page) {
        if (page < 1 || page > this.pageCount) return;
        this.state.page = page;
        this.state.menuId = false;
    }

    setStatusFilter(value) {
        this.state.statusFilter = value;
        this.state.page = 1;
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

    get hasAdvancedOverrides() {
        return hasAdvancedOverrides(this.state.form);
    }

    get summaryAccrualAmount() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = lines[0].accrual_amount;
        const allSame = lines.every(l => Number(l.accrual_amount) === Number(first));
        return allSame ? String(first) : "Varies by Leave Type";
    }

    get summaryAccrualSuffix() {
        const lines = this.state.form.lines || [];
        if (!lines.length || this.summaryUnit === "Varies by Leave Type" || this.summaryAccrualPeriod === "Varies by Leave Type") return "";
        const period = { annually: " / year", monthly: " / month", weekly: " / week" }[lines[0].accrual_period] || "";
        return `${lines[0].unit || "days"}${period}`;
    }

    get summaryUnit() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = lines[0].unit;
        const allSame = lines.every(l => l.unit === first);
        return allSame ? first : "Varies by Leave Type";
    }

    get summaryAccrualPeriod() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = lines[0].accrual_period;
        if (!lines.every(line => line.accrual_period === first)) return "Varies by Leave Type";
        return { annually: "Annually", monthly: "Monthly", weekly: "Weekly", none: "Fixed / No Accrual Cycle" }[first] || first || "-";
    }

    get summaryAccrualBasis() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = lines[0].accrual_basis;
        if (!lines.every(line => line.accrual_basis === first)) return "Varies by Leave Type";
        return { join_date: "Joined Date", calendar: "Calendar Year (1st Jan)", anniversary: "Anniversary" }[first] || first || "-";
    }

    get summaryWaitingPeriod() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = Number(lines[0].waiting_period_days || 0);
        return lines.every(line => Number(line.waiting_period_days || 0) === first)
            ? String(first) : "Varies by Leave Type";
    }

    get summaryCompensation() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = lines[0].compensation;
        const allSame = lines.every(l => l.compensation === first);
        return allSame ? (first === "paid" ? "Paid" : "Unpaid") : "Varies by Leave Type";
    }

    get summaryNoticeDays() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = Number(lines[0].minimum_notice_days || 0);
        const allSame = lines.every(l => Number(l.minimum_notice_days || 0) === first);
        return allSame ? (first ? `${first} days` : "None") : "Varies by Leave Type";
    }

    get summaryDocPolicy() {
        const lines = this.state.form.lines || [];
        if (!lines.length) return "-";
        const first = lines[0].document_policy || "not_required";
        const allSame = lines.every(l => (l.document_policy || "not_required") === first);
        if (!allSame) return "Varies by Leave Type";
        return first === "required" ? "Required" : (first === "optional" ? "Optional" : "Not Required");
    }

    openAdvancedFromSummary(step = 2) {
        this.state.form.advancedOpen = true;
        this.state.step = step;
    }

    applyCommonValuesToAllTypes() {
        const common = this.state.form.simple_accrual;
        const defaults = this.state.form.organisation_defaults || {};
        for (const line of this.state.form.lines) {
            line.compensation = common.compensation;
            line.unit = common.unit;
            line.accrual_period = common.accrual_period;
            line.accrual_basis = common.accrual_basis;
            line.accrual_amount = common.accrual_amount;
            line.waiting_period_days = common.waiting_period_days;
            line.exclude_public_holidays = common.exclude_public_holidays;
            line.exclude_non_working_days = common.exclude_non_working_days;

            line.minimum_notice_days = Number(defaults.minimum_notice_days || 0);
            line.document_policy = defaults.supporting_document_policy === "always" ? "required" : (defaults.supporting_document_policy === "conditional" ? "optional" : "not_required");
            line.document_required_after_days = 0;
            line.accepted_document_types = "";
            line.blackout_period_ids = [];
            line.minimum_duration = 0;
            line.maximum_duration = 0;
            line.allow_backdated = false;
            line.allow_overlap = false;
            line.allow_half_day = defaults.allow_half_day !== false;
            line.allow_negative_balance = Boolean(defaults.allow_negative_balance);
        }
        this.syncSimpleLines();
        this.notification.add("Common settings applied to all leave types.", { type: "info" });
    }

    toggleAdvanced() {
        this.state.form.advancedOpen = !this.state.form.advancedOpen;
        if (this.state.form.advancedOpen && !this.hasAdvancedOverrides) {
            this.syncSimpleLines();
        }
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
            if (this.hasAdvancedOverrides) {
                if (!this.state.form.lines.some(l => l.leave_type_id === id)) {
                    this.state.form.lines.push(newLine(id, "", this.state.form.organisation_defaults));
                }
            } else {
                this.syncSimpleLines();
            }
        }
        this.state.typeDropdownOpen = false;
    }

    removeSimpleType(typeId) {
        const id = Number(typeId);
        const index = this.state.form.simple_leave_type_ids.indexOf(id);
        if (index >= 0) {
            this.state.form.simple_leave_type_ids.splice(index, 1);
            if (this.hasAdvancedOverrides) {
                const lineIdx = this.state.form.lines.findIndex(l => l.leave_type_id === id);
                if (lineIdx >= 0) {
                    this.state.form.lines.splice(lineIdx, 1);
                }
            } else {
                this.syncSimpleLines();
            }
        }
    }

    addCustomType() {
        const name = (this.state.form.new_custom_name || "").trim();
        if (name && !this.state.form.custom_type_names.includes(name)) {
            this.state.form.custom_type_names.push(name);
            this.state.form.new_custom_name = "";
            if (this.hasAdvancedOverrides) {
                if (!this.state.form.lines.some(l => l.new_leave_type_name === name)) {
                    this.state.form.lines.push(newLine("", name, this.state.form.organisation_defaults));
                }
            } else {
                this.syncSimpleLines();
            }
        }
    }

    removeCustomType(index) {
        const name = this.state.form.custom_type_names[index];
        this.state.form.custom_type_names.splice(index, 1);
        if (this.hasAdvancedOverrides) {
            const lineIdx = this.state.form.lines.findIndex(l => l.new_leave_type_name === name);
            if (lineIdx >= 0) {
                this.state.form.lines.splice(lineIdx, 1);
            }
        } else {
            this.syncSimpleLines();
        }
    }

    syncSimpleLines() {
        if (this.hasAdvancedOverrides) {
            return;
        }
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
        const line = this.state.form.lines[index];
        if (line) {
            if (line.leave_type_id) {
                const sIdx = this.state.form.simple_leave_type_ids.indexOf(line.leave_type_id);
                if (sIdx >= 0) this.state.form.simple_leave_type_ids.splice(sIdx, 1);
            } else if (line.new_leave_type_name) {
                const cIdx = this.state.form.custom_type_names.indexOf(line.new_leave_type_name);
                if (cIdx >= 0) this.state.form.custom_type_names.splice(cIdx, 1);
            }
        }
        this.state.form.lines.splice(index, 1);
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

    validateStep(isSaving = false) {
        const isAdv = this.hasAdvancedOverrides || this.state.form.advancedOpen;
        if ((this.state.step === 1 || isSaving) && !this.state.form.name.trim()) {
            return "Policy Name is required.";
        }
        if (!isAdv && (this.state.step === 1 || isSaving)) {
            const hasTypes = (this.state.form.simple_leave_type_ids.length > 0) || (this.state.form.custom_type_names.length > 0);
            if (!hasTypes) {
                return "Select or add at least one Leave Type.";
            }
            if (Number(this.state.form.simple_accrual.accrual_amount) < 0) {
                return "Accrual amount cannot be negative.";
            }
        }
        if (isAdv && (this.state.step === 2 || !this.state.form.advancedOpen || isSaving)) {
            const lines = this.state.form.lines || [];
            if (!lines.length || lines.some(l => !l.leave_type_id && !(l.new_leave_type_name || "").trim())) {
                return "Select or add at least one Leave Type.";
            }
            for (const l of lines) {
                if (Number(l.accrual_amount) < 0) {
                    return "Accrual amount cannot be negative.";
                }
                if (Number(l.waiting_period_days) < 0 || Number(l.minimum_notice_days) < 0 || Number(l.minimum_duration) < 0 || Number(l.maximum_duration) < 0 || Number(l.document_required_after_days) < 0) {
                    return "Policy type limits cannot be negative.";
                }
                if (Number(l.maximum_duration) > 0 && Number(l.minimum_duration) > Number(l.maximum_duration)) {
                    return "Minimum duration cannot exceed maximum duration.";
                }
            }
        }
        if (Number(this.state.form.carry.maximum) < 0 || Number(this.state.form.carry.expiry_value) < 0) {
            return "Policy limits cannot be negative.";
        }
        return "";
    }

    editFromReview(section) {
        if (this.hasAdvancedOverrides || this.state.form.advancedOpen) {
            this.state.form.advancedOpen = true;
            if (section === "basic") this.state.step = 1;
            else if (section === "accrual") this.state.step = 2;
            else if (section === "rules") this.state.step = 3;
            else if (section === "carry") this.state.step = 4;
        } else {
            if (section === "basic" || section === "accrual") this.state.step = 1;
            else if (section === "carry") this.state.step = 2;
        }
    }

    next() {
        const error = this.validateStep();
        if (error) return this.notification.add(error, { type: "warning" });
        if (!this.hasAdvancedOverrides) {
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
        const error = this.validateStep(true);
        if (error) return this.notification.add(error, { type: "warning" });

        if (!this.hasAdvancedOverrides) {
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
            payload.mode = this.hasAdvancedOverrides ? "advanced" : "simple";

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
            lines: detail.lines.length ? detail.lines.map(line => ({ ...newLine("", "", this.state.options.policy_defaults || {}), ...line })) : [newLine("", "", this.state.options.policy_defaults || {})],
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
        this.state.page = 1;
        await this.load();
    }
}
