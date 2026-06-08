/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
console.log("tree view Loading the sidebar widget")

export class OrganisationListRenderer extends ListRenderer {
    setup() {
        super.setup();
        this.orm = this.env.services.orm;
        this.action = this.env.services.action;
        this.userService = this.env.services.user;
        console.log("Emeka Side bar tree view Loading the sidebar widget")
    } 
    async openBranch(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_employee.action_core_multi_branch",
            {
                target: "current",
            }
        );
    }

    async openOrganization(ev) {
        ev.preventDefault();
        const [actionId, menuId] =
            await this.orm.call(
                'hr.employee',
                'get_get_employee_action_data',
                []
            );
        if (actionId){
            window.location.href = `/web#action=${actionId}&model=hr.employee&view_type=list&menu_id=${menuId}`
        }else{
            await this.env.services.action.doAction(
            "hr_employee.action_core_view_hr_core_employee",
            {
                target: "current",
            }
        );

        }
// /web#action=771&model=hr.employee&view_type=list&menu_id=538
        
    }

    async openStaffDirectory(ev) {
        ev.preventDefault();
        await this.env.services.action.doAction(
            "hr_employee.action_view_employee_kanban_custom",
            {
                target: "current",
            }
        );
    }
    
}
OrganisationListRenderer.template = "hr_employee.OrganisationListRenderer";

export const CustomOrganisationDashboardListView = {
    ...listView,
    Renderer: OrganisationListRenderer,
};

registry.category("views").add("organisation_list", CustomOrganisationDashboardListView);