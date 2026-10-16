/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, useState } from "@odoo/owl";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

class PayrollAppLink extends Component {
    static template = "cleon_payroll.PayrollAppLink";
    static props = { ...standardFieldProps };

    setup() {
        this.action = useService("action");

        this.state = useState({
            expandedMenus: {
                overview: true,
                payroll: false,
                setups: false,
                compliance: false,
            },
            activeMenu: "overview",
        });
    }

    /**
     * Toggle a parent menu.
     * Children are displayed beneath their parent.
     */
    toggleMenu(ev) {
        ev.preventDefault();

        const menu = ev.currentTarget.dataset.menu;

        if (!menu) {
            return;
        }

        this.state.expandedMenus[menu] =
            !this.state.expandedMenus[menu];
    }

    /**
     * Open Pay Cycles.
     */
    openPayCycles(ev) {
        ev.preventDefault();

        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Pay Cycles",
            res_model: "hr.payroll.cycle",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        });
    }

    /**
     * Highlight the selected child menu and open its Odoo action.
     */
    async openRecord(ev) {
        ev.preventDefault();

        const selectedLink = ev.currentTarget;
        const actionRef = selectedLink.dataset.action;
        const menuKey = selectedLink.dataset.menu;

        // Highlight the selected menu.
        this.state.activeMenu = selectedLink.dataset.key || actionRef;

        // Expand the parent when one of its children is selected.
        if (menuKey && this.state.expandedMenus[menuKey] !== undefined) {
            this.state.expandedMenus[menuKey] = true;
        }

        // Keep the existing Odoo action navigation behavior.
        if (actionRef) {
            await this.action.doAction(actionRef, {
                target: "current",
            });
        }
    }
}

registry.category("fields").add("payroll_app_link", {
    component: PayrollAppLink,
});
