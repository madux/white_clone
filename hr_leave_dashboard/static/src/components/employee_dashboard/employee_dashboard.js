/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class EmployeeLeaveDashboard extends Component {
    static template = "hr_leave_dashboard.EmployeeDashboard";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({ loading: true, data: { employee: {}, kpis: {}, balances: [], upcoming_leave: [], holidays: [], recent: [] } });
        onWillStart(() => this.load());
    }
    async load() {
        this.state.loading = true;
        try { this.state.data = await this.orm.call("hr.leave", "get_employee_dashboard_data", []); }
        catch (error) { this.notification.add(error.message || "Unable to load your leave dashboard.", { type: "danger" }); }
        finally { this.state.loading = false; }
    }
    openAdmin() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_admin_dashboard"); }
    openTour() { this.notification.add("Use the balance cards and quick actions to manage your personal leave.", { title: "Employee Dashboard Tour", type: "info" }); }
    openHelp() { this.notification.add("Available balance is approved allocation less approved leave; pending days are shown separately.", { title: "Leave Dashboard Guide", type: "info" }); }
    openSetup() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_admin_dashboard", { additionalContext: { open_setup_wizard: true } }); }
    requestLeave() { return this.action.doAction("hr_holidays.hr_leave_action_new_request", { additionalContext: { default_employee_id: this.state.data.employee.id } }); }
    openCalendar() { return this.action.doAction("hr_holidays.hr_leave_action_new_request"); }
    openRequests() { return this.action.doAction("hr_holidays.hr_leave_action_new_request", { viewType: "list" }); }
    formatDate(value) { if (!value) return "—"; return new Date(value.replace(" ", "T")).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
    statusClass(state) { return state === "validate" ? "approved" : ["confirm", "validate1"].includes(state) ? "pending" : state === "refuse" ? "rejected" : "draft"; }
}

registry.category("actions").add("hr_leave_dashboard.EmployeeDashboard", EmployeeLeaveDashboard);
