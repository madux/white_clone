/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { kanbanView } from "@web/views/kanban/kanban_view";

export class CustomKanbanRenderer extends KanbanRenderer {

    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.userService = useService("user");
        this.actions = this.env.services.action;
    }

    async openMessage(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "mail.action_discuss",
            {
                target: "current",
            }
        );
    }

    async openEmployees(ev) {
        ev.preventDefault();
        await this.env.services.action.doAction(
            "hr_administration.action_view_employee_kanban_custom",
            {
                target: "current",
            }
        ); 
    }

    // async openEmployee(ev) {
    //     ev.preventDefault();
    //     await this.actionService.doAction(
    //         "hr_administration.action_view_employee_kanban_custom",
    //         { target: "current" }
    //     );
    // }

    async openAnnouncement(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_employee.action_hr_core_announcement",
            {
                target: "new",
            }
        );
    }
}

CustomKanbanRenderer.template = "hr_employee.CustomKanbanRenderer";

export const EmployeeKanbanRenderer = {
    ...kanbanView,
    Renderer: CustomKanbanRenderer,
};

registry.category("views").add(
    "app_dashboard_kanban",
    EmployeeKanbanRenderer
);