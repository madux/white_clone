/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
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
            "toggleLtFilter", "setLtFilter", "clearLtFilter",
            "decrementAdjustment", "incrementAdjustment",
            "setGroupBy", "toggleGroupByDropdown", "toggleGroup", "toggleGroupSelected", "toggleExpandAll",
            "onSearchInput", "previousPage", "nextPage", "setPageSize",
        ]) {
            this[methodName] = this[methodName].bind(this);
        }
        this.state = useState({
            loading: true, rows: [], groups: [], employeeOptions: [], kpis: {}, departments: [], locations: [], grades: [], leaveTypes: [],
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
            ltFilterOpen: false,   // Leave Type column quick-filter dropdown open
            ltQuickFilter: null,   // leave_type_id of the active quick-filter (null = all)
            groupBy: "employee",   // "employee" (default), "leave_type", or "none"
            groupByOpen: false,
            expandedGroupKeys: [], // collapsed by default
            pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, itemLabel: "groups" },
        });
        this.searchTimer = null;
        this.loadSequence = 0;
        onWillStart(() => this.refreshPage());
        onWillUnmount(() => clearTimeout(this.searchTimer));
    }

    today() { return new Date().toISOString().slice(0, 10); }

    async refreshPage() {
        const loadSequence = ++this.loadSequence;
        this.state.loading = true;
        try {
            const data = await this.orm.call("hr.leave.balance.transaction", "get_balance_page_data", [], {
                filters: {
                    ...this.state.filters,
                    search: this.state.search.trim(),
                    quick_leave_type_id: this.state.ltQuickFilter,
                },
                sort: this.state.sort,
                group_by: this.state.groupBy,
                pagination: {
                    page: this.state.pagination.page,
                    page_size: this.state.pagination.pageSize,
                },
            });
            if (loadSequence !== this.loadSequence) return;
            this.state.groups = data.groups || [];
            this.state.rows = this.state.groupBy === "none"
                ? (data.rows || [])
                : this.state.groups.flatMap((group) => group.rows);
            this.state.kpis = data.kpis || {};
            this.state.departments = data.departments || [];
            this.state.locations = data.locations || [];
            this.state.grades = data.grades || [];
            this.state.leaveTypes = data.leave_types || [];
            const pager = data.pagination || {};
            this.state.pagination.page = pager.page || 1;
            this.state.pagination.pageSize = pager.page_size || this.state.pagination.pageSize;
            this.state.pagination.totalItems = pager.total_items || 0;
            this.state.pagination.totalPages = pager.total_pages || 1;
            this.state.pagination.itemLabel = pager.item_label || (this.state.groupBy === "none" ? "records" : "groups");
        } catch (error) {
            this.notification.add(error.message || "Unable to load leave balances.", { type: "danger" });
        } finally {
            if (loadSequence === this.loadSequence) this.state.loading = false;
        }
    }

    get visibleRows() {
        return this.state.rows;
    }
    get employees() {
        return this.state.employeeOptions;
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
        // green for positive trends, red for negative trends

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
            // orange/amber alert icon, count in red when > 0

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
        this.resetResultState();
        await this.refreshPage();
    }
    async clearFilters() {
        this.state.filterDraft = { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "" };
        this.state.filters = { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "", expiring_only: false };
        this.resetResultState();
        await this.refreshPage();
    }
    async showExpiring() { this.state.filters.expiring_only = true; this.resetResultState(); await this.refreshPage(); }
    async sortBy(field) {
        this.state.sort.direction = this.state.sort.field === field && this.state.sort.direction === "asc" ? "desc" : "asc";
        this.state.sort.field = field;
        this.state.pagination.page = 1;
        await this.refreshPage();
    }
    sortIcon(field) { return this.state.sort.field === field ? (this.state.sort.direction === "asc" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"; }

    // Leave Type column quick-filter

    toggleLtFilter(ev) {
        ev.stopPropagation();
        this.state.ltFilterOpen = !this.state.ltFilterOpen;
        this.state.moreOptionsOpen = false;
        this.state.actionKey = null;
    }
    async setLtFilter(id) {
        this.state.ltQuickFilter = (this.state.ltQuickFilter === id) ? null : id;
        this.state.ltFilterOpen = false;
        this.resetResultState();
        await this.refreshPage();
    }
    async clearLtFilter() {
        this.state.ltQuickFilter = null;
        this.state.ltFilterOpen = false;
        this.resetResultState();
        await this.refreshPage();
    }

    // Unique leave types visible in the current row set (used to build dropdown)
    get ltFilterOptions() {
        return [...this.state.leaveTypes].sort((a, b) => a.name.localeCompare(b.name));
    }

    get allVisibleSelected() {
        return this.visibleRows.length > 0 && this.visibleRows.every((row) => this.state.selectedKeys.includes(row.key));
    }
    toggleSelected(key) { const i = this.state.selectedKeys.indexOf(key); i === -1 ? this.state.selectedKeys.push(key) : this.state.selectedKeys.splice(i, 1); }
    toggleAll() {
        const visibleKeys = new Set(this.visibleRows.map((row) => row.key));
        if (this.allVisibleSelected) {
            this.state.selectedKeys = this.state.selectedKeys.filter((key) => !visibleKeys.has(key));
        } else {
            this.state.selectedKeys = [...new Set([...this.state.selectedKeys, ...visibleKeys])];
        }
    }

    async openAllocation() {
        if (!this.state.employeeOptions.length) {
            try {
                this.state.employeeOptions = await this.orm.call(
                    "hr.leave.balance.transaction", "get_balance_employee_options", [],
                );
            } catch (error) {
                this.notification.add(error.message || "Unable to load employees.", { type: "danger" });
                return;
            }
        }
        this.state.allocationOpen = true; this.state.allocationStep = 1; this.state.selectedEmployeeIds = []; this.state.allocationGroupIds = []; this.state.selectionMode = "individual";
        this.state.allocation = { leave_type_id: "", amount: 0, reason: "", effective_date: this.today(), notes: "" };
    }
    toggleEmployee(id) { const a = this.state.selectedEmployeeIds; const i = a.indexOf(id); i === -1 ? a.push(id) : a.splice(i, 1); }
    setSelectionMode(mode) { this.state.selectionMode = mode; this.state.allocationGroupIds = []; this.state.selectedEmployeeIds = []; }
    toggleAllocationGroup(id) { const a = this.state.allocationGroupIds; const i = a.indexOf(id); i === -1 ? a.push(id) : a.splice(i, 1); }
    selectAllEmployees() {
        const allIds = this.filteredEmployees.map(e => e.employee_id);
        const allSelected = allIds.length > 0 && allIds.every(id => this.state.selectedEmployeeIds.includes(id));
        // Toggle: if all are selected → deselect all; otherwise → select all
        this.state.selectedEmployeeIds = allSelected ? [] : allIds;
    }
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
    decrementAdjustment(item) {
        item.adjustment = (Number(item.adjustment) || 0) - 1;
    }
    incrementAdjustment(item) {
        item.adjustment = (Number(item.adjustment) || 0) + 1;
    }
    get hasAdjustments() {
        return this.state.adjustments && this.state.adjustments.some(r => Number(r.adjustment) !== 0);
    }
    adjustedBalance(item) {
        const adj = Number(item.adjustment || 0);
        if (adj === 0) return "—";
        const newBal = Math.round((Number(item.remaining || 0) + adj) * 100) / 100;
        return `${newBal} days`;
    }
    adjustmentReady() { return Boolean(this.state.adjustmentReason.trim()) && this.hasAdjustments; }
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
    async exportRows() {
        const data = await this.orm.call("hr.leave.balance.transaction", "get_balance_page_data", [], {
            filters: {
                ...this.state.filters,
                search: this.state.search.trim(),
                quick_leave_type_id: this.state.ltQuickFilter,
            },
            sort: this.state.sort,
            group_by: "none",
            pagination: { page: 1, page_size: 0 },
        });
        const header = ["Employee ID","Employee","Department","Location","Leave Type","Allocated","Used","Pending","Remaining","Carried Forward","Expiring Days","Expiry Date","Last Updated"];
        const lines = (data.rows || []).map(r => [r.employee_code,r.employee_name,r.department,r.location,r.leave_type,r.allocated,r.used,r.pending,r.remaining,r.carried_forward,r.expiring_days,r.expiry_date,r.last_updated].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
        const url = URL.createObjectURL(new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = "leave_balances.csv"; a.click(); URL.revokeObjectURL(url);
    }
    exportHistory() {
        if (!this.state.history) return;
        const lines = this.filteredHistory.map(r => [r.reference,r.leave_type,r.date_from,r.date_to,r.duration,r.status,r.reason].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
        const url = URL.createObjectURL(new Blob([["Reference,Leave Type,From,To,Days,Status,Reason", ...lines].join("\n")], { type: "text/csv" }));
        const a = document.createElement("a"); a.href = url; a.download = `${this.state.history.employee.code}_leave_history.csv`; a.click(); URL.revokeObjectURL(url);
    }

    // More Options bulk/page-level actions

    toggleMoreOptions() { this.state.moreOptionsOpen = !this.state.moreOptionsOpen; }
    closeMoreOptions() {
        this.state.moreOptionsOpen = false;
        this.state.ltFilterOpen = false;   // also close LT quick-filter
        this.state.groupByOpen = false;    // also close group-by menu
    }
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

    // ── Grouping Methods ──────────────────────────────────────────

    async setGroupBy(mode) {
        this.state.groupBy = mode;
        this.state.groupByOpen = false;
        this.resetResultState();
        await this.refreshPage();
    }

    toggleGroupByDropdown(ev) {
        if (ev) ev.stopPropagation();
        this.state.groupByOpen = !this.state.groupByOpen;
        this.state.moreOptionsOpen = false;
        this.state.ltFilterOpen = false;
    }

    toggleGroup(groupKey) {
        const index = this.state.expandedGroupKeys.indexOf(groupKey);
        if (index === -1) {
            this.state.expandedGroupKeys.push(groupKey);
        } else {
            this.state.expandedGroupKeys.splice(index, 1);
        }
    }

    isGroupExpanded(groupKey) {
        return this.state.expandedGroupKeys.includes(groupKey);
    }

    isGroupAllSelected(group) {
        return group.rows.length > 0 && group.rows.every(r => this.state.selectedKeys.includes(r.key));
    }

    toggleGroupSelected(group) {
        const allSelected = this.isGroupAllSelected(group);
        const groupRowKeys = group.rows.map(r => r.key);
        if (allSelected) {
            this.state.selectedKeys = this.state.selectedKeys.filter(k => !groupRowKeys.includes(k));
        } else {
            const toAdd = groupRowKeys.filter(k => !this.state.selectedKeys.includes(k));
            this.state.selectedKeys.push(...toAdd);
        }
    }

    get allExpanded() {
        return Boolean(this.groupedRows && this.groupedRows.length > 0 && this.groupedRows.every(g => this.state.expandedGroupKeys.includes(g.key)));
    }

    toggleExpandAll() {
        if (this.allExpanded) {
            this.state.expandedGroupKeys = [];
        } else if (this.groupedRows) {
            this.state.expandedGroupKeys = this.groupedRows.map(g => g.key);
        }
    }

    get groupedRows() {
        return this.state.groupBy === "none" ? null : this.state.groups;
    }

    resetResultState() {
        this.state.pagination.page = 1;
        this.state.expandedGroupKeys = [];
        this.state.selectedKeys = [];
    }

    onSearchInput(ev) {
        this.state.search = ev.target.value;
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(async () => {
            this.resetResultState();
            await this.refreshPage();
        }, 300);
    }

    async previousPage() {
        if (this.state.pagination.page <= 1) return;
        this.state.pagination.page -= 1;
        this.state.expandedGroupKeys = [];
        await this.refreshPage();
    }

    async nextPage() {
        if (this.state.pagination.page >= this.state.pagination.totalPages) return;
        this.state.pagination.page += 1;
        this.state.expandedGroupKeys = [];
        await this.refreshPage();
    }

    async setPageSize(ev) {
        this.state.pagination.pageSize = Number(ev.target.value);
        this.resetResultState();
        await this.refreshPage();
    }

    get pageStart() {
        return this.state.pagination.totalItems
            ? (this.state.pagination.page - 1) * this.state.pagination.pageSize + 1
            : 0;
    }

    get pageEnd() {
        return Math.min(
            this.state.pagination.page * this.state.pagination.pageSize,
            this.state.pagination.totalItems,
        );
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveBalancesPage", LeaveBalancesPage);
