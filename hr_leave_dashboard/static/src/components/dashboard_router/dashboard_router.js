/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { HrLeaveDashboard } from "../../js/dashboard";
import { EmployeeLeaveDashboard } from "../employee_dashboard/employee_dashboard";
import { CalendarSidebar } from "../calendar_sidebar";
import { EmployeeRequestModal } from "../employee_request_modal/employee_request_modal";

export class LeaveDashboardRouter extends Component {
    static template = "hr_leave_dashboard.DashboardRouter";
    static components = { HrLeaveDashboard, EmployeeLeaveDashboard, CalendarSidebar, EmployeeRequestModal };
    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.state = useState({ loading: true, access: {}, requestOpen: false, revision: 0 });
        onWillStart(async () => {
            this.state.access = await this.orm.call(
                "hr.leave", "get_leave_access_profile", []
            );
            this.state.loading = false;
        });
    }

    toggleSidebar() {
        window.dispatchEvent(new CustomEvent("cleonhr:toggle-leave-sidebar"));
    }

    requestLeave() { this.state.requestOpen = true; }
    closeRequest() { this.state.requestOpen = false; }
    requestSubmitted() { this.state.requestOpen = false; this.state.revision += 1; }
    openMyRequests() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests"); }
    openApprovals() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_requests_custom"); }
    openCalendar() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar"); }
    openBalances() { return this.openConfiguration("balances"); }
    openLeaveTypes() { return this.openConfiguration("leave_types"); }
    openConfiguration(tab = "leave_types") {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_configuration", {
            additionalContext: { configuration_tab: tab },
        });
    }
    openReports() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom"); }
    openAudit() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_audit_custom"); }
}
registry.category("actions").add("hr_leave_dashboard.Router", LeaveDashboardRouter);
