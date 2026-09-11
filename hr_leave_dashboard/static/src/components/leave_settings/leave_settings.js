/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";

const SETTINGS_TAB_STORAGE_KEY = "hr_leave_dashboard.leave_settings.active_tab";
const SETTINGS_TABS = new Set([
    "general", "rules", "calendar", "notifications", "lifecycle", "integrations",
]);

export class LeaveSettingsPage extends Component {
    static template = "hr_leave_dashboard.LeaveSettingsPage";
    static components = { CalendarSidebar };
    static props = { embedded: { type: Boolean, optional: true }, onOpenLeaveTypes: { type: Function, optional: true }, "*": true };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({
            loading: true,
            saving: false,
            data: null,
            form: {},
            baseline: "",
            activeTab: this.getRememberedTab(),
        });
        onWillStart(() => this.load());
    }

    clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    async load() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("hr.leave", "get_leave_settings", []);
            this.applyData(data);
        } catch (error) {
            this.notification.add(error?.data?.message || "Leave settings could not be loaded.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    applyData(data) {
        this.state.data = data;
        this.state.form = this.clone(data.form);
        this.state.baseline = JSON.stringify(this.state.form);
    }

    get dirty() {
        return JSON.stringify(this.state.form) !== this.state.baseline;
    }

    get selectedCountry() {
        return this.state.data?.countries.find((item) => item.id === Number(this.state.form.country_id));
    }

    get selectedCalendar() {
        return this.state.data?.calendars.find((item) => item.id === Number(this.state.form.resource_calendar_id));
    }

    toggle(field) {
        this.state.form[field] = !this.state.form[field];
    }

    getRememberedTab() {
        try {
            const tab = window.sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
            return SETTINGS_TABS.has(tab) ? tab : "general";
        } catch {
            return "general";
        }
    }

    setTab(tab) {
        if (!SETTINGS_TABS.has(tab)) return;
        this.state.activeTab = tab;
        try {
            window.sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tab);
        } catch {
            // Private browsing can disable session storage; the current page still works.
        }
    }

    async save() {
        if (!this.dirty || this.state.saving) return;
        this.state.saving = true;
        try {
            const data = await this.orm.call("hr.leave", "save_leave_settings", [this.clone(this.state.form)]);
            this.applyData(data);
            this.notification.add("Leave Management settings saved.", { type: "success" });
        } catch (error) {
            this.notification.add(error?.data?.message || "Leave settings could not be saved.", { type: "danger" });
        } finally {
            this.state.saving = false;
        }
    }

    discard() {
        this.state.form = JSON.parse(this.state.baseline || "{}");
    }

    async resetDefaults() {
        if (!window.confirm("Reset notification and new Leave Type defaults? Company country and working schedule will be kept.")) return;
        this.state.saving = true;
        try {
            const data = await this.orm.call("hr.leave", "reset_leave_policy_defaults", []);
            this.applyData(data);
            this.notification.add("Leave policy defaults restored.", { type: "success" });
        } catch (error) {
            this.notification.add(error?.data?.message || "Defaults could not be restored.", { type: "danger" });
        } finally {
            this.state.saving = false;
        }
    }

    openLeaveTypes() {
        if (this.props.onOpenLeaveTypes) return this.props.onOpenLeaveTypes();
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_configuration", {
            additionalContext: { configuration_tab: "policies" },
        });
    }

    openPublicHolidays() {
        return this.action.doAction("resource.action_resource_calendar_leave_tree");
    }

    openWorkingSchedule() {
        const calendar = this.selectedCalendar;
        if (!calendar) return;
        return this.action.doAction({
            type: "ir.actions.act_window",
            name: calendar.name,
            res_model: "resource.calendar",
            res_id: calendar.id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openAccessRights() {
        return this.action.doAction("base.action_res_users");
    }

    openAccessRole(role) {
        return this.action.doAction({
            type: "ir.actions.act_window", name: role.name, res_model: "res.groups",
            res_id: role.id, views: [[false, "form"]], target: "current",
        });
    }

    openTour() {
        this.notification.add("Company-wide settings are applied here. Rules that vary by leave category remain under Leave Types.", {
            title: "Leave Settings Guide",
            type: "info",
        });
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveSettingsPage", LeaveSettingsPage);
