/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class TimeManagementApp extends Component {
    static template = "hr_time_management.App";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.user = useService("user");
        this.Math = Math;
        this.String = String;
        const now = new Date();
        const iso = now.toISOString().slice(0, 10);
        this.state = useState({
            gateway: true, feature: "attendance", page: "dashboard", loading: false, rows: [], counts: {}, attendanceRate: 0,
            departments: [], shifts: [], status: "all", search: "", departmentId: "",
            dateFrom: iso, dateTo: iso, detail: null, edit: null, editReason: "", error: "", gatewayMessage: "",
            isManager: false, mode: "admin", isPortal: false, employeeData: null, employeePage: "dashboard", busy: false,
            regularizations: [], regularization: null, regularizationDetail: null,
            managerDecision: "", regularizationFilter: "all",
            policy: {},
            featureAccess: {attendance: true, shift: true, tracking: true, overtime: true},
            portalModules: {leave: false, time: true}, canSwitchInterface: false,
            moduleDropdown: false,
            settingsTab: "overview",
            attSubTab: "policy",
            shiftSubTab: "templates",
            otSubTab: "policies",
            trackingSubTab: "time_logs",
            otCalcHours: 0,
            otCalcRate: 0,
            otPayrollSyncEnabled: true,
            jobsTasksList: [
                { id: 1, name: "Software Development", code: "DEV", department: "IT", tasks: ["Frontend", "Backend", "Testing"] },
                { id: 2, name: "Client Support", code: "SUP", department: "Support", tasks: ["Email Support", "Phone Support"] }
            ],
            jobModal: null,
            taskModal: null,
            timesheetReminders: ["Wednesday 16:00", "Friday 14:00"],
            regChainSummary: null,
            otChainSummary: null,
            settingsOverview: null,
            settingsShifts: [],
            settingsShiftForm: null,
            shiftPage: "dashboard", shiftData: {shifts: [], assignments: [], employees: [], departments: [], kpis: {}},
            employeeShiftSwaps: [],
            shiftSearch: "", shiftStatus: "all", shiftDetail: null, shiftForm: null,
            assignmentForm: null,
            trackingPage: "dashboard", trackingState: "all", trackingSearch: "",
            trackingData: {rows: [], kpis: {}}, timesheetDetail: null, timesheetDecision: null,
            overtimePage: "dashboard", overtimeState: "all", overtimeSearch: "",
            overtimeData: {rows: [], kpis: {}}, overtimeDetail: null,
            employeeOvertime: {rows: [], kpis: {}}, overtimeForm: null, overtimeDecision: null,
            wizardData: null, currentWizardStep: 1, wizardFormPolicy: {}, launchModalOpen: false,
            capabilities: {},
            browserGeolocationSupported: typeof navigator !== "undefined" && Boolean(navigator.geolocation),
        });
        onWillStart(async () => {
            const access = await this.orm.call("hr.attendance", "get_cleon_access", []);
            let cleonAccess = null;
            try {
                cleonAccess = await this.orm.call("cleon.time.policy", "get_cleon_access", []);
                this.state.capabilities = cleonAccess.capabilities || {};
                this.state.featureAccess = cleonAccess.featureAccess || access.features || this.state.featureAccess;
            } catch (e) {
                this.state.capabilities = {};
                this.state.featureAccess = access.features || this.state.featureAccess;
            }
            const forceEmployeePortal = Boolean(this.props.action?.params?.force_employee_portal);
            const forceEmployeeMode = Boolean(this.props.action?.params?.force_employee_mode);
            this.state.isManager = cleonAccess?.is_manager ?? access.is_manager;
            this.state.canSwitchInterface = Boolean(cleonAccess?.can_switch_interface);
            this.state.portalModules = cleonAccess?.portalModules || access.portalModules || this.state.portalModules;
            if (!this.state.featureAccess[this.state.feature]) {
                this.state.feature = ["attendance", "shift", "tracking", "overtime"].find(
                    (feature) => this.state.featureAccess[feature]
                ) || "attendance";
            }
            const savedFeature = window.sessionStorage.getItem("cleonhr_time_feature");
            if (savedFeature && this.state.featureAccess[savedFeature]) this.state.feature = savedFeature;
            // The combined Employee Portal is an explicit host application.
            // Being an employee only selects the employee Time workspace; it
            // must not make the portal navigation leak into this module.
            this.state.isPortal = forceEmployeePortal;
            const savedMode = window.localStorage.getItem("cleonhr_interface_mode");
            this.state.mode = !forceEmployeePortal && !forceEmployeeMode && this.state.isManager && savedMode !== "employee" ? "admin" : "employee";
            if (this.state.mode === "employee" && this.state.isManager && !this.state.canSwitchInterface && !forceEmployeePortal && !forceEmployeeMode) {
                this.state.mode = "admin";
            }
            this.state.gateway = this.state.isManager && this.state.mode === "admin";
            const requestedEmployeePage = this.props.action?.params?.employee_page;
            const requestedFeature = this.employeeFeatureForPage(requestedEmployeePage);
            if (requestedFeature && this.state.featureAccess[requestedFeature]) {
                this.state.feature = requestedFeature;
            }
            const allowedEmployeePage = requestedEmployeePage
                && requestedFeature
                && this.state.featureAccess[requestedFeature];
            this.state.employeePage = requestedEmployeePage && allowedEmployeePage
                ? requestedEmployeePage
                : this.employeeDefaultPage(this.state.feature);
            if (this.props.action?.params?.show_workflows) {
                this.state.showWorkflows = true;
                this.state.workflowTab = "chains";
                this.state.feature = "attendance";
                this.state.page = "settings";
            }
            await this.load();
            if (this.state.mode === "employee" && this.state.employeePage === "regularizations") {
                await this.loadRegularizations(false);
            }
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
                if (this.state.feature === "overtime") {
                    this.state.employeeOvertime = await this.orm.call("cleon.overtime.request", "get_my_overtime", []);
                }
                if (this.state.feature === "shift") {
                    this.state.employeeShiftSwaps = await this.orm.call("cleon.shift.swap.request", "get_my_swap_requests", []);
                }
                if (this.state.employeePage === "regularizations") {
                    this.state.regularizations = await this.orm.call("cleon.attendance.regularization", "get_my_requests", []);
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
        if ((mode === "admin" && !this.state.isManager) || (mode === "employee" && this.state.isManager && !this.state.canSwitchInterface)) return;
        this.state.mode = mode; this.state.gateway = false;
        window.localStorage.setItem("cleonhr_interface_mode", mode);
        if (broadcast) {
            window.dispatchEvent(new CustomEvent("cleonhr-interface-mode-change", {detail: {mode}}));
        }
        this.state.feature = this.firstEmployeeFeature();
        this.state.employeePage = this.employeeDefaultPage(this.state.feature);
        await this.load();
    }
    async setEmployeePage(page) {
        const feature = this.employeeFeatureForPage(page);
        if (feature && !this.state.featureAccess[feature]) {
            this.notification.add("This application is not included in the current subscription.", {type: "warning"});
            return;
        }
        if (feature) this.state.feature = feature;
        this.state.employeePage = page; await this.load();
    }
    employeeFeatureForPage(page) {
        if (["dashboard", "attendance_dashboard", "clock", "sheet", "history", "regularizations", "attendance_started"].includes(page)) return "attendance";
        if (["shift_dashboard", "my_shift", "schedule", "shift_swaps"].includes(page)) return "shift";
        if (["tracking_dashboard", "my_timesheets"].includes(page)) return "tracking";
        if (["overtime", "overtime_dashboard", "overtime_requests"].includes(page)) return "overtime";
        return false;
    }
    employeeDefaultPage(feature) {
        return ({attendance: "attendance_dashboard", shift: "shift_dashboard", tracking: "tracking_dashboard", overtime: "overtime_dashboard"})[feature] || "attendance_dashboard";
    }
    firstEmployeeFeature() {
        return ["attendance", "shift", "tracking", "overtime"].find(feature => this.state.featureAccess[feature]) || "attendance";
    }
    get calendarBlanks() {
        return Array.from({length: this.state.employeeData?.calendar?.leading_blanks || 0});
    }
    get employeeWorkingDays() {
        return (this.state.employeeData?.calendar?.days || []).filter(day => !["weekend", "holiday", "future"].includes(day.status)).length;
    }
    get employeeAbsentDays() {
        return (this.state.employeeData?.calendar?.days || []).filter(day => day.status === "absent").length;
    }
    get employeeAttendanceRate() {
        return this.employeeWorkingDays
            ? Math.round((this.state.employeeData.summary.days_present / this.employeeWorkingDays) * 100)
            : 0;
    }
    employeePageTitle() {
        return ({
            attendance_dashboard: "My Dashboard", attendance_started: "Get Started", clock: "Clock In / Out", sheet: "My Attendance Sheet",
            history: "My Attendance Record", regularizations: "My Requests",
            shift_dashboard: "My Shifts", my_shift: "My Shift", schedule: "My Schedule", shift_swaps: "Shift Swap Requests",
            tracking_dashboard: "My Time Tracking", my_timesheets: "My Timesheets",
            overtime_dashboard: "My Overtime", overtime_requests: "Overtime Requests",
        })[this.state.employeePage] || "Time Management";
    }
    employeePageSubtitle() {
        return ({
            attendance_dashboard: "Track your attendance and manage requests", attendance_started: "Understand your employee attendance workspace", clock: "Record the start and end of your workday",
            sheet: "Track and manage your daily attendance", history: "Review your monthly attendance record",
            regularizations: "Track submitted attendance correction requests",
            shift_dashboard: "View and manage your shift schedule", my_shift: "Review today's assigned shift",
            schedule: "Plan ahead with your work schedule", shift_swaps: "Track your shift swap requests",
            tracking_dashboard: "Track your weekly hours and work items", my_timesheets: "View and update your work logs",
            overtime_dashboard: "Review overtime hours and requests", overtime_requests: "Request and track overtime",
        })[this.state.employeePage] || "Your employee time workspace";
    }
    currentTimeLabel() { return new Date().toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit", second: "2-digit"}); }
    currentDateLabel() { return new Date().toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric", year: "numeric"}); }
    scheduleDay(value) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {weekday: "short"}); }
    scheduleMonth(value) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {month: "short"}); }
    scheduleDate(value) { return new Date(`${value}T00:00:00`).getDate(); }
    formatHour(value) {
        const hours = Math.floor(Number(value || 0));
        const minutes = Math.round((Number(value || 0) - hours) * 60);
        const suffix = hours >= 12 ? "PM" : "AM";
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
    }
    openTimesheets() {
        return this.action.doAction("hr_timesheet.act_hr_timesheet_line", {clearBreadcrumbs: true});
    }
    async acceptShiftSwap(request) {
        try {
            await this.orm.call("cleon.shift.swap.request", "action_peer_accept", [[request.id]]);
            await this.load();
            this.notification.add("Shift swap accepted and sent to the line manager.", {type: "success"});
        } catch (error) {
            this.notification.add(error?.data?.message || "The shift swap could not be accepted.", {type: "danger"});
        }
    }
    async cancelShiftSwap(request) {
        try {
            await this.orm.call("cleon.shift.swap.request", "action_cancel", [[request.id]]);
            await this.load();
            this.notification.add("Shift swap request cancelled.", {type: "success"});
        } catch (error) {
            this.notification.add(error?.data?.message || "The shift swap could not be cancelled.", {type: "danger"});
        }
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
            let latitude = null;
            let longitude = null;
            let accuracy = null;
            const method = this.state.policyData?.clock_method;
            if (navigator.geolocation && method && ["gps", "mixed"].includes(method)) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
                    });
                    latitude = pos.coords.latitude;
                    longitude = pos.coords.longitude;
                    accuracy = pos.coords.accuracy;
                } catch (geoError) {
                    if (method === "gps") {
                        this.notification.add("Location permission is required to clock in under your company attendance policy.", { type: "warning" });
                        this.state.busy = false;
                        return;
                    }
                }
            }
            const wasCheckedIn = this.state.employeeData?.attendance_state === "checked_in";
            this.state.employeeData = await this.orm.call("hr.attendance", "cleon_toggle_attendance", [], { latitude, longitude, accuracy });
            const row = this.state.employeeData.today;
            this.notification.add(
                wasCheckedIn ? `Clocked out successfully. Total hours: ${row?.hours || 0}.` : `Clocked in successfully at ${row?.check_in || "now"}.`,
                { type: "success" }
            );
        } catch (error) { this.notification.add(error?.data?.message || "Attendance could not be recorded.", { type: "danger" }); }
        finally { this.state.busy = false; }
    }
    async openSettings() {
        this.state.page = "settings";
        this.state.settingsTab = this.state.featureAccess[this.state.feature] ? this.state.feature : "overview";
        const [policy, overview, regChain, otChain, access, shiftData] = await Promise.all([
            this.orm.call("cleon.time.policy", "get_cleon_policy", []),
            this.orm.call("cleon.time.policy", "get_settings_overview", []),
            this.orm.call("cleon.time.policy", "get_approval_chain_summary", ["time_regularization"]),
            this.orm.call("cleon.time.policy", "get_approval_chain_summary", ["time_overtime"]),
            this.orm.call("cleon.time.policy", "get_cleon_access", []),
            this.orm.call("cleon.hr.shift", "get_shift_management_data", []),
        ]);
        this.state.settingsShifts = shiftData?.shifts || [];
        this.state.policy = policy;
        this.state.capabilities = access.capabilities || {};
        this.state.featureAccess = access.featureAccess || this.state.featureAccess;
        if (
            this.state.settingsTab !== "overview" &&
            !this.state.featureAccess[this.state.settingsTab]
        ) {
            this.state.settingsTab = "overview";
        }
        this.state.settingsOverview = overview;
        this.state.regChainSummary = regChain;
        this.state.otChainSummary = otChain;
    }
    onShiftTemplateChange(ev) {
        const val = ev.target.value;
        const shiftId = val ? Number(val) : false;
        this.state.policy.selected_shift_id = shiftId;
        if (shiftId && this.state.settingsShifts) {
            const shift = this.state.settingsShifts.find(s => s.id === shiftId);
            if (shift) {
                const duration = Math.max(0, (shift.end_hour || 17) - (shift.start_hour || 9));
                this.state.policy.standard_hours = duration || 8.0;
                this.state.policy.half_day_hours = Math.round((duration / 2.0) * 10) / 10 || 4.0;
                if (shift.grace_minutes !== undefined) {
                    this.state.policy.default_grace_minutes = shift.grace_minutes;
                }
                if (shift.break_minutes !== undefined) {
                    this.state.policy.default_break_minutes = shift.break_minutes;
                }
            }
        }
    }
    async openApprovalChain(workflowCode) {
        return this.action.doAction({
            type: "ir.actions.client",
            tag: "cleon_approval.WorkflowsApp",
            params: { workflowCode: workflowCode || "time_overtime" },
        });
    }
    async savePolicy() {
        try {
            this.state.policy = await this.orm.call("cleon.time.policy", "save_cleon_policy", [this.state.policy]);
            const access = await this.orm.call("cleon.time.policy", "get_cleon_access", []);
            this.state.capabilities = access.capabilities || {};
            this.state.canSwitchInterface = Boolean(access.can_switch_interface);
            this.state.portalModules = access.portalModules || this.state.portalModules;
            this.state.featureAccess = access.featureAccess || this.state.featureAccess;
            this.state.settingsOverview = await this.orm.call("cleon.time.policy", "get_settings_overview", []);
            this.notification.add("Time Management policy saved.", {type:"success"});
        } catch (error) { this.notification.add(error?.data?.message || "Policy could not be saved.", {type:"danger"}); }
    }
    async saveClockMethods() {
        try {
            const res = await this.orm.call("cleon.time.policy", "save_clock_method_settings", [], {
                clock_method: this.state.policy.clock_method || "manual",
                office_latitude: this.state.policy.office_latitude ?? 0.0,
                office_longitude: this.state.policy.office_longitude ?? 0.0,
                gps_radius_meters: this.state.policy.gps_radius_meters ?? 200.0,
                ip_whitelist: this.state.policy.ip_whitelist || "",
            });
            this.state.policy = res.policy;
            this.state.capabilities = res.capabilities || {};
            this.state.settingsOverview = await this.orm.call("cleon.time.policy", "get_settings_overview", []);
            this.notification.add("Clock method settings and capability status updated.", { type: "success" });
        } catch (error) { this.notification.add(error?.data?.message || "Clock method settings could not be saved.", { type: "danger" }); }
    }
    async resetPolicy() {
        try {
            this.state.policy = await this.orm.call("cleon.time.policy", "get_cleon_policy", []);
            this.notification.add("Changes reset to the last saved values.", {type: "info"});
        } catch (error) {
            this.notification.add(error?.data?.message || "Settings could not be reset.", {type: "danger"});
        }
    }
    async setSettingsTab(tab) {
        if (tab !== "overview" && !this.state.featureAccess[tab]) {
            this.state.settingsTab = "overview";
            this.notification.add("This application is not included in the current subscription.", {type: "warning"});
            return;
        }
        this.state.settingsTab = tab;
        if (tab === "overview") {
            this.state.settingsOverview = await this.orm.call("cleon.time.policy", "get_settings_overview", []);
        }
    }
    async openGetStarted() {
        this.state.page = "get_started";
        this.state.loading = true;
        try {
            const wizardData = await this.orm.call("cleon.time.policy", "get_wizard_state", []);
            this.state.wizardData = wizardData;
            this.state.wizardFormPolicy = { ...wizardData.policy };
            if (!this.state.wizardFormPolicy.go_live_date) {
                this.state.wizardFormPolicy.go_live_date = new Date().toISOString().slice(0, 10);
            }
        } catch (error) {
            this.notification.add(error?.data?.message || "Failed to load onboarding status.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }
    async openWizard(step = null) {
        this.state.page = "wizard";
        this.state.loading = true;
        try {
            const wizardData = await this.orm.call("cleon.time.policy", "get_wizard_state", []);
            this.state.wizardData = wizardData;
            this.state.currentWizardStep = step || wizardData.wizard_step || 1;
            this.state.wizardFormPolicy = { ...wizardData.policy };
            if (!this.state.wizardFormPolicy.go_live_date) {
                this.state.wizardFormPolicy.go_live_date = new Date().toISOString().slice(0, 10);
            }
        } catch (error) {
            this.notification.add(error?.data?.message || "Failed to load wizard progress.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }
    async goToWizardStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 8) return;
        this.state.currentWizardStep = stepNumber;
    }
    async nextWizardStep() {
        const activeStep = this.state.currentWizardStep;
        const saved = await this.saveWizardStepProgress(activeStep);
        if (saved) {
            this.state.currentWizardStep = this.state.wizardData?.wizard_step ?? Math.min(activeStep + 1, 8);
        }
    }
    async prevWizardStep() {
        if (this.state.currentWizardStep > 1) {
            this.state.currentWizardStep -= 1;
        }
    }
    async saveWizardStepProgress(stepNumber = null) {
        const stepToSave = stepNumber || this.state.currentWizardStep;
        try {
            const payload = this.wizardStepPayload(stepToSave);
            const updatedState = await this.orm.call("cleon.time.policy", "save_wizard_step", [stepToSave, payload]);
            this.state.wizardData = updatedState;
            this.state.policy = updatedState.policy;
            for (const field of Object.keys(payload)) {
                this.state.wizardFormPolicy[field] = updatedState.policy[field];
            }
            this.notification.add(`Wizard Step ${stepToSave} configuration saved.`, { type: "success" });
            return true;
        } catch (error) {
            this.notification.add(error?.data?.message || "Failed to save wizard progress.", { type: "danger" });
            return false;
        }
    }
    wizardStepPayload(stepNumber) {
        const fieldsByStep = {
            1: ["policy_type", "work_week", "standard_hours", "half_day_hours"],
            2: ["default_break_minutes", "default_grace_minutes", "round_off_interval"],
            3: ["clock_method", "office_latitude", "office_longitude", "gps_radius_meters", "ip_whitelist"],
            4: ["enable_overtime", "daily_overtime_threshold", "daily_overtime_rate", "weekly_overtime_enabled", "weekly_overtime_threshold", "weekly_overtime_rate", "weekend_overtime_rate", "holiday_overtime_rate", "overtime_auto_approve_max_hours"],
            5: ["regularization_window_days", "regularization_require_approval", "regularization_fallback_approver"],
            6: ["overtime_require_approval", "overtime_fallback_approver", "overtime_notify_employee"],
            7: ["billable_tracking_enabled", "default_billing_rate", "payroll_integration"],
        };
        return Object.fromEntries(
            (fieldsByStep[stepNumber] || [])
                .filter((field) => Object.prototype.hasOwnProperty.call(this.state.wizardFormPolicy, field))
                .map((field) => [field, this.state.wizardFormPolicy[field]])
        );
    }
    openLaunchModal() {
        this.state.launchModalOpen = true;
    }
    closeLaunchModal() {
        this.state.launchModalOpen = false;
    }
    async confirmGoLiveLaunch() {
        try {
            this.state.loading = true;
            const updatedState = await this.orm.call("cleon.time.policy", "launch_policy", [{
                go_live_date: this.state.wizardFormPolicy.go_live_date || new Date().toISOString().slice(0, 10),
            }]);
            this.state.wizardData = updatedState;
            this.state.policy = updatedState.policy;
            this.state.launchModalOpen = false;
            this.notification.add("System Go-Live successfully launched!", { type: "success" });
        } catch (error) {
            this.notification.add(error?.data?.message || "Go-Live launch failed.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }
    async loadSettingsShifts() {
        const data = await this.orm.call("cleon.hr.shift", "get_shift_management_data", []);
        this.state.settingsShifts = data.shifts || [];
    }
    openSettingsShiftForm(shift = null) {
        this.state.settingsShiftForm = shift ? { ...shift, active_days: [...(shift.active_days || [0,1,2,3,4])] }
            : { id: null, name: "", code: "", shift_type: "fixed", recurrence: "weekly",
               start_hour: 9, end_hour: 17, break_minutes: 60, grace_minutes: 15,
               active_days: [0, 1, 2, 3, 4] };
    }
    closeSettingsShiftForm() { this.state.settingsShiftForm = null; }
    toggleSettingsShiftDay(dayOrShift, dayId) {
        let targetList = [];
        let dayToToggle;
        if (dayId !== undefined && typeof dayOrShift === 'object') {
            if (!dayOrShift.active_days) dayOrShift.active_days = [];
            targetList = dayOrShift.active_days;
            dayToToggle = dayId;
        } else if (this.state.settingsShiftForm) {
            if (!this.state.settingsShiftForm.active_days) this.state.settingsShiftForm.active_days = [];
            targetList = this.state.settingsShiftForm.active_days;
            dayToToggle = dayOrShift;
        } else {
            return;
        }
        const idx = targetList.indexOf(dayToToggle);
        if (idx >= 0) targetList.splice(idx, 1);
        else targetList.push(dayToToggle);
    }
    async saveSettingsShift() {
        const form = this.state.settingsShiftForm;
        if (!form || !form.name.trim()) {
            this.notification.add("Shift name is required.", {type:"warning"}); return;
        }
        try {
            await this.orm.call("cleon.hr.shift", "save_shift", [form]);
            this.notification.add(form.id ? "Shift updated." : "Shift created.", {type:"success"});
            this.state.settingsShiftForm = null;
            await this.loadSettingsShifts();
            this.state.settingsOverview = await this.orm.call("cleon.time.policy", "get_settings_overview", []);
        } catch (error) { this.notification.add(error?.data?.message || "Shift could not be saved.", {type:"danger"}); }
    }
    async deleteSettingsShift(shiftId) {
        try {
            await this.orm.unlink("cleon.hr.shift", [shiftId]);
            this.notification.add("Shift deleted.", {type:"success"});
            await this.loadSettingsShifts();
            this.state.settingsOverview = await this.orm.call("cleon.time.policy", "get_settings_overview", []);
        } catch (error) { this.notification.add(error?.data?.message || "Shift could not be deleted.", {type:"danger"}); }
    }
    async launchSystem() {
        this.state.policy.launched = true;
        this.state.policy.go_live_date = new Date().toISOString().slice(0, 10);
        await this.savePolicy();
        this.notification.add("Time Management is now live! 🎉", {type:"success"});
    }
    toggleWeekendDay(day) {
        if (!Array.isArray(this.state.policy.weekend_days)) {
            this.state.policy.weekend_days = [0, 6];
        }
        const idx = this.state.policy.weekend_days.indexOf(day);
        if (idx >= 0) {
            this.state.policy.weekend_days.splice(idx, 1);
        } else {
            this.state.policy.weekend_days.push(day);
        }
    }
    openJobModal() {
        this.state.jobModal = { name: "", code: "", department: "IT" };
    }
    closeJobModal() {
        this.state.jobModal = null;
    }
    saveJobModal() {
        if (!this.state.jobModal || !this.state.jobModal.name.trim()) {
            this.notification.add("Job name is required.", {type: "warning"});
            return;
        }
        this.state.jobsTasksList.push({
            id: Date.now(),
            name: this.state.jobModal.name.trim(),
            code: (this.state.jobModal.code || "JOB").toUpperCase(),
            department: this.state.jobModal.department || "IT",
            tasks: []
        });
        this.state.jobModal = null;
        this.notification.add("Job created successfully.", {type: "success"});
    }
    deleteJob(id) {
        this.state.jobsTasksList = this.state.jobsTasksList.filter(j => j.id !== id);
    }
    openTaskModal(jobId) {
        this.state.taskModal = { jobId: jobId, name: "", code: "" };
    }
    closeTaskModal() {
        this.state.taskModal = null;
    }
    saveTaskModal() {
        if (!this.state.taskModal || !this.state.taskModal.name.trim()) {
            this.notification.add("Task name is required.", {type: "warning"});
            return;
        }
        const job = this.state.jobsTasksList.find(j => j.id === this.state.taskModal.jobId);
        if (job) {
            job.tasks.push(this.state.taskModal.name.trim());
            this.notification.add(`Task '${this.state.taskModal.name}' added to ${job.name}.`, {type: "success"});
        }
        this.state.taskModal = null;
    }
    deleteTask(jobId, taskIndex) {
        const job = this.state.jobsTasksList.find(j => j.id === jobId);
        if (job && taskIndex >= 0 && taskIndex < job.tasks.length) {
            job.tasks.splice(taskIndex, 1);
        }
    }
    addTimesheetReminder() {
        this.state.timesheetReminders.push("Monday 09:00");
    }
    deleteTimesheetReminder(index) {
        if (index >= 0 && index < this.state.timesheetReminders.length) {
            this.state.timesheetReminders.splice(index, 1);
        }
    }
    get otEstimatedPay() {
        const hrs = parseFloat(this.state.otCalcHours) || 0;
        const rate = parseFloat(this.state.otCalcRate) || 0;
        return (hrs * rate * 1.5).toFixed(2);
    }
    get otMathText() {
        const hrs = parseFloat(this.state.otCalcHours) || 0;
        const rate = parseFloat(this.state.otCalcRate) || 0;
        return `${hrs} hrs × $${rate} / 1.5x rate`;
    }


    get filteredRows() {
        return this.state.status === "all" ? this.state.rows : this.state.rows.filter(row => row.status === this.state.status);
    }
    label(status) { return ({present:"Present", late:"Late", half_day:"Half-day", absent:"Absent", on_leave:"On Leave", weekend:"Weekend Overtime", holiday:"Holiday Overtime", daily:"Daily Overtime", special:"Special Assignment", on_call:"On-call Work", future:"Not yet recorded", auto:"Auto-calculated", submitted:"Pending Approval", requested:"Pending Peer", peer_accepted:"Pending Manager", approved:"Approved", rejected:"Rejected", correction:"Corrections Requested", withdrawn:"Withdrawn", draft:"Draft"})[status] || status; }
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
        if (this.state.mode === "employee") {
            this.state.employeePage = this.employeeDefaultPage(feature);
        }
        this.state.page = "dashboard";
        return this.load();
    }
    featureName(feature = this.state.feature) { return ({attendance:"Attendance Management", shift:"Shift Management", tracking:"Time Tracking", overtime:"Overtime Management"})[feature]; }
    featureShortName(feature) { return ({attendance:"Attendance", shift:"Shift Mgmt", tracking:"Time Tracking", overtime:"Overtime"})[feature]; }
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
