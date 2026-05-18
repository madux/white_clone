/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
console.log("tree view Loading the sidebar widget")

export class CustomListRenderer extends ListRenderer {
    setup() {
        super.setup();
        this.orm = this.env.services.orm;
        this.action = this.env.services.action;
        this.userService = this.env.services.user;
        console.log("Againnnnn tree view Loading the sidebar widget")
    } 

    // async openCustomWarningForm() {
    //     await this.env.services.action.doAction(
    //         "hr_warning.action_hr_warning_custom_form",
    //         {
    //             target: "current",
    //         }
    //     );
    // }

    async openCustomWarningForm() {

        const [lastRecordId, view_ref] =
            await this.orm.call(
                'hr.warning',
                'get_last_draft_record',
                []
            );

        if (lastRecordId) {

            this.action.doAction({
                type: 'ir.actions.act_window',
                res_model: 'hr.warning',
                res_id: lastRecordId,

                views: [[view_ref, 'form']],

                target: 'new',
            });

        } else {

            await this.env.services.action.doAction(
                "hr_warning.action_hr_warning_custom_form",
                {
                    target: "new",
                }
            );
        }
    }

    async openRecord() {
        // ev.preventDefault();
        console.log("openAllocationView clicked");

        await this.env.services.action.doAction({
            type: "ir.actions.act_window",
            name: "Displinary",
            res_model: "hr.warning",
            view_mode: "list,form",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        });
    }

    async openCaseType() {
        await this.env.services.action.doAction({
            type: "ir.actions.act_window",
            name: "Cases",
            res_model: "hr.warning.case.type",
            view_mode: "kanban,list,form",
            views: [[false, "kanban"],[false, "list"], [false, "form"]],
            target: "current",
        });
    }

    async openInvestigations(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_warning.action_hr_warning_investigations",
            {
                target: "new",
            }
        );
    }

    async openHearings(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_warning.action_hr_warning_hearing",
            {
                target: "new",
            }
        );
    }

    async openMeasures(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_warning.action_hr_warning_interim_measure",
            {
                target: "new",
            }
        );
    }
}
// CustomListRenderer.components = { ...ExpenseDashboardListRenderer.components, ExpenseDashboard};
CustomListRenderer.template = "hr_warning.CustomListRenderer";

export const CustomDashboardListView = {
    ...listView,
    Renderer: CustomListRenderer,
};

registry.category("views").add("warning_dashboard_list", CustomDashboardListView);