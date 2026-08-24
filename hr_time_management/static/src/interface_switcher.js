/** @odoo-module **/

import { markup, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { UserMenu } from "@web/webclient/user_menu/user_menu";

const interfaceAccess = new WeakMap();

patch(UserMenu.prototype, {
    setup() {
        super.setup(...arguments);
        const orm = useService("orm");
        onWillStart(async () => {
            try {
                interfaceAccess.set(this.env, await orm.call("cleon.time.policy", "get_cleon_access", []));
            } catch {
                interfaceAccess.set(this.env, {can_switch_interface: false});
            }
        });
    },
});

registry.category("user_menuitems").add("cleonhr_switch_role", (env) => {
    const isEmployeeMode = window.localStorage.getItem("cleonhr_interface_mode") === "employee";
    const targetRole = isEmployeeMode ? "Admin" : "Employee";
    return {
        type: "item",
        id: "cleonhr_switch_role",
        description: markup(
            `<div class="d-flex align-items-center justify-content-between p-0 w-100">
                <span class="d-inline-flex align-items-center gap-2">
                    <i class="fa fa-refresh text-muted"></i>
                    <span>Switch Role</span>
                </span>
                <span class="text-muted ms-3 small" style="font-weight: 500;">&rarr; ${targetRole}</span>
            </div>`
        ),
        hide: !interfaceAccess.get(env)?.can_switch_interface,
        sequence: 55,
        callback: async () => {
            const current = window.localStorage.getItem("cleonhr_interface_mode") === "employee" ? "employee" : "admin";
            const mode = current === "admin" ? "employee" : "admin";
            window.localStorage.setItem("cleonhr_interface_mode", mode);
            document.documentElement.classList.toggle("has-cleon-employee-portal", mode === "employee");
            window.CleonAppLauncher?.load();
            await env.services.action.doAction(
                mode === "employee" ? "white_clone_portal.action_employee_portal_home" : "hr_time_management.action_time_management",
                {clearBreadcrumbs: true}
            );
        },
    };
});
