/** @odoo-module **/

import { markup, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { UserMenu } from "@web/webclient/user_menu/user_menu";

const interfaceAccess = new WeakMap();
const EMPLOYEE_PORTAL_MENU_XMLID = "white_clone_portal.menu_white_clone_portal_root";

function getCurrentMenu(env) {
    const menuService = env.services.menu;
    const menuId = Number(env.services.router.current.hash.menu_id);
    return (menuId && menuService.getMenu(menuId)) || menuService.getCurrentApp();
}

function findEmployeePortal(menuService) {
    return menuService.getAll().find((menu) => menu.xmlid === EMPLOYEE_PORTAL_MENU_XMLID);
}

async function selectMenu(menuService, menu) {
    window.localStorage.setItem("cleonhr_active_app", String(menu.id));
    await menuService.selectMenu(menu);
}

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
            const menuService = env.services.menu;
            const currentMenu = getCurrentMenu(env);

            window.localStorage.setItem("cleonhr_interface_mode", mode);
            document.documentElement.classList.toggle("has-cleon-employee-portal", mode === "employee");
            window.CleonAppLauncher?.load();

            if (mode === "employee") {
                const employeePortal = findEmployeePortal(menuService);
                if (employeePortal?.actionID) {
                    await selectMenu(menuService, employeePortal);
                } else {
                    // Compatibility fallback for a database whose menu cache
                    // has not yet been refreshed after installing the portal.
                    await env.services.action.doAction("white_clone_portal.action_employee_portal_home", {
                        clearBreadcrumbs: true,
                    });
                }
                return;
            }

            // Role and application are independent. Reselect the current menu
            // so its mode-aware root action can render the admin experience.
            // This applies to Employee Portal as well: it may expose its own
            // administrator-only actions now or in the future.
            if (currentMenu?.actionID) {
                await selectMenu(menuService, currentMenu);
                return;
            }

            // If the current URL has no actionable menu, do not invent a
            // destination. Let the user choose an access-controlled app.
            window.CleonAppLauncher?.open();
            env.services.notification.add("Choose an application to continue in Admin View.", {
                type: "info",
            });
        },
    };
});
