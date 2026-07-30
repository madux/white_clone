/** @odoo-module **/

import { calendarView } from "@web/views/calendar/calendar_view";
import { TimeOffCalendarController } from "@hr_holidays/views/calendar/calendar_controller";
import { TimeOffCalendarModel } from "@hr_holidays/views/calendar/calendar_model";
import {
    TimeOffCalendarRenderer,
    TimeOffDashboardCalendarRenderer,
} from "@hr_holidays/views/calendar/calendar_renderer";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class LeaveDashboardCalendarRenderer extends TimeOffCalendarRenderer {
    static template = "hr_leave_dashboard.CalendarRenderer";

    setup() {
        super.setup();
        this.action = useService("action");
    }

    openRecord() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openCustomHearings() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.leave",
            views: [[false, "list"], [false, "form"]],
            name: "Leave Calendar",
        });
    }

    openMeasures() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.leave",
            domain: [["state", "=", "confirm"]],
            views: [[false, "list"], [false, "form"]],
            name: "Leave Requests",
        });
    }

    openInvestigations() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.leave.type",
            views: [[false, "list"], [false, "form"]],
            name: "Leave Types",
        });
    }
}

export class LeaveDashboardDashboardCalendarRenderer extends TimeOffDashboardCalendarRenderer {
    static template = "hr_leave_dashboard.CalendarRenderer";
}
// reuse same sidebar methods on the dashboard variant
Object.assign(
    LeaveDashboardDashboardCalendarRenderer.prototype,
    {
        openRecord: LeaveDashboardCalendarRenderer.prototype.openRecord,
        openCustomHearings: LeaveDashboardCalendarRenderer.prototype.openCustomHearings,
        openMeasures: LeaveDashboardCalendarRenderer.prototype.openMeasures,
        openInvestigations: LeaveDashboardCalendarRenderer.prototype.openInvestigations,
    }
);

const LeaveDashboardCalendarView = {
    ...calendarView,
    Controller: TimeOffCalendarController,
    Model: TimeOffCalendarModel,
    Renderer: LeaveDashboardCalendarRenderer,
};

registry.category("views").add("time_off_calendar_with_sidebar", LeaveDashboardCalendarView);

registry.category("views").add("time_off_calendar_dashboard_with_sidebar", {
    ...LeaveDashboardCalendarView,
    Renderer: LeaveDashboardDashboardCalendarRenderer,
});

// /** @odoo-module **/

// import { CalendarController } from "@web/views/calendar/calendar_controller";
// import { calendarView } from "@web/views/calendar/calendar_view";
// import { registry } from "@web/core/registry";
// import { useService } from "@web/core/utils/hooks";

// export class LeaveDashboardTimeOffCalendarController extends CalendarController {
//     static template = "hr_leave_dashboard.CalendarController";

//     setup() {
//         super.setup();
//         this.action = useService("action");
//     }

//     openRecord() {
//         // example: navigate to a dashboard client action
//         this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
//     }

//     openCustomHearings() {
//         this.action.doAction({
//             type: "ir.actions.act_window",
//             res_model: "hr.leave",
//             views: [[false, "list"], [false, "form"]],
//             name: "Leave Calendar",
//         });
//     }

//     openMeasures() {
//         this.action.doAction({
//             type: "ir.actions.act_window",
//             res_model: "hr.leave",
//             domain: [["state", "=", "confirm"]],
//             views: [[false, "list"], [false, "form"]],
//             name: "Leave Requests",
//         });
//     }

//     openInvestigations() {
//         this.action.doAction({
//             type: "ir.actions.act_window",
//             res_model: "hr.leave.type",
//             views: [[false, "list"], [false, "form"]],
//             name: "Leave Types",
//         });
//     }
// }

// export const CustomLeaveDashboardCalendarView = {
//     ...calendarView,
//     Controller: LeaveDashboardTimeOffCalendarController,
// };

// registry.category("views").add("myhrleave_calendar_view", CustomLeaveDashboardCalendarView);