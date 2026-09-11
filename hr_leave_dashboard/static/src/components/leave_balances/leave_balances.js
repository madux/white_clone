/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";
import { LeaveRequestDetailModal } from "../leave_request_detail/leave_request_detail";

export class LeaveBalancesPage extends Component {
    static template = "hr_leave_dashboard.LeaveBalancesPage";
    static components = { CalendarSidebar, LeaveRequestDetailModal };
    static props = { embedded: { type: Boolean, optional: true }, "*": true };

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
            "removeSelectedEmployee", "clearAllocationSelection", "toggleAllocationLeaveType",
            "goToAllocationStep2", "goToAllocationReview", "setAllTypeAmount", "refreshAllocationPreview", "addAllocationLeaveType", "allocationRowTotal",
            "toggleLtFilter", "setLtFilter", "clearLtFilter",
            "decrementAdjustment", "incrementAdjustment",
            "setGroupBy", "toggleGroupByDropdown", "toggleGroup", "toggleGroupSelected", "toggleExpandAll",
            "onSearchInput", "previousPage", "nextPage", "setPageSize",
            "runAccrual", "viewNegativeBalances", "recalculateBalances",
            "importAllocations",
        ]) {
            this[methodName] = this[methodName].bind(this);
        }
        this.state = useState({
            loading: true, rows: [], groups: [], employeeOptions: [], kpis: {}, departments: [], locations: [], grades: [], leaveTypes: [], policies: [],
            search: "", sort: { field: "employee_name", direction: "asc" },
            filters: { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "", expiring_only: false },
            filterDraft: { department_ids: [], location_ids: [], leave_type_ids: [], policy_ids: [], employee_search: "" },
            filtersOpen: false, expiryBanner: true, selectedKeys: [], actionKey: null, moreOptionsOpen: false,
            allocationOpen: false, allocationStep: 1, selectionMode: "individual", employeeSearch: "", selectedEmployeeSearch: "", audiencePage: 1, chipsExpanded: false,
            allocationScopes: { departments: [], units: [], grades: [], jobs: [], locations: [], employment_types: [] },
            selectedScopeIds: { department: [], unit: [], grade: [], job: [], location: [], employment_type: [] },
            individualEmployeeIds: [], excludedEmployeeIds: [], selectedLeaveTypeIds: [], leaveTypeToAdd: "",
            allocationPreviewRows: [], allocationIncompatible: [], allocationPreviewLoading: false,
            bulkAmounts: {}, allocation: { reason: "", effective_date: this.today(), expiry_date: "", notes: "" },
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

    async importAllocations(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
            const lines = (await file.text()).split(/\r?\n/).filter(line => line.trim());
            const headers = lines.shift().split(",").map(value => value.trim().toLowerCase());
            const required = ["employee_id", "leave_type_id", "amount"];
            if (required.some(name => !headers.includes(name))) throw new Error("CSV must contain employee_id, leave_type_id and amount columns.");
            const rows = lines.map(line => {
                const values = line.split(",").map(value => value.trim());
                return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
            });
            if (!rows.length) throw new Error("The import contains no allocation rows.");
            const first = rows[0];
            await this.orm.call("hr.leave.balance.transaction", "apply_leave_allocation_matrix", [
                rows, first.reason || "Imported leave allocation", first.effective_date || this.today(),
                first.notes || "", first.expiry_date || false, first.status || "active",
            ]);
            this.notification.add(`${rows.length} allocation row(s) imported.`, {type: "success"});
            await this.refreshPage();
        } catch (error) {
            this.notification.add(error?.data?.message || error.message || "Allocation import failed.", {type: "danger"});
        }
    }

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
            this.state.policies = data.policies || [];
            const pager = data.pagination || {};
            this.state.pagination.page = pager.page || 1;
            this.state.pagination.pageSize = pager.page_size || this.state.pagination.pageSize;
            this.state.pagination.totalItems = pager.total_items || 0;
            this.state.pagination.totalPages = pager.total_pages || 1;
            this.state.pagination.itemLabel = pager.item_label || (this.state.groupBy === "none" ? "records" : "groups");
            window.dispatchEvent(new CustomEvent("cleon-ai-context", {
                detail: { screen: "leave.balances", title: "Leave Balance Management" },
            }));
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
        return term ? this.employees.filter(e => `${e.employee_name} ${e.employee_code} ${e.department} ${e.unit} ${e.job} ${e.location} ${e.employment_type}`.toLowerCase().includes(term)) : this.employees;
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
            { key: "remaining", label: "Total Available", icon: "fa-balance-scale", color: "amber", displayValue: format(kpis.remaining), highlight: true, ...trend(kpis.remaining_trend_pct, "%") },
            // orange/amber alert icon, count in red when > 0

            { key: "negative_employees", label: "Employees with Negative Balance", icon: "fa-exclamation-triangle", color: "orange", displayValue: format(negCount), redCount: negCount > 0, ...trend(kpis.negative_employees_trend) },
            { key: "expiring_employees", label: "Employees with Expiring Leave", icon: "fa-clock-o", color: "amber", displayValue: format(kpis.expiring_employees), clickable: true },
        ];
    }
    onKpiClick(card) { if (card.key === "expiring_employees") this.showExpiring(); }
    get scopeDefinitions() {
        return [
            { key: "individual", label: "Individual", field: null, options: null },
            { key: "department", label: "Department", field: "department_id", options: "departments" },
            { key: "location", label: "Location", field: "location_id", options: "locations" },
        ];
    }
    get activeScopeDefinition() { return this.scopeDefinitions.find(item => item.key === this.state.selectionMode); }
    get activeScopeOptions() { return this.state.allocationScopes[this.activeScopeDefinition?.options] || []; }
    get audienceItems() {
        if (this.state.selectionMode === "individual") return this.filteredEmployees;
        const term = this.state.employeeSearch.trim().toLowerCase();
        return this.activeScopeOptions.filter(item => item.name.toLowerCase().includes(term));
    }
    get audiencePageCount() { return Math.max(1, Math.ceil(this.audienceItems.length / 10)); }
    get audienceCurrentPage() { return Math.min(this.state.audiencePage, this.audiencePageCount); }
    get audiencePageItems() { return this.audienceItems.slice((this.audienceCurrentPage - 1) * 10, this.audienceCurrentPage * 10); }
    isAudienceSelected(item) {
        return this.state.selectionMode === "individual" ? this.isEmployeeSelected(item.employee_id)
            : (this.state.selectedScopeIds[this.state.selectionMode] || []).includes(item.id);
    }
    audienceSelectionState(item) {
        if (this.state.selectionMode === "individual") return this.isAudienceSelected(item) ? "all" : "none";
        const members = this.employees.filter(employee => {
            const value = employee[this.activeScopeDefinition.field];
            return Array.isArray(value) ? value.includes(item.id) : value === item.id;
        });
        const selected = members.filter(employee => this.selectedEmployeeIds.includes(employee.employee_id)).length;
        return selected === 0 ? "none" : selected === members.length ? "all" : "partial";
    }
    get allAudiencePageSelected() {
        return this.audiencePageItems.length > 0
            && this.audiencePageItems.every(item => this.audienceSelectionState(item) === "all");
    }
    setAudienceGroupSelection(item, shouldSelect) {
        const mode = this.state.selectionMode;
        const values = this.state.selectedScopeIds[mode] ||= [];
        const index = values.indexOf(item.id);
        const field = this.activeScopeDefinition.field;
        const memberIds = new Set(this.employees.filter(employee => {
            const value = employee[field];
            return Array.isArray(value) ? value.includes(item.id) : value === item.id;
        }).map(employee => employee.employee_id));
        if (shouldSelect) {
            if (index === -1) values.push(item.id);
            this.state.excludedEmployeeIds = this.state.excludedEmployeeIds.filter(id => !memberIds.has(id));
        } else if (index !== -1) {
            values.splice(index, 1);
        }
    }
    toggleAudiencePage(event) {
        const selected = event?.target ? event.target.checked : !this.allAudiencePageSelected;
        for (const item of this.audiencePageItems) {
            if (this.state.selectionMode === "individual") {
                const currentlySelected = this.isAudienceSelected(item);
                if (selected && !currentlySelected) {
                    if (!this.state.individualEmployeeIds.includes(item.employee_id)) this.state.individualEmployeeIds.push(item.employee_id);
                    this.state.excludedEmployeeIds = this.state.excludedEmployeeIds.filter(id => id !== item.employee_id);
                } else if (!selected && currentlySelected) {
                    this.removeSelectedEmployee(item.employee_id);
                }
            } else {
                this.setAudienceGroupSelection(item, selected);
            }
        }
    }
    scopeEmployeeCount(id) {
        return this.employees.filter(employee => {
            const value = employee[this.activeScopeDefinition.field];
            return Array.isArray(value) ? value.includes(id) : value === id;
        }).length;
    }
    get selectedEmployeeIds() {
        const selected = new Set(this.state.individualEmployeeIds);
        for (const definition of this.scopeDefinitions.filter(item => item.field)) {
            const scopeIds = this.state.selectedScopeIds[definition.key] || [];
            if (!scopeIds.length) continue;
            for (const employee of this.employees) {
                const value = employee[definition.field];
                if (Array.isArray(value) ? value.some(id => scopeIds.includes(id)) : scopeIds.includes(value)) selected.add(employee.employee_id);
            }
        }
        for (const employeeId of this.state.excludedEmployeeIds) selected.delete(employeeId);
        return [...selected];
    }
    get selectedEmployees() { return this.employees.filter(e => this.selectedEmployeeIds.includes(e.employee_id)); }
    get filteredSelectedEmployees() {
        const term = this.state.selectedEmployeeSearch.trim().toLowerCase();
        return term ? this.selectedEmployees.filter(e => `${e.employee_name} ${e.employee_code} ${e.department} ${e.job}`.toLowerCase().includes(term)) : this.selectedEmployees;
    }
    get selectedLeaveTypes() {
        return this.state.leaveTypes
            .filter(type => this.state.selectedLeaveTypeIds.includes(type.id))
            .sort((left, right) => (left.sequence || 0) - (right.sequence || 0)
                || left.name.localeCompare(right.name) || left.id - right.id);
    }
    allocationCell(row, leaveTypeId) {
        return (row?.cells || []).find(cell => cell.leave_type_id === leaveTypeId) || {
            leave_type_id: leaveTypeId, eligible: false, amount: 0, message: "Not available for this employee",
        };
    }
    get allocationLines() {
        return this.state.allocationPreviewRows.flatMap(row => this.selectedLeaveTypes.map(type => {
            const cell = this.allocationCell(row, type.id);
            return { employee_id: row.employee_id, leave_type_id: type.id, amount: Number(cell.amount) };
        })).filter(line => line.amount > 0);
    }
    get allocationTotalDays() { return this.allocationLines.reduce((total, line) => total + (Number(line.amount) || 0), 0); }
    allocationRowTotal(row) {
        const total = this.selectedLeaveTypes.reduce(
            (sum, type) => {
                const cell = this.allocationCell(row, type.id);
                return sum + (cell.eligible ? (Number(cell.amount) || 0) : 0);
            },
            0,
        );
        return total.toFixed(2);
    }
    get allocationValid() {
        const a = this.state.allocation;
        return this.selectedLeaveTypes.length > 0 && this.state.allocationPreviewRows.length > 0
            && !this.state.allocationPreviewLoading && !this.state.allocationIncompatible.length
            && this.allocationLines.every(line => line.amount > 0) && a.reason.trim() && a.effective_date;
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
        try {
            const data = await this.orm.call("hr.leave.balance.transaction", "get_balance_allocation_options", []);
            this.state.employeeOptions = data.employees || [];
            this.state.leaveTypes = data.leave_types || [];
            this.state.allocationScopes = data.scopes || {};
        } catch (error) {
            this.notification.add(error.message || "Unable to load allocation options.", { type: "danger" });
            return;
        }
        this.state.allocationOpen = true; this.state.allocationStep = 1; this.state.selectionMode = "individual";
        this.state.employeeSearch = ""; this.state.selectedEmployeeSearch = ""; this.state.audiencePage = 1;
        this.state.selectedScopeIds = { department: [], unit: [], grade: [], job: [], location: [], employment_type: [] };
        this.state.individualEmployeeIds = []; this.state.excludedEmployeeIds = []; this.state.selectedLeaveTypeIds = [];
        this.state.leaveTypeToAdd = "";
        this.state.allocationPreviewRows = []; this.state.allocationIncompatible = []; this.state.bulkAmounts = {};
        this.state.allocation = { reason: "", effective_date: this.today(), expiry_date: "", status: "active", notes: "" };
    }
    isEmployeeSelected(id) { return this.selectedEmployeeIds.includes(id); }
    toggleEmployee(id) {
        if (this.isEmployeeSelected(id)) return this.removeSelectedEmployee(id);
        if (!this.state.individualEmployeeIds.includes(id)) this.state.individualEmployeeIds.push(id);
        const excludedIndex = this.state.excludedEmployeeIds.indexOf(id);
        if (excludedIndex !== -1) this.state.excludedEmployeeIds.splice(excludedIndex, 1);
    }
    setSelectionMode(mode) { this.state.selectionMode = mode; this.state.employeeSearch = ""; this.state.audiencePage = 1; }
    toggleAllocationGroup(id) {
        const values = this.state.selectedScopeIds[this.state.selectionMode] ||= [];
        const index = values.indexOf(id);
        index === -1 ? values.push(id) : values.splice(index, 1);
        if (index === -1) {
            const field = this.activeScopeDefinition.field;
            const members = new Set(this.employees.filter(employee => {
                const value = employee[field];
                return Array.isArray(value) ? value.includes(id) : value === id;
            }).map(employee => employee.employee_id));
            this.state.excludedEmployeeIds = this.state.excludedEmployeeIds.filter(employeeId => !members.has(employeeId));
        }
    }
    removeSelectedEmployee(id) {
        const manualIndex = this.state.individualEmployeeIds.indexOf(id);
        if (manualIndex !== -1) this.state.individualEmployeeIds.splice(manualIndex, 1);
        if (!this.state.excludedEmployeeIds.includes(id)) this.state.excludedEmployeeIds.push(id);
    }
    clearAllocationSelection() {
        this.state.individualEmployeeIds = [];
        this.state.excludedEmployeeIds = [];
        this.state.selectedScopeIds = { department: [], unit: [], grade: [], job: [], location: [], employment_type: [] };
        this.state.chipsExpanded = false;
    }
    selectAllEmployees() {
        const allIds = this.filteredEmployees.map(e => e.employee_id);
        const allSelected = allIds.length > 0 && allIds.every(id => this.isEmployeeSelected(id));
        for (const id of allIds) {
            if (allSelected) this.removeSelectedEmployee(id);
            else {
                if (!this.state.individualEmployeeIds.includes(id)) this.state.individualEmployeeIds.push(id);
                const excludedIndex = this.state.excludedEmployeeIds.indexOf(id);
                if (excludedIndex !== -1) this.state.excludedEmployeeIds.splice(excludedIndex, 1);
            }
        }
    }
    async goToAllocationStep2() {
        if (!this.selectedEmployeeIds.length) return;
        this.state.allocationStep = 2;
    }
    async goToAllocationReview() {
        if (!this.allocationValid) return;
        this.state.allocationStep = 3;
    }
    async toggleAllocationLeaveType(id) {
        const values = this.state.selectedLeaveTypeIds;
        const index = values.indexOf(id);
        if (index === -1) {
            values.push(id);
            this.state.bulkAmounts[id] = this.state.leaveTypes.find(type => type.id === id)?.default_amount || 0;
        } else {
            values.splice(index, 1);
            delete this.state.bulkAmounts[id];
        }
        await this.refreshAllocationPreview();
    }
    async addAllocationLeaveType(event) {
        const id = Number(event.target.value);
        this.state.leaveTypeToAdd = "";
        if (!id || this.state.selectedLeaveTypeIds.includes(id)) return;
        this.state.selectedLeaveTypeIds.push(id);
        this.state.bulkAmounts[id] = this.state.leaveTypes.find(type => type.id === id)?.default_amount || 0;
        await this.refreshAllocationPreview();
    }
    async refreshAllocationPreview() {
        if (!this.selectedEmployeeIds.length || !this.state.selectedLeaveTypeIds.length) {
            this.state.allocationPreviewRows = [];
            this.state.allocationIncompatible = [];
            return;
        }
        this.state.allocationPreviewLoading = true;
        try {
            const preview = await this.orm.call("hr.leave.balance.transaction", "preview_leave_allocation", [
                this.selectedEmployeeIds, this.state.selectedLeaveTypeIds, this.state.allocation.effective_date,
            ]);
            this.state.allocationPreviewRows = preview.rows || [];
            this.state.allocationIncompatible = preview.incompatible || [];
            for (const leaveType of this.selectedLeaveTypes) {
                if (this.state.bulkAmounts[leaveType.id] === undefined) this.state.bulkAmounts[leaveType.id] = leaveType.default_amount;
            }
        } catch (error) {
            this.notification.add(error.message || "Unable to build the allocation preview.", { type: "danger" });
        } finally {
            this.state.allocationPreviewLoading = false;
        }
    }
    setAllTypeAmount(leaveTypeId) {
        const amount = Number(this.state.bulkAmounts[leaveTypeId]);
        if (!(amount > 0)) return;
        for (const row of this.state.allocationPreviewRows) {
            const cell = row.cells.find(item => item.leave_type_id === leaveTypeId);
            if (cell?.eligible) cell.amount = amount;
        }
    }
    async applyAllocation() {
        if (!this.allocationValid) return;
        try {
            const a = this.state.allocation;
            const result = await this.orm.call("hr.leave.balance.transaction", "apply_leave_allocation_matrix", [
                this.allocationLines, a.reason, a.effective_date, a.notes, a.expiry_date || false, a.status,
            ]);
            this.state.allocationOpen = false;
            this.notification.add(`${result.allocation_count} allocations across ${result.employee_count} employee(s) and ${result.leave_type_count} Leave Type(s) were applied.`, { type: "success" });
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
        const header = ["Employee ID","Employee","Department","Location","Leave Type","Entitlement","Used","Pending","Available","Carried Forward","Expiring Days","Expiry Date","Last Updated"];
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
    async runAccrual() {
        try {
            const result = await this.orm.call("hr.leave.balance.transaction", "run_accrual_manually", []);
            const message = result.count
                ? `${result.count} due policy accrual(s) processed. Already processed periods were skipped.`
                : "No due policy accruals found. Already processed periods were skipped.";
            this.notification.add(message, { type: result.count ? "success" : "info" });
            await this.refreshPage();
        } catch (error) {
            this.notification.add(error?.data?.message || error?.message || "Unable to run accrual.", { type: "danger" });
        }
    }
    async viewNegativeBalances() {
        this.state.filters.expiring_only = false;
        this.state.search = "";
        this.state.groupBy = "none";
        await this.refreshPage();
        this.state.rows = this.state.rows.filter(row => row.available < 0);
        this.notification.add(`${this.state.rows.length} negative balance record(s).`, { type: "info" });
    }
    async recalculateBalances() {
        const result = await this.orm.call("hr.leave.balance.transaction", "recalculate_balances", []);
        this.notification.add(`${result.checked} balances checked; ${result.changed} changed.`, { type: "success" });
        await this.refreshPage();
    }
    closeMoreOptions() {
        this.state.moreOptionsOpen = false;
        this.state.ltFilterOpen = false;   // also close LT quick-filter
        this.state.groupByOpen = false;    // also close group-by menu
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
