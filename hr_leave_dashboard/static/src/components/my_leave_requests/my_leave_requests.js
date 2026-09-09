/** @odoo-module **/
import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { EmployeeRequestModal } from "../employee_request_modal/employee_request_modal";
import { LeaveRequestDetailModal } from "../leave_request_detail/leave_request_detail";
import { CalendarSidebar } from "../calendar_sidebar";
import { LeaveRequestsPage } from "../../js/leave_requests";

export class MyLeaveRequestsPage extends Component {
    static template = "hr_leave_dashboard.MyLeaveRequestsPage";
    static components = { EmployeeRequestModal, LeaveRequestDetailModal, CalendarSidebar, LeaveRequestsPage };
    static props = {
        ...standardActionServiceProps,
        action: { type: Object, optional: true },
        className: { type: String, optional: true },
        embedded: { type: Boolean, optional: true },
        personalOnly: { type: Boolean, optional: true },
        "*": true,
    };
    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({
            loading: true,
            rows: [],
            counts: {},
            types: [],
            status: "all",
            // ── Top-level tab: "my" or "approvals" ──
            activeTab: this.props.action?.context?.request_workspace_tab || "my",
            // ── Sub-tab within "my": "pending" or "resolved" ──
            mySubTab: "pending",
            // ── Filters ──
            search: "",
            typeId: "",
            requestId: "",
            approverFilter: "",
            addedType: "",     // "" | "with_handover" | "without_handover"
            reasonFilter: "",
            dateFrom: "",
            dateTo: "",
            showFilters: false,
            // ── Modals ──
            requestOpen: false,
            initial: null,
            existingRequestId: null,
            detailId: null,
            detailReadOnly: true,
            cancelId: null,
            cancelReason: "",
            cancelError: "",
            escalateId: null,
            escalationNote: "",
            escalationError: "",
            // ── Access ──
            access: { has_personal_scope: false, can_approve: false, can_operate: false },
            // ── Approval data ──
            approvalRows: [],
        });

        onWillStart(() => this.load());
    }

    // ═══════════════════════════════════════════════════════════
    //  DATA
    // ═══════════════════════════════════════════════════════════

    async load() {
        this.state.loading = true;
        try {
            const [data, access] = await Promise.all([
                this.orm.call("hr.leave", "get_my_leave_requests", [this.state.status, this.state.search, this.state.typeId || false]),
                this.orm.call("hr.leave", "get_leave_access_profile", []),
            ]);
            this.state.rows = data.rows || [];
            this.state.counts = data.counts || {};
            this.state.types = data.leave_types || [];
            const scopedAccess = this.props.personalOnly
                ? { ...access, can_approve: false, can_operate: false }
                : access;
            this.state.access = scopedAccess;
            this.state.approvalRows = scopedAccess.can_approve
                ? (await this.orm.call("hr.leave", "get_pending_my_leave_approvals", [])).rows || []
                : [];
            // Ensure active tab is valid for available views
            const availableTabs = [];
            if (scopedAccess.has_personal_scope) availableTabs.push("my");
            if (scopedAccess.can_approve) availableTabs.push("approvals");
            if (scopedAccess.can_operate) availableTabs.push("records");
            if (!availableTabs.includes(this.state.activeTab)) {
                this.state.activeTab = availableTabs[0] || "my";
            }
            this.emitRequestContext();
        } finally {
            this.state.loading = false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  COMPUTED
    // ═══════════════════════════════════════════════════════════

    get hasBothTabs() {
        return this.state.access.has_personal_scope && this.state.access.can_approve;
    }

    get onlyMyRequests() {
        return this.state.access.has_personal_scope && !this.state.access.can_approve;
    }

    get pendingCount() {
        return (this.state.counts.pending || 0) + (this.state.counts.changes_requested || 0);
    }

    get resolvedCount() {
        return (this.state.counts.approved || 0) + (this.state.counts.rejected || 0) + (this.state.counts.cancelled || 0);
    }

    get filteredMyRows() {
        let rows = this.state.rows;
        // Sub-tab filter
        if (this.state.mySubTab === "pending") {
            rows = rows.filter(r => r.status === "pending" || r.status === "changes_requested");
        } else {
            rows = rows.filter(r => r.status === "approved" || r.status === "rejected" || r.status === "cancelled");
        }
        // Additional filters
        rows = this._applyFilters(rows);
        return rows;
    }

    get filteredApprovalRows() {
        return this._applyFilters(this.state.approvalRows);
    }

    _applyFilters(rows) {
        const { requestId, approverFilter, addedType, reasonFilter, dateFrom, dateTo } = this.state;
        if (requestId) {
            const q = requestId.toLowerCase();
            rows = rows.filter(r => {
                const ref = (r.reference || r.request_ref || "").toLowerCase();
                return ref.includes(q);
            });
        }
        if (approverFilter) {
            const q = approverFilter.toLowerCase();
            rows = rows.filter(r => {
                const name = (r.approver || (r.employee && r.employee.approver) || "").toLowerCase();
                return name.includes(q);
            });
        }
        if (addedType === "with_handover") {
            rows = rows.filter(r => r.handover_enabled);
        } else if (addedType === "without_handover") {
            rows = rows.filter(r => !r.handover_enabled);
        }
        if (reasonFilter) {
            const q = reasonFilter.toLowerCase();
            rows = rows.filter(r => {
                const reason = (r.reason || r.notes || "").toLowerCase();
                return reason.includes(q);
            });
        }
        if (dateFrom) {
            rows = rows.filter(r => (r.date_from || r.date_to || "") >= dateFrom);
        }
        if (dateTo) {
            rows = rows.filter(r => (r.date_to || r.date_from || "") <= dateTo);
        }
        return rows;
    }

    // ═══════════════════════════════════════════════════════════
    //  TAB & FILTER ACTIONS
    // ═══════════════════════════════════════════════════════════

    setTab(tab) {
        this.state.activeTab = tab;
        this.emitRequestContext();
    }

    setMySubTab(sub) {
        this.state.mySubTab = sub;
    }

    async setStatus(status) {
        this.state.status = status;
        await this.load();
    }

    toggleFilters() {
        this.state.showFilters = !this.state.showFilters;
    }

    clearFilters() {
        this.state.search = "";
        this.state.typeId = "";
        this.state.requestId = "";
        this.state.approverFilter = "";
        this.state.addedType = "";
        this.state.reasonFilter = "";
        this.state.dateFrom = "";
        this.state.dateTo = "";
        this.load();
    }

    onSearchKeydown(ev) {
        if (ev.key === "Enter") this.load();
    }

    // ═══════════════════════════════════════════════════════════
    //  CONTEXT EMITTER
    // ═══════════════════════════════════════════════════════════

    emitRequestContext() {
        const titles = { my: "My Leave Requests", approvals: "Leave Approvals", records: "Leave Records" };
        window.dispatchEvent(new CustomEvent("cleon-ai-context", { detail: {
            screen: this.state.activeTab === "records" ? "leave.requests.admin" : "leave.requests",
            title: titles[this.state.activeTab] || "Leave Requests",
            view: this.state.activeTab,
            status: this.state.status,
            search: this.state.search,
            leave_type_id: this.state.typeId || false,
        }}));
    }

    // ═══════════════════════════════════════════════════════════
    //  REQUEST ACTIONS
    // ═══════════════════════════════════════════════════════════

    openNew() { this.state.initial = null; this.state.existingRequestId = null; this.state.requestOpen = true; }
    closeNew() { this.state.requestOpen = false; this.state.existingRequestId = null; }
    view(id) { this.state.detailReadOnly = true; this.state.detailId = id; }
    viewApproval(id) { this.state.detailReadOnly = false; this.state.detailId = id; }
    closeDetail() { this.state.detailId = null; }

    async approveApproval(id) {
        await this.orm.call("hr.leave", "approve_single_request", [id]);
        this.notification.add("Leave request approved.", { type: "success" });
        await this.load();
    }

    resubmit(row) {
        this.state.initial = {
            _existing_request_id: row.id,
            leave_type_id: String(row.leave_type_id),
            date_from: row.date_from, date_to: row.date_to,
            reason: row.reason,
            handover_enabled: row.handover_enabled,
            backup_colleague_ids: row.backup_colleague_ids || [],
            emergency_contact: row.emergency_contact || "",
            handover_notes: row.handover_notes || "",
        };
        this.state.existingRequestId = row.id;
        this.state.requestOpen = true;
    }

    // ── Cancel Modal ──
    openCancel(id) { this.state.cancelId = id; this.state.cancelReason = ""; this.state.cancelError = ""; }
    closeCancel() { this.state.cancelId = null; }
    async cancel() {
        const result = await this.orm.call("hr.leave", "cancel_my_pending_leave", [this.state.cancelId, this.state.cancelReason]);
        if (!result.ok) { this.state.cancelError = result.message; return; }
        this.notification.add(result.message, { type: "success" });
        this.closeCancel();
        await this.load();
    }

    // ── Escalate Modal ──
    openEscalate(id) { this.state.escalateId = id; this.state.escalationNote = ""; this.state.escalationError = ""; }
    closeEscalate() { this.state.escalateId = null; }
    async escalate() {
        const result = await this.orm.call("hr.leave", "escalate_my_leave_request", [this.state.escalateId, this.state.escalationNote]);
        if (!result.ok) { this.state.escalationError = result.message; return; }
        this.notification.add(result.message, { type: "success" });
        this.closeEscalate();
        await this.load();
    }

    // ═══════════════════════════════════════════════════════════
    //  UTILS
    // ═══════════════════════════════════════════════════════════

    formatDate(value) {
        return value ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
    }

    formatSubmitted(value) {
        return value ? new Date(value.replace(" ", "T") + "Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
    }

    statusLabel(status) {
        const labels = {
            pending: "Pending Approval",
            approved: "Approved",
            rejected: "Rejected",
            changes_requested: "Changes Requested",
            cancelled: "Cancelled",
        };
        return labels[status] || status;
    }

    exportCsv() {
        const rows = [
            ["Request ID", "Leave Type", "Start", "End", "Duration", "Reason", "Status", "Approver", "Submitted"],
            ...this.state.rows.map(r => [r.reference, r.leave_type, r.date_from, r.date_to, r.duration, r.reason, r.status, r.approver, r.submitted]),
        ];
        const q = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
        const blob = new Blob(["\uFEFF" + rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "my_leave_requests.csv";
        a.click();
        URL.revokeObjectURL(a.href);
    }

    openDashboard() { this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard"); }
    openCalendar() { this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar"); }
    openReports() { this.notification.add("Employee leave reports will be available from this menu in the employee reporting screen.", { type: "info" }); }
}
registry.category("actions").add("hr_leave_dashboard.MyLeaveRequests", MyLeaveRequestsPage);
