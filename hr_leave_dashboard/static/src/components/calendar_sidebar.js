/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CalendarSidebar extends Component {
    static template = "hr_leave_dashboard.CalendarSidebar";
    static props = {
        activeMenu: { type: String, optional: true },
    };

    setup() {
        this.action = useService("action");
        this.notification = useService("notification");
    }

    openDashboard() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openCalendar() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");
    }

    openRequests() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_requests_custom");
    }

    openLeaveTypes() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.leave.type",
            views: [[false, "list"], [false, "form"]],
            name: "Leave Types",
        });
    }

    openLeaveBalances() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.leave.allocation",
            views: [[false, "list"], [false, "form"]],
            name: "Leave Balances",
        });
    }

    openReports() {
        this.action.doAction("hr_holidays.action_hr_available_holidays_report");
    }

    openAuditLog() {
        this.notification.add("Leave Audit Log feature.", { title: "Audit Log", type: "info" });
    }

    openSettings() {
        this.action.doAction("hr_holidays.action_hr_holidays_configuration");
    }
}