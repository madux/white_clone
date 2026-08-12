/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class CleonInterfaceSwitcher extends Component {
    static template = "hr_time_management.InterfaceSwitcher";

    setup() {
        this.action = useService("action");
        this.user = useService("user");
        this.state = useState({allowed: false, open: false, mode: "admin"});
        onWillStart(async () => {
            this.state.allowed = await this.user.hasGroup("base.group_system");
            this.state.mode = window.localStorage.getItem("cleonhr_interface_mode") === "employee" ? "employee" : "admin";
        });
    }

    toggle() {
        this.state.open = !this.state.open;
    }

    async selectMode(mode) {
        if (!this.state.allowed) {
            return;
        }
        this.state.mode = mode;
        this.state.open = false;
        window.localStorage.setItem("cleonhr_interface_mode", mode);
        window.dispatchEvent(new CustomEvent("cleonhr-interface-mode-change", {detail: {mode}}));
        const action = mode === "employee"
            ? "hr_time_management.action_employee_portal"
            : "hr_time_management.action_time_management";
        await this.action.doAction(action, {clearBreadcrumbs: true});
    }
}

registry.category("systray").add("hr_time_management.InterfaceSwitcher", {
    Component: CleonInterfaceSwitcher,
}, {sequence: 25});
