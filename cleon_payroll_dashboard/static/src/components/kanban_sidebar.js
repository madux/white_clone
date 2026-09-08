/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { kanbanView } from "@web/views/kanban/kanban_view";

export class CustomPayrollKanbanRenderer extends KanbanRenderer {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.userService = useService("user");
    }

    async openRecord(ev) {
        ev.preventDefault();
        // action_ref = "mail.action_discuss",
        const actionRef = ev.currentTarget.dataset.action;
        await this.env.services.action.doAction(
            action_ref,
            {
                target: "new",
            }
        );
    } 
}

CustomPayrollKanbanRenderer.template = "cleon_payroll_dashboard.CustomPayrollKanbanRenderer";

export const PayrollKanbanRenderer = {
    ...kanbanView,
    Renderer: CustomPayrollKanbanRenderer,
};

registry.category("views").add(
    "payroll_kanban_sidebar",
    PayrollKanbanRenderer
);