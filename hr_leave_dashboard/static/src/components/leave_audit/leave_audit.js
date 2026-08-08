/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";

export class LeaveAuditPage extends Component {
    static template = "hr_leave_dashboard.LeaveAuditPage";
    static components = { CalendarSidebar };

    setup() {
        this.orm = useService("orm"); this.notification = useService("notification"); this.action = useService("action");
        this.state = useState({
            loading: true, rows: [], total: 0, summary: {}, actions: [], departments: [], roles: [],
            page: 1, perPage: 10, sort: { field: "occurred_at", direction: "desc" }, expandedId: null,
            filtersOpen: false, columnsOpen: false, live: true, initialLoaded: false,
            filters: { search: "", action: "", module_area: "", entity_type: "", event_status: "", source: "", date_from: "", date_to: "", department_id: "", actor_role: "" },
            columns: { timestamp: true, action: true, module: true, entity: true, actor: true, employee: true, department: true, diff: true, ip: true, device: true, source: true, status: true },
        });
        for (const name of ["sortBy", "toggleExpanded", "goToPage", "toggleColumn"]) this[name] = this[name].bind(this);
        onWillStart(() => this.refresh());
        this.timer = setInterval(() => { if (this.state.live && !document.hidden) this.refresh(true); }, 15000);
        onWillUnmount(() => clearInterval(this.timer));
    }
    get pageCount() { return Math.max(1, Math.ceil(this.state.total / this.state.perPage)); }
    get pages() { const start = Math.max(1, Math.min(this.state.page - 2, this.pageCount - 4)); return Array.from({ length: Math.min(5, this.pageCount) }, (_, i) => start + i); }
    get visibleColumnCount() { return Object.values(this.state.columns).filter(Boolean).length + 1; }
    get columnEntries() { return Object.entries(this.state.columns); }
    get displayEnd() { return Math.min(this.state.page * this.state.perPage, this.state.total); }
    get activeFilterCount() { return Object.entries(this.state.filters).filter(([key, value]) => key !== "search" && value).length; }
    async refresh(silent = false) {
        if (!silent) this.state.loading = true;
        const previousFirstId = this.state.rows[0]?.id;
        try {
            const result = await this.orm.call("hr.leave.audit.log", "get_audit_page_data", [], { filters: { ...this.state.filters }, sort: this.state.sort, offset: (this.state.page - 1) * this.state.perPage, limit: this.state.perPage });
            this.state.rows = result.rows || []; this.state.total = result.total || 0; this.state.summary = result.summary || {}; this.state.actions = result.actions || []; this.state.departments = result.departments || []; this.state.roles = result.roles || [];
            if (silent && this.state.initialLoaded && result.rows?.[0]?.id && result.rows[0].id !== previousFirstId) this.notification.add("New leave audit entries received.", { type: "info" });
            this.state.initialLoaded = true;
        } catch (error) { if (!silent) this.notification.add(error.message || "Unable to load the audit log.", { type: "danger" }); }
        finally { this.state.loading = false; }
    }
    async applyFilters() { this.state.page = 1; this.state.filtersOpen = false; await this.refresh(); }
    async clearFilters() { Object.assign(this.state.filters, { action: "", module_area: "", entity_type: "", event_status: "", source: "", date_from: "", date_to: "", department_id: "", actor_role: "" }); await this.applyFilters(); }
    async onSearchKeydown(event) { if (event.key === "Enter") await this.search(); }
    async search() { this.state.page = 1; await this.refresh(); }
    async sortBy(field) { this.state.sort.direction = this.state.sort.field === field && this.state.sort.direction === "asc" ? "desc" : "asc"; this.state.sort.field = field; await this.refresh(); }
    sortIcon(field) { return this.state.sort.field === field ? (this.state.sort.direction === "asc" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"; }
    toggleExpanded(id) { this.state.expandedId = this.state.expandedId === id ? null : id; }
    toggleColumn(key) { this.state.columns[key] = !this.state.columns[key]; }
    async goToPage(page) { if (page >= 1 && page <= this.pageCount) { this.state.page = page; await this.refresh(); } }
    async changePerPage() { this.state.page = 1; await this.refresh(); }
    openTour() { this.notification.add("Use filters, sortable columns, and expandable rows to investigate leave activity.", { title: "Audit Log Tour", type: "info" }); }
    openHelp() { this.notification.add("Audit entries are immutable and scoped to the active company.", { title: "Audit Log Guide", type: "info" }); }
    openSetup() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_admin_dashboard", { additionalContext: { open_setup_wizard: true } }); }
    openEmployeeView() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_employee_dashboard"); }
    actionClass(action) { if (["submitted", "admin_create"].includes(action)) return "created"; if (["edit", "comment"].includes(action)) return "modified"; if (["approve", "first_approval", "final_approval"].includes(action)) return "approved"; if (["reject", "cancelled", "failed"].includes(action)) return "rejected"; if (["balance_allocation", "balance_adjustment"].includes(action)) return "allocated"; if (action === "policy_change") return "policy"; return "calendar"; }
    formatTimestamp(value) { if (!value) return { date: "—", time: "" }; const date = new Date(value.replace(" ", "T") + "Z"); return { date: date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }), time: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }; }
    diffEntries(values) { return Object.entries(values || {}).map(([key, value]) => ({ key, value: typeof value === "object" ? JSON.stringify(value) : String(value ?? "") })); }
    deviceLabel(value) { if (!value) return "—"; const match = value.match(/(Chrome|Firefox|Safari|Edg|OPR)[\/]?\s?([\d.]+)/); return match ? `${match[1]} ${match[2]}` : value.slice(0, 35); }
    async exportCsv() {
        const result = await this.orm.call("hr.leave.audit.log", "get_audit_page_data", [], { filters: { ...this.state.filters }, sort: this.state.sort, offset: 0, limit: 10000 });
        const header = ["Timestamp", "Action", "Module Area", "Entity Type", "Entity Name", "Entity ID", "Performed By", "Role", "Employee", "Department", "Before", "After", "IP Address", "Device / Browser", "Source", "Status", "Description"];
        const rows = result.rows.map(row => [row.timestamp, row.action_label, row.module_label, row.entity_type_label, row.entity_name, row.entity_reference, row.actor, row.actor_role, row.employee, row.department, JSON.stringify(row.before), JSON.stringify(row.after), row.ip_address, row.device_browser, row.source, row.status, row.description]);
        const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`; const blob = new Blob(["\uFEFF" + [header, ...rows].map(row => row.map(quote).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "leave_audit_log.csv"; link.click(); URL.revokeObjectURL(link.href);
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveAuditPage", LeaveAuditPage);
