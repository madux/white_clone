/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CalendarSidebar extends Component {
    static template = "hr_leave_dashboard.CalendarSidebar";
    static props = {
        activeMenu: { type: String, optional: true },
        onOpenSetup: { type: Function, optional: true },
    };

    setup() {
        this.action = useService("action");
        this.notification = useService("notification");
    }

    openDashboard() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
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

    openCalendar() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");
    }

    openRequests() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_requests_custom");
    }

    openLeaveTypes() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_types_custom");
    }

    openLeaveBalances() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_balances_custom");
    }

    openReports() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom");
    }

    openAuditLog() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_audit_custom");
    }

    openSettings() {
        this.action.doAction("hr_holidays.action_hr_holidays_configuration");
    }
}
