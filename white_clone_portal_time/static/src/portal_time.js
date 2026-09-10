/** @odoo-module **/
import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { employeePortalRegistry } from "@white_clone_portal/portal_registry";
import { TimeManagementApp } from "@hr_time_management/time_management";

export class TimePortalCards extends Component {
    static template = "white_clone_portal_time.Dashboard";
    static props = { data: Object, access: Object, navigate: Function };
}
employeePortalRegistry.add("time", {
    id: "time", label: _t("Time & Attendance"), icon: "fa-clock-o",
    async load({ orm }) {
        const access = await orm.call("cleon.time.policy", "get_cleon_access", []);
        const context = { access };
        if (access.has_employee && access.portalModules.time) {
            const data = await orm.call("hr.attendance", "get_cleon_employee_data", []);
            context.employeeName = data.employee;
            context.dashboard = { data, access: access.featureAccess };
        }
        return context;
    },
    dashboard: TimePortalCards,
    pages: [
        { id: "clock", label: _t("Clock In / Out"), icon: "fa-clock-o", feature: "attendance", welcome: true },
        { id: "history", label: _t("My Attendance"), icon: "fa-calendar-check-o", feature: "attendance" },
        { id: "regularizations", label: _t("My Correction Requests"), icon: "fa-pencil-square-o", feature: "attendance" },
        { id: "overtime", label: _t("Overtime Requests"), icon: "fa-hourglass-half", feature: "overtime" },
    ].map((page, index) => ({
        ...page, sequence: (index + 1) * 10, component: TimeManagementApp,
        props: { portalEmbedded: true, action: { params: { force_employee_portal: true, employee_page: page.id } } },
        visible: context => Boolean(context.access.has_employee && context.access.portalModules.time && context.access.featureAccess[page.feature]),
    })),
}, { sequence: 30 });
