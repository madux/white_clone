/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { CalendarSidebar } from "../calendar_sidebar";
import { LeaveTypesPage } from "../leave_types/leave_types_page";
import { LeaveBalancesPage } from "../leave_balances/leave_balances";
import { LeaveSettingsPage } from "../leave_settings/leave_settings";

export class LeaveConfiguration extends Component {
    static template = "hr_leave_dashboard.LeaveConfiguration";
    static components = {
        CalendarSidebar,
        LeaveTypesPage,
        LeaveBalancesPage,
        LeaveSettingsPage,
    };
    static props = { ...standardActionServiceProps };

    setup() {
        this.orm = useService("orm");
        this.state = useState({ loading: true, access: {}, activeTab: null });
        onWillStart(async () => {
            this.state.access = await this.orm.call("hr.leave", "get_leave_access_profile", []);
            const requested = this.props.action?.context?.configuration_tab;
            const permitted = this.availableTabs.map((tab) => tab.key);
            this.state.activeTab = permitted.includes(requested) ? requested : permitted[0] || null;
            this.state.loading = false;
        });
    }

    get availableTabs() {
        const tabs = [];
        if (this.state.access.can_configure) {
            tabs.push({ key: "leave_types", label: "Leave Types", icon: "fa-tags" });
        }
        if (this.state.access.can_operate) {
            tabs.push({ key: "balances", label: "Leave Balances", icon: "fa-balance-scale" });
        }
        if (this.state.access.can_configure) {
            tabs.push({ key: "general", label: "General Settings", icon: "fa-sliders" });
        }
        return tabs;
    }

    setTab(tab) {
        if (this.availableTabs.some((item) => item.key === tab)) this.state.activeTab = tab;
    }

    openLeaveTypes() {
        this.setTab("leave_types");
    }

    toggleSidebar() {
        window.dispatchEvent(new CustomEvent("cleonhr:toggle-leave-sidebar"));
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveConfiguration", LeaveConfiguration);
