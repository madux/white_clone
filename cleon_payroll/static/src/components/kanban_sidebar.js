
/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { useState } from "@odoo/owl";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { kanbanView } from "@web/views/kanban/kanban_view";

export class CustomPayrollKanbanRenderer extends KanbanRenderer {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.userService = useService("user");

        // Do not overwrite the state used by Odoo's KanbanRenderer.
        this.sidebarState = useState({
            expandedMenus: {
                overview: true,
                payroll: false,
                setups: false,
                compliance: false,
            },
            activeMenu: "overview_dashboard",
        });
    }

    toggleMenu(ev) {
        ev.preventDefault();

        const menu = ev.currentTarget.dataset.menu;

        if (
            !menu ||
            !Object.prototype.hasOwnProperty.call(
                this.sidebarState.expandedMenus,
                menu
            )
        ) {
            return;
        }

        this.sidebarState.expandedMenus[menu] =
            !this.sidebarState.expandedMenus[menu];
    }

    async openRecord(ev) {
        ev.preventDefault();

        const selectedLink = ev.currentTarget;
        const actionRef = selectedLink.dataset.action;
        const menuKey = selectedLink.dataset.menu;
        const selectedKey = selectedLink.dataset.key;

        if (selectedKey) {
            this.sidebarState.activeMenu = selectedKey;
        }

        if (
            menuKey &&
            Object.prototype.hasOwnProperty.call(
                this.sidebarState.expandedMenus,
                menuKey
            )
        ) {
            this.sidebarState.expandedMenus[menuKey] = true;
        }

        if (!actionRef) {
            return;
        }

        await this.action.doAction(actionRef, {
            target: "new",
        });
    }
}

CustomPayrollKanbanRenderer.template =
    "cleon_payroll_dashboard.CustomPayrollKanbanRenderer";

export const PayrollKanbanRenderer = {
    ...kanbanView,
    Renderer: CustomPayrollKanbanRenderer,
};

registry.category("views").add(
    "payroll_kanban_sidebar",
    PayrollKanbanRenderer
);
