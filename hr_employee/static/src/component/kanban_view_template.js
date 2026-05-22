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