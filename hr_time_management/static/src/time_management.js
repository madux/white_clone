/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { EmployeeLeaveDashboard } from "@hr_leave_dashboard/components/employee_dashboard/employee_dashboard";
import { MyLeaveRequestsPage } from "@hr_leave_dashboard/components/my_leave_requests/my_leave_requests";
import { LeaveCalendarPage } from "@hr_leave_dashboard/js/leave_calendar";

export class TimeManagementApp extends Component {
    static template = "hr_time_management.App";
    static props = ["*"];
    static components = { EmployeeLeaveDashboard, MyLeaveRequestsPage, LeaveCalendarPage };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.user = useService("user");
        const now = new Date();
        const iso = now.toISOString().slice(0, 10);
        this.state = useState({
            gateway: true, feature: "attendance", page: "dashboard", loading: false, rows: [], counts: {}, attendanceRate: 0,
            departments: [], shifts: [], status: "all", search: "", departmentId: "",
            dateFrom: iso, dateTo: iso, detail: null, edit: null, editReason: "", error: "", gatewayMessage: "",
            isManager: false, mode: "admin", isPortal: false, employeeData: null, employeePage: "clock", busy: false,
            profileOpen: true, leaveOpen: true, timeOpen: true,
            regularizations: [], regularization: null, regularizationDetail: null,
            managerDecision: "", regularizationFilter: "all",
            policy: {},
            featureAccess: {attendance: true, shift: true, tracking: true, overtime: true},
            moduleDropdown: false,
            shiftPage: "dashboard", shiftData: {shifts: [], assignments: [], employees: [], departments: [], kpis: {}},
            shiftSearch: "", shiftStatus: "all", shiftDetail: null, shiftForm: null,
            assignmentForm: null,
            trackingPage: "dashboard", trackingState: "all", trackingSearch: "",
            trackingData: {rows: [], kpis: {}}, timesheetDetail: null, timesheetDecision: null,
            overtimePage: "dashboard", overtimeState: "all", overtimeSearch: "",
            overtimeData: {rows: [], kpis: {}}, overtimeDetail: null,
            employeeOvertime: {rows: [], kpis: {}}, overtimeForm: null, overtimeDecision: null,
        });
        onWillStart(async () => {
            const access = await this.orm.call("hr.attendance", "get_cleon_access", []);
            const forceEmployeePortal = Boolean(this.props.action?.params?.force_employee_portal);
            this.state.isManager = access.is_manager;
            this.state.featureAccess = access.features || this.state.featureAccess;
            const savedFeature = window.sessionStorage.getItem("cleonhr_time_feature");
            if (savedFeature && this.state.featureAccess[savedFeature]) this.state.feature = savedFeature;
            this.state.isPortal = forceEmployeePortal || !access.is_manager;
            const savedMode = window.localStorage.getItem("cleonhr_interface_mode");
            this.state.mode = !forceEmployeePortal && access.is_manager && savedMode !== "employee" ? "admin" : "employee";
            this.state.gateway = access.is_manager && this.state.mode === "admin";
            this.state.employeePage = this.state.isPortal ? "dashboard" : "clock";
            await this.load();
        });
        this.onInterfaceModeChange = async (event) => {
            await this.setMode(event.detail?.mode || "employee", false);
        };
        this.onFeatureShortcut = (event) => {
            if (event.altKey && event.key.toLowerCase() === "t" && this.state.mode === "admin") {
                event.preventDefault();
                this.showGateway();
            }
        };
        onMounted(() => {
            window.addEventListener("cleonhr-interface-mode-change", this.onInterfaceModeChange);
            window.addEventListener("keydown", this.onFeatureShortcut);
            document.documentElement.classList.toggle("has-cleon-employee-portal", this.state.isPortal);
            this.employeeRefreshTimer = window.setInterval(() => {
                if (this.state.mode === "employee" && !this.state.busy && !this.state.loading) {
                    this.load();
                }
            }, 30000);
        });
        onWillUnmount(() => {
            window.removeEventListener("cleonhr-interface-mode-change", this.onInterfaceModeChange);
            window.removeEventListener("keydown", this.onFeatureShortcut);
            window.clearInterval(this.employeeRefreshTimer);
        });
    }

    async load() {
        this.state.loading = true;
        try {
            if (this.state.mode === "employee") {
                this.state.employeeData = await this.orm.call("hr.attendance", "get_cleon_employee_data", []);
                if (this.state.employeePage === "overtime") {
                    this.state.employeeOvertime = await this.orm.call("cleon.overtime.request", "get_my_overtime", []);
                }
                return;
            }
            if (this.state.feature === "shift") {
                this.state.shiftData = await this.orm.call("cleon.hr.shift", "get_shift_management_data", []);
                return;
            }
            if (this.state.feature === "tracking") {
                this.state.trackingData = await this.orm.call("cleon.time.sheet", "get_tracking_data", [], {
                    page: this.state.trackingPage, state: this.state.trackingState, search: this.state.trackingSearch,
                });
                return;
            }
            if (this.state.feature === "overtime") {
                this.state.overtimeData = await this.orm.call("cleon.overtime.request", "get_overtime_data", [], {
                    page: this.state.overtimePage, state: this.state.overtimeState, search: this.state.overtimeSearch,
                });
                return;
            }
            const data = await this.orm.call("hr.attendance", "get_cleon_time_data", [], {
                view: this.state.page, date_from: this.state.dateFrom, date_to: this.state.dateTo,
                department_id: this.state.departmentId || false, search: this.state.search,
            });
            this.state.rows = data.rows; this.state.counts = data.counts;
            this.state.attendanceRate = data.attendance_rate;
            this.state.departments = data.departments; this.state.shifts = data.shifts;
        } catch (error) {
            this.notification.add(error?.data?.message || "Could not load attendance data.", { type: "danger" });
        } finally { this.state.loading = false; }
    }

    async setMode(mode, broadcast = true) {
        if (mode === "admin" && !this.state.isManager) return;
        this.state.mode = mode; this.state.gateway = false;
        window.localStorage.setItem("cleonhr_interface_mode", mode);
        if (broadcast) {
            window.dispatchEvent(new CustomEvent("cleonhr-interface-mode-change", {detail: {mode}}));
        }
        this.state.employeePage = "clock"; await this.load();
    }
    async setEmployeePage(page) { this.state.employeePage = page; await this.load(); }
    get calendarBlanks() {
        return Array.from({length: this.state.employeeData?.calendar?.leading_blanks || 0});
    }
    formatHour(value) {
        const hours = Math.floor(Number(value || 0));
        const minutes = Math.round((Number(value || 0) - hours) * 60);
        const suffix = hours >= 12 ? "PM" : "AM";
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
    }
    togglePortalSection(section) { this.state[`${section}Open`] = !this.state[`${section}Open`]; }
    showPortalLeave(page) { this.state.leaveOpen = true; this.state.employeePage = page; }
    openPortalAction(action) {
        window.localStorage.setItem("cleonhr_interface_mode", "employee");
        document.documentElement.classList.add("has-cleon-employee-portal");
        return this.action.doAction(action, {clearBreadcrumbs: true});
    }
    openLeaveDashboard() { return this.openPortalAction("hr_leave_dashboard.action_hr_leave_employee_dashboard"); }
    openLeaveRequests() { return this.openPortalAction("hr_leave_dashboard.action_hr_leave_my_requests"); }
    openLeaveCalendar() { return this.openPortalAction("hr_leave_dashboard.action_hr_leave_calendar"); }
    openTimesheets() {
        return this.action.doAction("hr_timesheet.act_hr_timesheet_line", {clearBreadcrumbs: true});
    }
    deferredFeature(name) {
        this.notification.add(`${name} is recorded in the implementation backlog and will be enabled with its approved workflow screen.`, {
            type: "info",
        });
    }
    newRegularization() {
        const today = new Date().toISOString().slice(0, 10);
        this.state.regularization = {
            attendance_date: today, issue_type: "forgot_in",
            requested_check_in: `${today}T09:00`, requested_check_out: `${today}T17:00`, reason: "",
        };
        this.state.error = "";
    }
    closeRegularization() { this.state.regularization = null; this.state.error = ""; }
    syncRegularizationDate() {
        const date = this.state.regularization.attendance_date;
        this.state.regularization.requested_check_in = `${date}T09:00`;
        this.state.regularization.requested_check_out = `${date}T17:00`;
    }
    async loadRegularizations(manager = false) {
        this.state.regularizations = await this.orm.call(
            "cleon.attendance.regularization", manager ? "get_manager_requests" : "get_my_requests", []
        );
    }
    async openRegularizations(manager = false) {
        if (manager) { this.state.page = "regularizations"; }
        else { this.state.employeePage = "regularizations"; }
        try { await this.loadRegularizations(manager); }
        catch (error) { this.notification.add(error?.data?.message || "Could not load correction requests.", {type:"danger"}); }
    }
    async submitRegularization() {
        const values = this.state.regularization;
        if ((values.reason || "").trim().length < 20) {
            this.state.error = "Please provide a reason of at least 20 characters."; return;
        }
        try {
            await this.orm.call("cleon.attendance.regularization", "submit_request", [values]);
            this.closeRegularization();
            await this.loadRegularizations(false);
            this.notification.add("Regularization request submitted successfully. You will be notified once reviewed.", {type:"success"});
        } catch (error) { this.state.error = error?.data?.message || "The correction request could not be submitted."; }
    }
    async withdrawRegularization(request) {
        if (!window.confirm("Are you sure? This will return the request to draft.")) return;
        try {
            await this.orm.call("cleon.attendance.regularization", "withdraw_request", [request.id]);
            await this.loadRegularizations(false);
            this.notification.add("Regularization request withdrawn.", {type:"success"});
        } catch (error) { this.notification.add(error?.data?.message || "Request could not be withdrawn.", {type:"danger"}); }
    }
    async decideRegularization(request, decision) {
        const comment = window.prompt(decision === "approve" ? "Approval comment (optional)" : "Rejection reason", "");
        if (comment === null) return;
        if (decision === "reject" && !comment.trim()) {
            this.notification.add("A rejection reason is required.", {type:"warning"}); return;
        }
        try {
            await this.orm.call("cleon.attendance.regularization", "manager_decide", [request.id, decision, comment]);
            await this.loadRegularizations(true);
            this.notification.add(`Regularization request ${decision === "approve" ? "approved and attendance updated" : "rejected"}.`, {type:"success"});
        } catch (error) { this.notification.add(error?.data?.message || "The decision could not be saved.", {type:"danger"}); }
    }
    viewRegularization(request) { this.state.regularizationDetail = request; }
    closeRegularizationDetail() { this.state.regularizationDetail = null; }
    get filteredRegularizations() {
        return this.state.regularizationFilter === "all" ? this.state.regularizations :
            this.state.regularizations.filter(item => item.state === this.state.regularizationFilter);
    }
    async toggleAttendance() {
        if (this.state.busy) return;
        this.state.busy = true;
        try {
            const wasCheckedIn = this.state.employeeData?.attendance_state === "checked_in";
            this.state.employeeData = await this.orm.call("hr.attendance", "cleon_toggle_attendance", []);
            const row = this.state.employeeData.today;
            this.notification.add(
                wasCheckedIn ? `Clocked out successfully. Total hours: ${row?.hours || 0}.` : `Clocked in successfully at ${row?.check_in || "now"}.`,
                {type: "success"}
            );
        } catch (error) { this.notification.add(error?.data?.message || "Attendance could not be recorded.", {type:"danger"}); }
        finally { this.state.busy = false; }
    }
    async openSettings() {
        this.state.page = "settings";
        this.state.policy = await this.orm.call("cleon.time.policy", "get_cleon_policy", []);
    }
    async savePolicy() {
        try {
            this.state.policy = await this.orm.call("cleon.time.policy", "save_cleon_policy", [this.state.policy]);
            this.notification.add("Time Management policy saved.", {type:"success"});
        } catch (error) { this.notification.add(error?.data?.message || "Policy could not be saved.", {type:"danger"}); }
    }

    get filteredRows() {
        return this.state.status === "all" ? this.state.rows : this.state.rows.filter(row => row.status === this.state.status);
    }
    label(status) { return ({present:"Present", late:"Late", half_day:"Half-day", absent:"Absent", on_leave:"On Leave", weekend:"Weekend Overtime", holiday:"Holiday Overtime", daily:"Daily Overtime", special:"Special Assignment", on_call:"On-call Work", future:"Not yet recorded", auto:"Auto-calculated", submitted:"Pending Approval", approved:"Approved", rejected:"Rejected", correction:"Corrections Requested", withdrawn:"Withdrawn", draft:"Draft"})[status] || status; }
    selectAttendance() { this.selectFeature("attendance"); }
    selectFeature(feature) {
        if (!this.state.featureAccess[feature]) {
            this.state.gatewayMessage = "Contact your administrator for access.";
            return;
        }
        this.state.feature = feature;
        window.sessionStorage.setItem("cleonhr_time_feature", feature);
        this.state.gateway = false;
        this.state.gatewayMessage = "";
        this.state.page = "dashboard";
        this.load();
    }
    featureName(feature = this.state.feature) { return ({attendance:"Attendance Management", shift:"Shift Management", tracking:"Time Tracking", overtime:"Overtime Management"})[feature]; }
    featureIcon(feature = this.state.feature) {
        return ({
            attendance: "fa-calendar",
            shift: "fa-clock-o",
            tracking: "fa-list-alt",
            overtime: "fa-hourglass-half",
        })[feature];
    }
    showGateway() {
        if (this.state.mode === "admin") {
            this.state.gatewayMessage = "";
            this.state.gateway = true;
        }
    }
    toggleModuleDropdown() {
        this.state.moduleDropdown = !this.state.moduleDropdown;
    }
    closeModuleDropdown() {
        this.state.moduleDropdown = false;
    }
    async selectFeatureFromDropdown(feature) {
        this.state.moduleDropdown = false;
        await this.selectFeature(feature);
    }
    setShiftPage(page) { this.state.shiftPage = page; this.state.shiftDetail = null; }
    async setTrackingPage(page) { this.state.trackingPage = page; await this.load(); }
    async setTrackingState(status) { this.state.trackingState = status; await this.load(); }
    async applyTrackingFilters() { await this.load(); }
    decideTimesheet(sheet, decision) {
        this.state.timesheetDecision = {sheet, decision, comment: "", busy: false};
    }
    closeTimesheetDecision() { this.state.timesheetDecision = null; }
    async confirmTimesheetDecision() {
        const dialog = this.state.timesheetDecision;
        if (!dialog) return;
        if (["reject", "request_changes"].includes(dialog.decision) && !dialog.comment.trim()) {
            this.notification.add("Add a reason for this decision.", {type: "warning"}); return;
        }
        dialog.busy = true;
        try {
            await this.orm.call("cleon.time.sheet", "manager_decide", [dialog.sheet.id, dialog.decision, dialog.comment]);
            const outcome = dialog.decision === "approve" ? "approved" : dialog.decision === "reject" ? "rejected" : "returned for corrections";
            this.closeTimesheetDecision();
            this.closeTimesheetDetail();
            await this.load();
            this.notification.add(`Timesheet for ${dialog.sheet.employee} ${outcome}.`, {type: "success"});
        } catch (error) {
            this.notification.add(error?.data?.message || "The timesheet decision could not be saved.", {type: "danger"});
            dialog.busy = false;
        }
    }
    viewTimesheet(sheet) { this.state.timesheetDetail = sheet; }
    closeTimesheetDetail() { this.state.timesheetDetail = null; }
    get trackingRows() {
        const rows = this.state.trackingData.rows || [];
        return this.state.trackingPage === "dashboard"
            ? rows.filter((row) => row.state === "submitted")
            : rows;
    }
    exportTimesheets() {
        const rows = this.trackingRows;
        const csv = [["Employee", "Department", "Week", "Hours", "Billable", "Variance", "Status"], ...rows.map(row => [row.employee, row.department, row.week, row.total, row.billable, row.variance, row.state])]
            .map(line => line.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"}));
        link.download = "team-timesheets.csv"; link.click(); URL.revokeObjectURL(link.href);
    }
    async setOvertimePage(page) { this.state.overtimePage = page; await this.load(); }
    async setOvertimeState(status) { this.state.overtimeState = status; await this.load(); }
    async applyOvertimeFilters() { await this.load(); }
    viewOvertime(request) { this.state.overtimeDetail = request; }
    closeOvertimeDetail() { this.state.overtimeDetail = null; }
    openOvertimeForm() {
        const date = new Date().toISOString().slice(0, 10);
        this.state.overtimeForm = {date, start_time: `${date}T17:00`, end_time: `${date}T18:00`, category: "daily", justification: ""};
    }
    closeOvertimeForm() { this.state.overtimeForm = null; }
    async submitOvertime() {
        const form = this.state.overtimeForm;
        if (!form) return;
        if ((form.justification || "").trim().length < 30) {
            this.notification.add("Justification must contain at least 30 characters.", {type: "warning"}); return;
        }
        try {
            this.state.busy = true;
            const result = await this.orm.call("cleon.overtime.request", "submit_manual_request", [{...form}]);
            this.closeOvertimeForm(); await this.load();
            this.notification.add(`Overtime request ${result.name} submitted successfully.`, {type: "success"});
        } catch (error) {
            this.notification.add(error?.data?.message || "The overtime request could not be submitted.", {type: "danger"});
        } finally { this.state.busy = false; }
    }
    async withdrawOvertime(request) {
        if (!window.confirm(`Withdraw overtime request ${request.name}?`)) return;
        try {
            await this.orm.call("cleon.overtime.request", "withdraw_request", [request.id]);
            await this.load(); this.notification.add("Overtime request withdrawn.", {type: "success"});
        } catch (error) {
            this.notification.add(error?.data?.message || "The request could not be withdrawn.", {type: "danger"});
        }
    }
    decideOvertime(request, decision) {
        this.state.overtimeDecision = {request, decision, comment: ""};
    }
    closeOvertimeDecision() { this.state.overtimeDecision = null; }
    async confirmOvertimeDecision() {
        const dialog = this.state.overtimeDecision;
        if (!dialog) return;
        const {request, decision} = dialog;
        const comment = (dialog.comment || "").trim();
        if (decision === "reject" && !comment) {
            this.notification.add("A rejection reason is required.", {type: "warning"}); return;
        }
        try {
            this.state.busy = true;
            await this.orm.call("cleon.overtime.request", "manager_decide", [request.id, decision, comment]);
            this.closeOvertimeDecision();
            this.closeOvertimeDetail();
            await this.load();
            this.notification.add(`Overtime request ${decision === "approve" ? "approved" : "rejected"} for ${request.employee}.`, {type: "success"});
        } catch (error) {
            this.notification.add(error?.data?.message || "The overtime decision could not be saved.", {type: "danger"});
        } finally { this.state.busy = false; }
    }
    get overtimeRows() {
        const rows = this.state.overtimeData.rows || [];
        return this.state.overtimePage === "dashboard"
            ? rows.filter((row) => ["auto", "submitted"].includes(row.state)).slice(0, 8)
            : rows;
    }
    exportOvertime() {
        const rows = this.state.overtimeData.rows || [];
        const csv = [["Reference", "Employee", "Department", "Date", "Regular Hours", "Overtime Hours", "Category", "Source", "Status", "Estimated Cost"], ...rows.map(row => [row.name, row.employee, row.department, row.date, row.regular_hours, row.hours, row.category, row.source, row.state, row.cost])]
            .map(line => line.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"}));
        link.download = "overtime-report.csv"; link.click(); URL.revokeObjectURL(link.href);
    }
    get filteredShifts() {
        const query = this.state.shiftSearch.trim().toLowerCase();
        return (this.state.shiftData.shifts || []).filter(shift =>
            (this.state.shiftStatus === "all" || (this.state.shiftStatus === "active") === shift.active) &&
            (!query || shift.name.toLowerCase().includes(query) || shift.code.toLowerCase().includes(query))
        );
    }
    shiftColor(index) { return ["orange", "blue", "purple", "indigo", "pink", "gray"][index % 6]; }
    dayLabel(day) { return ["M", "T", "W", "T", "F", "S", "S"][day]; }
    timeToFloat(value) {
        const [hours, minutes] = String(value || "00:00").split(":").map(Number);
        return hours + minutes / 60;
    }
    floatToTime(value) {
        const minutes = Math.round(Number(value || 0) * 60);
        return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    newShift(shift = null) {
        this.state.error = "";
        this.state.shiftForm = shift ? {
            ...shift, start_time: this.floatToTime(shift.start_hour), end_time: this.floatToTime(shift.end_hour),
            active_days: [...shift.active_days],
        } : {
            name: "", code: "", active: true, start_time: "09:00", end_time: "17:00",
            break_minutes: 60, grace_minutes: 15, shift_type: "fixed", recurrence: "weekly",
            active_days: [0, 1, 2, 3, 4],
        };
    }
    closeShiftForm() { this.state.shiftForm = null; this.state.error = ""; }
    toggleShiftDay(day) {
        const days = this.state.shiftForm.active_days;
        this.state.shiftForm.active_days = days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort();
    }
    async saveShift() {
        const form = this.state.shiftForm;
        if (!form.name.trim()) { this.state.error = "Shift name is required."; return; }
        if (!form.active_days.length) { this.state.error = "Select at least one active day."; return; }
        try {
            await this.orm.call("cleon.hr.shift", "save_shift", [{
                id: form.id || false, name: form.name.trim(), code: form.code,
                active: form.active, start_hour: this.timeToFloat(form.start_time), end_hour: this.timeToFloat(form.end_time),
                break_minutes: Number(form.break_minutes), grace_minutes: Number(form.grace_minutes),
                shift_type: form.shift_type, recurrence: form.recurrence, active_days: form.active_days,
            }]);
            this.closeShiftForm(); await this.load();
            this.notification.add(`Shift ${form.id ? "updated" : "created"} successfully and ready for assignment.`, {type:"success"});
        } catch (error) { this.state.error = error?.data?.message || "The shift could not be saved."; }
    }
    viewShift(shift) { this.state.shiftDetail = shift; }
    closeShiftDetail() { this.state.shiftDetail = null; }
    showShiftAssignments() {
        this.closeShiftDetail();
        this.setShiftPage("assignments");
    }
    get shiftDetailAssignments() {
        return this.state.shiftDetail ? (this.state.shiftData.assignments || []).filter(row => row.shift_id === this.state.shiftDetail.id) : [];
    }
    newAssignment() {
        this.state.error = "";
        this.state.assignmentForm = {
            scope: "employee", employee_id: "", department_id: "", shift_id: "",
            date_from: new Date().toISOString().slice(0, 10), date_to: "", note: "",
        };
    }
    closeAssignmentForm() { this.state.assignmentForm = null; this.state.error = ""; }
    async saveAssignment() {
        const form = this.state.assignmentForm;
        if (!form.shift_id || (form.scope === "employee" ? !form.employee_id : !form.department_id)) {
            this.state.error = "Select a shift and the employee or department to assign."; return;
        }
        try {
            await this.orm.call("cleon.hr.shift.assignment", "create_shift_assignment", [{
                shift_id: form.shift_id, employee_id: form.scope === "employee" ? form.employee_id : false,
                department_id: form.scope === "department" ? form.department_id : false,
                date_from: form.date_from, date_to: form.date_to, note: form.note,
            }]);
            this.closeAssignmentForm(); await this.load();
            this.notification.add("Shift assignment saved successfully.", {type:"success"});
        } catch (error) { this.state.error = error?.data?.message || "The shift assignment could not be saved."; }
    }
    setPage(page) {
        this.state.page = page; this.state.status = "all"; this.state.detail = null;
        if (page === "sheet") {
            const today = new Date();
            this.state.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1, 12).toISOString().slice(0, 10);
            this.state.dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12).toISOString().slice(0, 10);
        }
        this.load();
    }
    setStatus(status) { this.state.status = status; }
    openDetail(row) { this.state.detail = row; }
    closeDetail() { this.state.detail = null; }
    openEdit(row) { this.state.edit = {...row}; this.state.editReason = ""; this.state.error = ""; }
    closeEdit() { this.state.edit = null; this.state.error = ""; }
    async applyFilters() { await this.load(); }

    localInput(value) {
        if (!value) return "";
        const date = new Date(value.replace(" ", "T") + "Z");
        const offset = date.getTimezoneOffset();
        return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
    }
    serverDatetime(value) {
        if (!value) return false;
        return new Date(value).toISOString().slice(0, 19).replace("T", " ");
    }
    async saveEdit() {
        if (!this.state.editReason.trim()) { this.state.error = "A reason is required for audit and compliance."; return; }
        try {
            await this.orm.call("hr.attendance", "cleon_update_attendance", [[this.state.edit.id], {
                check_in: this.serverDatetime(this.state.edit.check_in_input),
                check_out: this.serverDatetime(this.state.edit.check_out_input),
                cleon_break_minutes: Number(this.state.edit.break_minutes || 0),
                cleon_status_override: this.state.edit.status,
                cleon_shift_id: this.state.edit.shift_id || false,
            }, this.state.editReason]);
            this.notification.add("Attendance record updated and added to the audit trail.", { type: "success" });
            this.closeEdit(); await this.load();
        } catch (error) { this.state.error = error?.data?.message || "The attendance record could not be updated."; }
    }
    beginEdit(row) {
        this.openEdit({...row, check_in_input: this.localInput(row.check_in_raw), check_out_input: this.localInput(row.check_out_raw)});
    }
    exportCsv() {
        const header = ["Employee","Employee ID","Department","Date","Clock In","Clock Out","Hours","Status"];
        const lines = this.filteredRows.map(r => [r.employee,r.employee_code,r.department,r.date,r.check_in,r.check_out,r.hours,this.label(r.status)]);
        const csv = [header, ...lines].map(line => line.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
        link.download = `attendance-${this.state.dateFrom}.csv`; link.click(); URL.revokeObjectURL(link.href);
    }
}

registry.category("actions").add("hr_time_management.App", TimeManagementApp);
