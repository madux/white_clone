/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../components/calendar_sidebar";
import { LeaveRequestDetailModal } from "../components/leave_request_detail/leave_request_detail";

export class LeaveRequestsPage extends Component {
    static template = "hr_leave_dashboard.LeaveRequestsPage";
    static components = { CalendarSidebar, LeaveRequestDetailModal };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.searchTimer = null;

        this.state = useState({
            loading: true,
            status: "all",
            search: "",
            leaveTypeId: false,
            departmentId: false,
            detailRequestId: null,

            rows: [],
            counts: { all: 0, pending: 0, approved: 0, rejected: 0 },

            leaveTypes: [],
            departments: [],

            page: 1,
            pageSize: 10,
            pageCount: 1,
            total: 0,
            from: 0,
            to: 0,

            selectedIds: [],
            sidebarCollapsed: false,
            viewMode: "admin",

            // ── Review Detail Modal ──
            showReviewModal: false,
            selectedRequest: null,
            detailLoading: false,

            // ── Reject Reason Modal ──
            showRejectModal: false,
            rejectReason: "",
            rejectTargetId: null, // null means bulk reject selectedIds

            // ── Admin Create Modal ──
            showCreateModal: false,
            employeeSearch: "",
            employeeDropdownOpen: false,
            selectedEmployee: null,
            createForm: {
                employee_id: "",
                leave_type_id: "",
                date_from: "",
                date_to: "",
                admin_note: "",
                half_day: false,
                period: "am",
            },
            createEmployees: [],
            createLeaveTypes: [],
            createPreview: null,
            showOverlapWarning: false,
            overrideConflict: false,
            createSubmitting: false,
        });

        onWillStart(async () => {
            await this.loadRequests();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  DATA LOADING & FILTERS
    // ═══════════════════════════════════════════════════════════════

    async loadRequests() {
        this.state.loading = true;
        try {
            const data = await this.orm.call(
                "hr.leave", "get_leave_requests_page", [],
                {
                    search_term: this.state.search,
                    status: this.state.status,
                    leave_type_id: this.state.leaveTypeId || false,
                    department_id: this.state.departmentId || false,
                    page: this.state.page,
                    page_size: this.state.pageSize,
                }
            );

            this.state.rows = data.rows || [];
            this.state.counts = data.counts || this.state.counts;
            this.state.leaveTypes = data.leave_types || [];
            this.state.departments = data.departments || [];

            const pager = data.pagination;
            this.state.page = pager.page;
            this.state.pageSize = pager.page_size;
            this.state.pageCount = pager.page_count;
            this.state.total = pager.total;
            this.state.from = pager.from;
            this.state.to = pager.to;

            this.state.selectedIds = [];
        } finally {
            this.state.loading = false;
        }
    }

    async selectStatus(status) {
        if (this.state.status === status) return;
        this.state.status = status;
        this.state.page = 1;
        await this.loadRequests();
    }

    onSearchInput(ev) {
        this.state.search = ev.target.value;
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(async () => {
            this.state.page = 1;
            await this.loadRequests();
        }, 300);
    }

    async onLeaveTypeFilter(ev) {
        this.state.leaveTypeId = ev.target.value ? parseInt(ev.target.value) : false;
        this.state.page = 1;
        await this.loadRequests();
    }

    async onDepartmentFilter(ev) {
        this.state.departmentId = ev.target.value ? parseInt(ev.target.value) : false;
        this.state.page = 1;
        await this.loadRequests();
    }

    // ═══════════════════════════════════════════════════════════════
    //  EXPORT (FR-081)
    // ═══════════════════════════════════════════════════════════════

    exportRequests() {
        if (!this.state.rows.length) {
            this.notification.add("No requests to export.", { type: "warning" });
            return;
        }

        const headers = ["ID", "Employee", "Department", "Leave Type", "Start Date", "End Date", "Duration (Days)", "Status", "Approver", "Submitted Date"];
        const rows = this.state.rows.map((r) => [
            r.id,
            `"${r.employee.name.replace(/"/g, '""')}"`,
            `"${r.employee.department.replace(/"/g, '""')}"`,
            `"${r.leave_type.name.replace(/"/g, '""')}"`,
            r.date_from,
            r.date_to,
            r.duration,
            r.status,
            `"${r.approver.replace(/"/g, '""')}"`,
            r.submitted,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Leave_Requests_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.notification.add("Leave requests exported successfully.", { type: "success" });
    }

    // ═══════════════════════════════════════════════════════════════
    //  SELECTION & BULK ACTIONS (FR-090 to FR-100)
    // ═══════════════════════════════════════════════════════════════

    toggleRow(id) {
        if (this.state.selectedIds.includes(id)) {
            this.state.selectedIds = this.state.selectedIds.filter((x) => x !== id);
        } else {
            this.state.selectedIds = [...this.state.selectedIds, id];
        }
    }

    get allVisibleSelected() {
        return (
            this.state.rows.length > 0 &&
            this.state.rows.every((row) => this.state.selectedIds.includes(row.id))
        );
    }

    toggleSelectAll(ev) {
        if (ev.target.checked) {
            this.state.selectedIds = this.state.rows.map((row) => row.id);
        } else {
            this.state.selectedIds = [];
        }
    }

    clearSelection() {
        this.state.selectedIds = [];
    }

    async bulkApprove() {
        if (!this.state.selectedIds.length) return;
        const res = await this.orm.call("hr.leave", "bulk_approve_leave_requests", [], {
            leave_ids: this.state.selectedIds,
        });
        this.notification.add(`${res.processed} leave request(s) approved successfully.`, { type: "success" });
        await this.loadRequests();
    }

    openBulkReject() {
        if (!this.state.selectedIds.length) return;
        this.state.rejectTargetId = null;
        this.state.rejectReason = "";
        this.state.showRejectModal = true;
    }

    openSingleReject(id) {
        this.state.rejectTargetId = id;
        this.state.rejectReason = "";
        this.state.showRejectModal = true;
    }

    async confirmReject() {
        if (!this.state.rejectReason.trim() || this.state.rejectReason.trim().length < 3) {
            this.notification.add("A rejection reason is required (at least 3 characters).", { type: "warning" });
            return;
        }

        const ids = this.state.rejectTargetId ? [this.state.rejectTargetId] : this.state.selectedIds;
        const res = await this.orm.call("hr.leave", "bulk_reject_leave_requests", [], {
            leave_ids: ids,
            reason: this.state.rejectReason.trim(),
        });

        this.state.showRejectModal = false;
        this.state.rejectReason = "";
        this.state.rejectTargetId = null;

        if (this.state.showReviewModal) {
            this.state.showReviewModal = false;
        }

        this.notification.add(`${res.processed} leave request(s) rejected.`, { type: "info" });
        await this.loadRequests();
    }

    closeRejectModal() {
        this.state.showRejectModal = false;
    }

    // ═══════════════════════════════════════════════════════════════
    //  REVIEW REQUEST DETAIL MODAL (FR-114 to FR-137)
    // ═══════════════════════════════════════════════════════════════

    reviewRequest(id) {
        this.state.detailRequestId = id;
    }

    closeDetailModal() {
        this.state.detailRequestId = null;
    }

    async approveSelectedRequest() {
        if (!this.state.selectedRequest) return;
        await this.orm.call("hr.leave", "approve_single_request", [], { leave_id: this.state.selectedRequest.id });
        this.notification.add("Leave request approved.", { type: "success" });
        this.closeReviewModal();
        await this.loadRequests();
    }

    rejectSelectedRequest() {
        if (!this.state.selectedRequest) return;
        this.openSingleReject(this.state.selectedRequest.id);
    }

    // ═══════════════════════════════════════════════════════════════
    //  PAGINATION (FR-093 to FR-096)
    // ═══════════════════════════════════════════════════════════════

    async goToPage(page) {
        if (page < 1 || page > this.state.pageCount || page === this.state.page) return;
        this.state.page = page;
        await this.loadRequests();
    }

    async changePageSize(ev) {
        this.state.pageSize = Number(ev.target.value);
        this.state.page = 1;
        await this.loadRequests();
    }

    get visiblePages() {
        const total = this.state.pageCount;
        const current = this.state.page;
        const pages = [];
        const start = Math.max(1, current - 2);
        const end = Math.min(total, current + 2);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ADMIN CREATE LEAVE REQUEST MODAL (FR-101 to FR-112)
    // ═══════════════════════════════════════════════════════════════

    async openCreateModal() {
        const opts = await this.orm.call("hr.leave", "get_admin_create_options", []);
        this.state.createEmployees = opts.employees || [];
        this.state.createLeaveTypes = [];
        this.state.employeeSearch = "";
        this.state.employeeDropdownOpen = false;
        this.state.selectedEmployee = null;
        this.state.createForm = {
            employee_id: "",
            leave_type_id: "",
            date_from: "",
            date_to: "",
            admin_note: "",
            half_day: false,
            period: "am",
        };
        this.state.createPreview = null;
        this.state.showOverlapWarning = false;
        this.state.overrideConflict = false;
        this.state.showCreateModal = true;
    }

    closeCreateModal() {
        this.state.showCreateModal = false;
        this.state.employeeDropdownOpen = false;
    }

    get filteredEmployees() {
        const term = (this.state.employeeSearch || "").trim().toLowerCase();
        if (!term) {
            return this.state.createEmployees;
        }
        return this.state.createEmployees.filter((emp) => {
            const text = [emp.name, emp.department, emp.job_title]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return text.includes(term);
        });
    }

    openEmployeeDropdown() {
        this.state.employeeDropdownOpen = true;
    }

    onEmployeeSearchInput(ev) {
        this.state.employeeSearch = ev.target.value;
        this.state.employeeDropdownOpen = true;
    }

    async selectEmployee(employee) {
        this.state.selectedEmployee = employee;
        this.state.createForm.employee_id = employee.id;
        this.state.employeeSearch = employee.name;
        this.state.employeeDropdownOpen = false;

        this.state.createForm.leave_type_id = "";
        this.state.createLeaveTypes = [];
        this.state.createPreview = null;

        const types = await this.orm.call("hr.leave", "get_admin_leave_types_for_employee", [], { employee_id: employee.id });
        this.state.createLeaveTypes = types || [];
    }

    clearEmployee() {
        this.state.selectedEmployee = null;
        this.state.createForm.employee_id = "";
        this.state.employeeSearch = "";
        this.state.employeeDropdownOpen = false;

        this.state.createForm.leave_type_id = "";
        this.state.createLeaveTypes = [];
        this.state.createPreview = null;
    }

    async onDateOrTypeChange() {
        const f = this.state.createForm;
        if (f.employee_id && f.leave_type_id && f.date_from && f.date_to) {
            const preview = await this.orm.call("hr.leave", "preview_admin_leave_request", [], {
                employee_id: f.employee_id,
                leave_type_id: f.leave_type_id,
                date_from: f.date_from,
                date_to: f.date_to,
                half_day: f.half_day,
                period: f.period,
            });
            this.state.createPreview = preview;
            this.state.showOverlapWarning = preview.conflicts && preview.conflicts.length > 0;
        }
    }

    get selectedLeaveTypeInfo() {
        const typeId = Number(this.state.createForm.leave_type_id);
        if (!typeId) return null;
        return this.state.createLeaveTypes.find((lt) => lt.id === typeId) || null;
    }

    get isCreateFormValid() {
        const f = this.state.createForm;
        return (
            Boolean(f.employee_id) &&
            Boolean(f.leave_type_id) &&
            Boolean(f.date_from) &&
            Boolean(f.date_to) &&
            Boolean(f.admin_note && f.admin_note.trim().length >= 10)
        );
    }

    async confirmCreateRequest() {
        const f = this.state.createForm;
        if (!f.employee_id || !f.leave_type_id || !f.date_from || !f.date_to) {
            this.notification.add("Please fill in all required fields (Employee, Leave Type, Dates).", { type: "warning" });
            return;
        }
        if (!f.admin_note.trim() || f.admin_note.trim().length < 10) {
            this.notification.add("Admin Note / Reason must contain at least 10 characters.", { type: "warning" });
            return;
        }

        this.state.createSubmitting = true;
        try {
            const res = await this.orm.call("hr.leave", "create_admin_leave_request", [], {
                employee_id: f.employee_id,
                leave_type_id: f.leave_type_id,
                date_from: f.date_from,
                date_to: f.date_to,
                admin_note: f.admin_note.trim(),
                half_day: f.half_day,
                period: f.period,
                override_conflict: this.state.overrideConflict,
            });

            if (res.conflict && !res.created) {
                this.state.showOverlapWarning = true;
                this.notification.add("Overlapping leave request detected! Check the override box to proceed.", { type: "warning" });
                return;
            }

            if (res.created) {
                this.notification.add("Leave request created successfully on behalf of employee.", { type: "success" });
                this.closeCreateModal();
                await this.loadRequests();
            }
        } finally {
            this.state.createSubmitting = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  HEADER & NAVIGATION
    // ═══════════════════════════════════════════════════════════════

    toggleLeaveSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    }

    setViewMode(mode) {
        if (!["admin", "employee"].includes(mode)) return;
        this.state.viewMode = mode;
        if (mode === "employee") {
            this.notification.add("Employee preview view will be available when employee portal screens are loaded.", { type: "info" });
        }
    }

    openDashboard() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openLeaveRequests() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_requests_custom");
    }

    openLeaveTypes() {
        return this.action.doAction("hr_holidays.open_view_holiday_status");
    }

    openLeaveCalendar() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");
    }

    openLeaveBalances() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_balances_custom");
    }

    openReports() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom");
    }

    openSettings() {
        return this.action.doAction("base_setup.action_general_configuration");
    }

    openAuditLog() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_audit_custom");
    }

    openSetupExperience() {
        return this.action.doAction({
            type: "ir.actions.client",
            tag: "hr_leave_dashboard",
            params: { open_setup: true },
        });
    }
}

registry.category("actions").add("hr_leave_requests_page", LeaveRequestsPage);
