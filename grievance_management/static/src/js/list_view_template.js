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
        console.log("Againnnnn tree grievance view Loading the sidebar widget")
    } 

     
    async openGrievance(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_dashboard",
            {
                target: "current",
            }
        );
    }

    async openCases(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_case_list",
            {
                target: "current",
            }
        );
    }

    async openIncidents(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_warning.action_hr_warning",
            {
                target: "current",
            }
        );
    }

    async openMyCases(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_case_list",
            {
                target: "current",
            }
        );
    }

    async openWorkflow(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_case_kanban",
            {
                target: "current",
            }
        );
    }

    async openReporting(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_dashboard_monthly",
            {
                target: "current",
            }
        );
    }

    async openReportingBytype(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_dashboard_by_type",
            {
                target: "current",
            }
        );
    }

    async openGrievanceTypes(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_types_categories",
            {
                target: "current",
            }
        );
    }

    async openGrievanceStages(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_stage",
            {
                target: "current",
            }
        );
    }

    async openGrievanceRules(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_escalation_rule",
            {
                target: "current",
            }
        );
    }

    async openGrievanceResolution(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_resolution",
            {
                target: "current",
            }
        );
    }

    async openGrievancePanel(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_panel",
            {
                target: "current",
            }
        );
    }

    async openGrievanceDocumentTemplates(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "grievance_management.action_grievance_document_template",
            {
                target: "current",
            }
        );
    }

     
}
// CustomListRenderer.components = { ...ExpenseDashboardListRenderer.components, ExpenseDashboard};
CustomListRenderer.template = "grievance_management.CustomListRenderer";

export const CustomDashboardListView = {
    ...listView,
    Renderer: CustomListRenderer,
};

registry.category("views").add("grievance_management_dashboard_list", CustomDashboardListView);