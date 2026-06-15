/** @odoo-module **/

import { CalendarController } from "@web/views/calendar/calendar_controller";
import { patch } from "@web/core/utils/patch";

console.log("✅ NEW hr_calendar JS loaded successfully");

patch(CalendarController.prototype, {

    async openLeaveView() {

        console.log("openLeaveView clicked");

        await this.env.services.action.doAction({
            type: "ir.actions.act_window",
            name: "New Leave",
            res_model: "hr.leave",
            view_mode: "form",
            views: [[false, "form"]],
            target: "new",
        });
    },

    async openAllocationView() {

        console.log("openAllocationView clicked");

        await this.env.services.action.doAction({
            type: "ir.actions.act_window",
            name: "Allocations",
            res_model: "hr.leave.allocation",
            view_mode: "list,form",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        });
    },

    async openCompanyActivities(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_company_calendar.action_load_company_calendar_data",
            {
                target: "new",
            }
        );
    },

    async openApprovalsView(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_company_calendar.action_load_company_calendar_approvals",
            {
                target: "new",
            }
        );
    }

});