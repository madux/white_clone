/** @odoo-module **/

import { Component, onWillStart, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CalendarSidebar extends Component {
    static template = "hr_leave_dashboard.CalendarSidebar";
    static props = {
        activeMenu: { type: String, optional: true },
        onOpenSetup: { type: Function, optional: true },
        mode: { type: String, optional: true },
    };

    setup() {
        this.action = useService("action");
        this.user = useService("user");
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.state = useState({ collapsed: localStorage.getItem("cleonhr_leave_sidebar_collapsed") === "1", isAdmin: false, employeeMode: this.props.mode === "employee", pending: 0, configOpen: true });
        onWillStart(async () => {
            this.state.isAdmin = await this.user.hasGroup("hr_holidays.group_hr_holidays_manager") || await this.user.hasGroup("base.group_system");
            this.state.employeeMode = this.props.mode === "employee" || (!this.state.isAdmin && this.props.mode !== "admin");
            try {
                const data = this.state.employeeMode
                    ? await this.orm.call("hr.leave", "get_my_leave_requests", ["all", "", false])
                    : await this.orm.call("hr.leave", "get_leave_requests_page", ["", "all", false, false, 1, 10]);
                this.state.pending = data.counts?.pending || 0;
            } catch (_error) { this.state.pending = 0; }
        });
        this.externalToggle = () => this.toggleCollapsed();
        onMounted(() => { this.applyCollapsedClass(); window.addEventListener("cleonhr:toggle-leave-sidebar", this.externalToggle); });
        onWillUnmount(() => { window.removeEventListener("cleonhr:toggle-leave-sidebar", this.externalToggle); document.documentElement.classList.remove("o_leave_sidebar_collapsed"); });
    }

    applyCollapsedClass() { document.documentElement.classList.toggle("o_leave_sidebar_collapsed", this.state.collapsed); }
    toggleCollapsed() { this.state.collapsed = !this.state.collapsed; localStorage.setItem("cleonhr_leave_sidebar_collapsed", this.state.collapsed ? "1" : "0"); this.applyCollapsedClass(); }
    toggleConfiguration() { this.state.configOpen = !this.state.configOpen; }

    openDashboard() {
        this.action.doAction(this.state.employeeMode ? "hr_leave_dashboard.action_hr_leave_employee_dashboard" : "hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openSetupExperience() {
        if (this.props.onOpenSetup) {
            this.props.onOpenSetup();
        } else {
            this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard", {
                additionalContext: { open_setup_wizard: true },
            });
        }
    }

    openTour() { this.notification.add(this.state.employeeMode ? "Use Dashboard, Calendar and My Leave Requests to manage your leave." : "Use this navigation to move through setup, requests, policies, balances and reports.", { title: "Leave Management Tour", type: "info" }); }

    openCalendar() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");
    }

    async openRequests() {
        this.action.doAction(this.state.employeeMode ? "hr_leave_dashboard.action_hr_leave_my_requests" : "hr_leave_dashboard.action_hr_leave_requests_custom");
    }

    openLeaveTypes() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_types_custom");
    }

    openLeaveBalances() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_balances_custom");
    }

    openReports() {
        if (this.state.employeeMode) this.notification.add("Employee leave reports will be available here in the employee reporting screen.", { type: "info" });
        else this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom");
    }

    openAuditLog() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_audit_custom");
    }

    openSettings() {
        this.action.doAction("hr_holidays.action_hr_holidays_configuration");
    }
}
