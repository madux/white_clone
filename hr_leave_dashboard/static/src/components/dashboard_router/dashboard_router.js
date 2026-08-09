/** @odoo-module **/

import { Component, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class LeaveDashboardRouter extends Component {
    static template = "hr_leave_dashboard.DashboardRouter";
    setup() {
        this.action = useService("action");
        this.user = useService("user");
        onWillStart(async () => {
            const isAdmin = await this.user.hasGroup("hr_holidays.group_hr_holidays_manager") || await this.user.hasGroup("base.group_system");
            await this.action.doAction(isAdmin ? "hr_leave_dashboard.action_hr_leave_admin_dashboard" : "hr_leave_dashboard.action_hr_leave_employee_dashboard", { clearBreadcrumbs: true });
        });
    }
}
registry.category("actions").add("hr_leave_dashboard.Router", LeaveDashboardRouter);
