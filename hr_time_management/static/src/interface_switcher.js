/** @odoo-module **/

import { onWillStart } from "@odoo/owl";
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

registry.category("user_menuitems").add("cleonhr_switch_role", (env) => ({
    type: "item",
    id: "cleonhr_switch_role",
    description: "Switch Role",
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
}));
