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
    
}
OrganisationListRenderer.template = "hr_employee.OrganisationListRenderer";

export const CustomOrganisationDashboardListView = {
    ...listView,
    Renderer: OrganisationListRenderer,
};

registry.category("views").add("organisation_list", CustomOrganisationDashboardListView);