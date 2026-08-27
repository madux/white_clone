/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { EmployeeRequestModal } from "../employee_request_modal/employee_request_modal";
import { CalendarSidebar } from "../calendar_sidebar";

export class EmployeeLeaveDashboard extends Component {
    static template = "hr_leave_dashboard.EmployeeDashboard";
    static components = { EmployeeRequestModal, CalendarSidebar };
    static props = { embedded: {type: Boolean, optional: true}, startRequest: {type: Boolean, optional: true} };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({ loading: true, requestOpen: false, data: { employee: {}, kpis: {}, balances: [], upcoming_leave: [], holidays: [], recent: [] } });
        onWillStart(async () => { await this.load(); if (this.props.startRequest) this.state.requestOpen = true; });
    }
    async load() {
        this.state.loading = true;
        try { this.state.data = await this.orm.call("hr.leave", "get_employee_dashboard_data", []); }
        catch (error) { this.notification.add(error.message || "Unable to load your leave dashboard.", { type: "danger" }); }
        finally { this.state.loading = false; }
    }
    openAdmin() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_admin_dashboard"); }
    toggleSidebar() { window.dispatchEvent(new CustomEvent("cleonhr:toggle-leave-sidebar")); }
    openTour() { this.notification.add("Use the balance cards and quick actions to manage your personal leave.", { title: "Employee Dashboard Tour", type: "info" }); }
    openHelp() { this.notification.add("Available balance is allocation less approved and pending leave. Carry-forward is shown separately when applicable.", { title: "Leave Dashboard Guide", type: "info" }); }
    openSetup() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_admin_dashboard", { additionalContext: { open_setup_wizard: true } }); }
    requestLeave() { this.state.requestOpen = true; }
    closeRequest() { this.state.requestOpen = false; }
    openCalendar() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar"); }
    openRequests() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests"); }
    formatDate(value) { if (!value) return "—"; return new Date(value.replace(" ", "T")).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
    statusClass(state) { return state === "validate" ? "approved" : ["confirm", "validate1"].includes(state) ? "pending" : state === "refuse" ? "rejected" : "draft"; }
}

registry.category("actions").add("hr_leave_dashboard.EmployeeDashboard", EmployeeLeaveDashboard);
