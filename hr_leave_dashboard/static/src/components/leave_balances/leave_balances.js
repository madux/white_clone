/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";
import { LeaveRequestDetailModal } from "../leave_request_detail/leave_request_detail";

export class LeaveBalancesPage extends Component {
    static template = "hr_leave_dashboard.LeaveBalancesPage";
    static components = { CalendarSidebar, LeaveRequestDetailModal };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        // OWL compiles methods referenced inside template arrow functions as
        // standalone callbacks. Bind them once so their component context is
        // retained when the generated handler invokes them.
        for (const methodName of [
            "sortBy", "toggleSelected", "toggleArray", "toggleEmployee",
            "toggleAllocationGroup", "setSelectionMode", "onKpiClick", "openDetails", "openAdjust", "openHistory",
            "doYearEndReset", "doCarryForward", "importBalances",
        ]) {
            this[methodName] = this[methodName].bind(this);
        }
        this.state = useState({
            loading: true, rows: [], kpis: {}, departments: [], locations: [], grades: [], leaveTypes: [],
            search: "", sort: { field: "employee_name", direction: "asc" },
            filters: { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "", expiring_only: false },
            filterDraft: { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "" },
            filtersOpen: false, expiryBanner: true, selectedKeys: [], actionKey: null, moreOptionsOpen: false,
            allocationOpen: false, allocationStep: 1, selectionMode: "individual", employeeSearch: "", allocationGroupIds: [],
            selectedEmployeeIds: [], allocation: { leave_type_id: "", amount: 0, reason: "", effective_date: this.today(), notes: "" },
            details: null, detailsOpen: false,
            adjustmentOpen: false, adjustmentEmployee: null, adjustments: [], adjustmentReason: "",
            historyOpen: false, history: null, historySearch: "", historyStatus: "all",
            requestDetailId: null,
        });
        onWillStart(() => this.refreshPage());
    }

    today() { return new Date().toISOString().slice(0, 10); }

    async refreshPage() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("hr.leave.balance.transaction", "get_balance_page_data", [], {
                filters: { ...this.state.filters, search: this.state.filters.employee_search }, sort: this.state.sort,
            });
            this.state.rows = data.rows || [];
            this.state.kpis = data.kpis || {};
            this.state.departments = data.departments || [];
            this.state.locations = data.locations || [];
            this.state.grades = data.grades || [];
            this.state.leaveTypes = data.leave_types || [];
        } catch (error) {
            this.notification.add(error.message || "Unable to load leave balances.", { type: "danger" });
        } finally { this.state.loading = false; }
    }

    get visibleRows() {
        const term = this.state.search.trim().toLowerCase();
        return term ? this.state.rows.filter(r => r.employee_name.toLowerCase().includes(term) || r.employee_code.toLowerCase().includes(term)) : this.state.rows;
    }
    get employees() {
        const seen = new Map();
        for (const row of this.state.rows) if (!seen.has(row.employee_id)) seen.set(row.employee_id, row);
        return [...seen.values()];
    }
    get filteredEmployees() {
        const term = this.state.employeeSearch.trim().toLowerCase();
        let list = this.employees;
        if (this.state.selectionMode === "department" && this.state.allocationGroupIds.length)
            list = list.filter(e => this.state.allocationGroupIds.includes(e.department_id));
        if (this.state.selectionMode === "grade" && this.state.allocationGroupIds.length)
            list = list.filter(e => this.state.allocationGroupIds.includes(e.grade_id));
        return term ? list.filter(e => `${e.employee_name} ${e.employee_code} ${e.department}`.toLowerCase().includes(term)) : list;
    }
    get activeFilterCount() {
        return this.state.filters.department_ids.length + this.state.filters.location_ids.length + this.state.filters.leave_type_ids.length + this.state.filters.policy_ids.length + (this.state.filters.employee_search ? 1 : 0) + (this.state.filters.expiring_only ? 1 : 0);
    }
    get kpiCards() {
        const kpis = this.state.kpis;
        const format = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
        // FR-254: green for positive trends, red for negative trends
        const trend = (value, suffix = "") => {
            if (value === undefined || value === null) return {};
            return {
                trendLabel: `${value > 0 ? "+" : ""}${value}${suffix} vs last month`,
                trendDirection: value > 0 ? "up" : value < 0 ? "down" : "neutral",
            };
        };
        const negCount = Number(kpis.negative_employees || 0);
        return [
            { key: "total_employees", label: "Total Employees", icon: "fa-users", color: "blue", displayValue: format(kpis.total_employees), ...trend(kpis.total_employees_trend_pct, "%") },
            { key: "allocated", label: "Total Leave Days Allocated", icon: "fa-calendar-check-o", color: "rose", displayValue: format(kpis.allocated), ...trend(kpis.allocated_trend_pct, "%") },
            { key: "used", label: "Total Leave Days Used", icon: "fa-check-circle", color: "green", displayValue: format(kpis.used), ...trend(kpis.used_trend_pct, "%") },
            { key: "remaining", label: "Total Remaining", icon: "fa-balance-scale", color: "amber", displayValue: format(kpis.remaining), highlight: true, ...trend(kpis.remaining_trend_pct, "%") },
            // FR-255: orange/amber alert icon, count in red when > 0
            { key: "negative_employees", label: "Employees with Negative Balance", icon: "fa-exclamation-triangle", color: "orange", displayValue: format(negCount), redCount: negCount > 0, ...trend(kpis.negative_employees_trend) },
            { key: "expiring_employees", label: "Employees with Expiring Leave", icon: "fa-clock-o", color: "amber", displayValue: format(kpis.expiring_employees), clickable: true },
        ];
    }
    onKpiClick(card) { if (card.key === "expiring_employees") this.showExpiring(); }
    get selectedEmployees() { return this.employees.filter(e => this.state.selectedEmployeeIds.includes(e.employee_id)); }
    get selectedAllocationLeaveTypeName() {
        const selectedId = Number(this.state.allocation.leave_type_id);
        return this.state.leaveTypes.find((leaveType) => leaveType.id === selectedId)?.name || "";
    }
    get allocationValid() {
        const a = this.state.allocation;
        return Number(a.leave_type_id) && Number(a.amount) > 0 && a.reason.trim() && a.effective_date;
    }
    get filteredHistory() {
        if (!this.state.history) return [];
        const term = this.state.historySearch.trim().toLowerCase();
        return this.state.history.requests.filter(r => (this.state.historyStatus === "all" || r.status === this.state.historyStatus) && (!term || `${r.leave_type} ${r.reason} ${r.reference}`.toLowerCase().includes(term)));
    }

    toggleArray(field, id, target = "filterDraft") {
        const array = this.state[target][field];
        const index = array.indexOf(id);
        index === -1 ? array.push(id) : array.splice(index, 1);
    }
    openFilters() {
        this.state.filterDraft = { department_ids: [...this.state.filters.department_ids], location_ids: [...this.state.filters.location_ids], leave_type_ids: [...this.state.filters.leave_type_ids], policy_ids: [...this.state.filters.policy_ids], employee_search: this.state.filters.employee_search };
        this.state.filtersOpen = true;
    }
    async applyFilters() {
        this.state.filters.department_ids = [...this.state.filterDraft.department_ids];
        this.state.filters.location_ids = [...this.state.filterDraft.location_ids];
        this.state.filters.leave_type_ids = [...this.state.filterDraft.leave_type_ids];
        this.state.filters.policy_ids = [...this.state.filterDraft.policy_ids];
        this.state.filters.employee_search = this.state.filterDraft.employee_search;
        this.state.filtersOpen = false;
        await this.refreshPage();
    }
    async clearFilters() {
        this.state.filterDraft = { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "" };
        this.state.filters = { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "", expiring_only: false };
        await this.refreshPage();
    }
    async showExpiring() { this.state.filters.expiring_only = true; await this.refreshPage(); }
    async sortBy(field) {
        this.state.sort.direction = this.state.sort.field === field && this.state.sort.direction === "asc" ? "desc" : "asc";
        this.state.sort.field = field; await this.refreshPage();
    }
    sortIcon(field) { return this.state.sort.field === field ? (this.state.sort.direction === "asc" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"; }

    toggleSelected(key) { const i = this.state.selectedKeys.indexOf(key); i === -1 ? this.state.selectedKeys.push(key) : this.state.selectedKeys.splice(i, 1); }
    toggleAll() { this.state.selectedKeys = this.state.selectedKeys.length === this.visibleRows.length ? [] : this.visibleRows.map(r => r.key); }

    openAllocation() {
        this.state.allocationOpen = true; this.state.allocationStep = 1; this.state.selectedEmployeeIds = []; this.state.allocationGroupIds = []; this.state.selectionMode = "individual";
        this.state.allocation = { leave_type_id: "", amount: 0, reason: "", effective_date: this.today(), notes: "" };
    }
    toggleEmployee(id) { const a = this.state.selectedEmployeeIds; const i = a.indexOf(id); i === -1 ? a.push(id) : a.splice(i, 1); }
    setSelectionMode(mode) { this.state.selectionMode = mode; this.state.allocationGroupIds = []; this.state.selectedEmployeeIds = []; }
    toggleAllocationGroup(id) { const a = this.state.allocationGroupIds; const i = a.indexOf(id); i === -1 ? a.push(id) : a.splice(i, 1); }
    adjustedBalance(item) { return Number(item.remaining || 0) + Number(item.adjustment || 0); }
    selectAllEmployees() { this.state.selectedEmployeeIds = this.filteredEmployees.map(e => e.employee_id); }
    async applyAllocation() {
        try {
            const a = this.state.allocation;
            const result = await this.orm.call("hr.leave.balance.transaction", "apply_leave_allocation", [this.state.selectedEmployeeIds, Number(a.leave_type_id), Number(a.amount), a.reason, a.effective_date, a.notes]);
            this.state.allocationOpen = false;
            this.notification.add(`Leave allocated to ${result.count} employee(s) successfully.`, { type: "success" });
            await this.refreshPage();
        } catch (error) { this.notification.add(error.message || "Allocation failed.", { type: "danger" }); }
    }

    async openDetails(row, transactions = false) {
        this.state.actionKey = null;
        try {
            this.state.details = await this.orm.call("hr.leave.balance.transaction", "get_balance_details", [row.employee_id, row.leave_type_id]);
            this.state.detailsOpen = true;
            if (transactions) requestAnimationFrame(() => document.querySelector(".balance-transaction-list")?.scrollIntoView());
        } catch (error) { this.notification.add(error.message || "Unable to load balance details.", { type: "danger" }); }
    }
    openAdjust(row) {
        this.state.actionKey = null;
        this.state.adjustmentEmployee = row;
        this.state.adjustments = this.state.rows.filter(r => r.employee_id === row.employee_id).map(r => ({ ...r, adjustment: 0 }));
        this.state.adjustmentReason = ""; this.state.adjustmentOpen = true;
    }
    adjustmentReady() { return this.state.adjustmentReason.trim() && this.state.adjustments.some(r => Number(r.adjustment)); }
    async applyAdjustments() {
        try {
            const result = await this.orm.call("hr.leave.balance.transaction", "apply_balance_adjustments", [this.state.adjustmentEmployee.employee_id, this.state.adjustments.map(r => ({ leave_type_id: r.leave_type_id, adjustment: Number(r.adjustment) })), this.state.adjustmentReason]);
            this.state.adjustmentOpen = false;
            this.notification.add(`${result.count} balance adjustment(s) applied.`, { type: "success" });
            await this.refreshPage();
        } catch (error) { this.notification.add(error.message || "Adjustment failed.", { type: "danger" }); }
    }
    async openHistory(row) {
        this.state.actionKey = null;
        try { this.state.history = await this.orm.call("hr.leave.balance.transaction", "get_employee_leave_history", [row.employee_id]); this.state.historyOpen = true; }
        catch (error) { this.notification.add(error.message || "Unable to load leave history.", { type: "danger" }); }
    }
    openBalanceAudit() {
        this.action.doAction({
            type: "ir.actions.act_window", name: "Leave Audit Log",
            res_model: "hr.leave.audit.log", views: [[false, "list"], [false, "form"]],
            domain: [["employee_id", "=", this.state.details.employee_id], ["leave_type_id", "=", this.state.details.leave_type_id]],
        });
    }
    exportRows() {
        const header = ["Employee ID","Employee","Department","Location","Leave Type","Allocated","Used","Pending","Remaining","Carried Forward","Expiring Days","Expiry Date","Last Updated"];
        const lines = this.visibleRows.map(r => [r.employee_code,r.employee_name,r.department,r.location,r.leave_type,r.allocated,r.used,r.pending,r.remaining,r.carried_forward,r.expiring_days,r.expiry_date,r.last_updated].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
        const url = URL.createObjectURL(new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = "leave_balances.csv"; a.click(); URL.revokeObjectURL(url);
    }
    exportHistory() {
        if (!this.state.history) return;
        const lines = this.filteredHistory.map(r => [r.reference,r.leave_type,r.date_from,r.date_to,r.duration,r.status,r.reason].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
        const url = URL.createObjectURL(new Blob([["Reference,Leave Type,From,To,Days,Status,Reason", ...lines].join("\n")], { type: "text/csv" }));
        const a = document.createElement("a"); a.href = url; a.download = `${this.state.history.employee.code}_leave_history.csv`; a.click(); URL.revokeObjectURL(url);
    }

    // FR-252 — More Options bulk/page-level actions
    toggleMoreOptions() { this.state.moreOptionsOpen = !this.state.moreOptionsOpen; }
    closeMoreOptions() { this.state.moreOptionsOpen = false; }
    async doYearEndReset() {
        this.state.moreOptionsOpen = false;
        try {
            const result = await this.orm.call("hr.leave.balance.transaction", "bulk_year_end_reset", []);
            this.notification.add(`Year-end reset applied to ${result.count || 0} employee(s).`, { type: "success" });
            await this.refreshPage();
        } catch (error) { this.notification.add(error.message || "Year-end reset failed.", { type: "danger" }); }
    }
    async doCarryForward() {
        this.state.moreOptionsOpen = false;
        try {
            const result = await this.orm.call("hr.leave.balance.transaction", "bulk_carry_forward", []);
            this.notification.add(`Carry-forward processed for ${result.count || 0} employee(s).`, { type: "success" });
            await this.refreshPage();
        } catch (error) { this.notification.add(error.message || "Carry-forward processing failed.", { type: "danger" }); }
    }
    importBalances() {
        this.state.moreOptionsOpen = false;
        this.state.importOpen = true;
    }
}


registry.category("actions").add("hr_leave_dashboard.LeaveBalancesPage", LeaveBalancesPage);
