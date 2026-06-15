/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
console.log("Recruitment tree view Loading the sidebar widget")

export class CustomRecruitmentListRenderer extends ListRenderer {
    setup() {
        super.setup();
        this.orm = this.env.services.orm;
        this.action = this.env.services.action;
        this.userService = this.env.services.user;
        console.log("Again recrutiment tree view Loading the sidebar widget")
    } 

    // async openCustomWarningForm() {
    //     await this.env.services.action.doAction(
    //         "hr_warning.action_hr_warning_custom_form",
    //         {
    //             target: "current",
    //         }
    //     );
    // }

    // async openCustomWarningForm() {

    //     const [lastRecordId, view_ref] =
    //         await this.orm.call(
    //             'hr.warning',
    //             'get_last_draft_record',
    //             []
    //         );

    //     if (lastRecordId) {

    //         this.action.doAction({
    //             type: 'ir.actions.act_window',
    //             res_model: 'hr.warning',
    //             res_id: lastRecordId,
    //             name: 'Incident Report',
    //             views: [[view_ref, 'form']],
    //             target: 'new',
    //         });

    //     } else {

    //         await this.env.services.action.doAction(
    //             "hr_warning.action_hr_warning_custom_form",
    //             {
    //                 target: "new",
    //             }
    //         );
    //     }
    // }

    // async openCustomHearings() {

    //     const RecordIds =
    //         await this.orm.call(
    //             'hr.warning',
    //             'get_all_hearing_records',
    //             []
    //         );

    //     this.action.doAction({
    //         type: 'ir.actions.act_window',
    //         name: 'Hearings & Decisions',
    //         res_model: 'hr.warning',
    //         view_mode: 'list,form',
    //         views: [
    //             [false, 'list'],
    //             [false, 'form']
    //         ],
    //         domain: [['id', 'in', RecordIds]],
    //         target: 'current',
    //     });
    // }

    async openCandidate(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_cleon_recruitment.action_hr_applicant_recruitment",
            {
                target: "current",
            }
        );
    }

    // async openRecord() {
    //     // ev.preventDefault();
    //     console.log("openAllocationView clicked");

    //     await this.env.services.action.doAction({
    //         type: "ir.actions.act_window",
    //         name: "Displinary",
    //         res_model: "hr.warning",
    //         view_mode: "list,form",
    //         views: [[false, "list"], [false, "form"]],
    //         target: "current",
    //     });
    // }

    // async openCaseType() {
    //     await this.env.services.action.doAction({
    //         type: "ir.actions.act_window",
    //         name: "Cases",
    //         res_model: "hr.warning.case.type",
    //         view_mode: "kanban,list,form",
    //         views: [[false, "kanban"],[false, "list"], [false, "form"]],
    //         target: "current",
    //     });
    // }

    // async openInvestigations(ev) {
    //     ev.preventDefault();

    //     await this.env.services.action.doAction(
    //         "hr_warning.action_hr_warning_investigations",
    //         {
    //             target: "new",
    //         }
    //     );
    // }

    // async openHearings(ev) {
    //     ev.preventDefault();

    //     await this.env.services.action.doAction(
    //         "hr_warning.action_hr_warning_hearing",
    //         {
    //             target: "new",
    //         }
    //     );
    // }

    // async openMeasures(ev) {
    //     ev.preventDefault();

    //     await this.env.services.action.doAction(
    //         "hr_warning.action_hr_warning_interim_measure",
    //         {
    //             target: "new",
    //         }
    //     );
    // }
}
// CustomListRenderer.components = { ...ExpenseDashboardListRenderer.components, ExpenseDashboard};
CustomRecruitmentListRenderer.template = "hr_cleon_recruitment.CustomRecruitmentListRenderer";

export const CustomRecruitmentDashboardListView = {
    ...listView,
    Renderer: CustomRecruitmentListRenderer,
};

registry.category("views").add("myrecruitment_dashboard_list", CustomRecruitmentDashboardListView);