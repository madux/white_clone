/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { TimeManagementApp } from "@hr_time_management/time_management";
import { EmployeeLeaveDashboard } from "@hr_leave_dashboard/components/employee_dashboard/employee_dashboard";
import { MyLeaveRequestsPage } from "@hr_leave_dashboard/components/my_leave_requests/my_leave_requests";
import { LeaveCalendarPage } from "@hr_leave_dashboard/js/leave_calendar";

export class EmployeePortalApp extends Component {
    static template = "white_clone_portal.EmployeePortal";
    static props = ["*"];
    static components = {
        TimeManagementApp,
        EmployeeLeaveDashboard,
        MyLeaveRequestsPage,
        LeaveCalendarPage,
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({
            page: this.props.action?.params?.initial_page || "dashboard",
            access: null,
            employeeData: null,
            profileOpen: true,
            leaveOpen: true,
            timeOpen: true,
        });
        onWillStart(async () => {
            const [access, employeeData] = await Promise.all([
                this.orm.call("cleon.time.policy", "get_cleon_access", []),
                this.orm.call("hr.attendance", "get_cleon_employee_data", []),
            ]);
            this.state.access = access;
            this.state.employeeData = employeeData;
            if (!this.isPageAllowed(this.state.page)) {
                this.state.page = "dashboard";
            }
            // Opening Employee Portal must not change the user's selected
            // interface role. The portal is an application, not a role switch,
            // and may contain administrator-only actions when in Admin View.
            document.documentElement.classList.add("has-cleon-employee-portal");
            window.CleonAppLauncher?.load();
        });
        onWillUnmount(() => {
            document.documentElement.classList.remove("has-cleon-employee-portal");
        });
    }

    get featureAccess() {
        return this.state.access?.featureAccess || {};
    }

    get portalModules() {
        return this.state.access?.portalModules || {};
    }

    get timeAction() {
        return {
            params: {
                force_employee_portal: true,
                employee_page: this.state.page,
            },
        };
    }

    isPageAllowed(page) {
        if (page === "dashboard") return true;
        if (["leave", "leaveRequests", "leaveCalendar"].includes(page)) return Boolean(this.portalModules.leave);
        const feature = {clock: "attendance", history: "attendance", regularizations: "attendance", overtime: "overtime"}[page];
        return Boolean(feature && this.featureAccess[feature]);
    }

    setPage(page) {
        if (!this.isPageAllowed(page)) {
            this.notification.add("This employee application is not included in your company subscription.", {type: "warning"});
            return;
        }
        this.state.page = page;
    }

    toggleSection(section) {
        this.state[`${section}Open`] = !this.state[`${section}Open`];
    }
}

registry.category("actions").add("white_clone_portal.EmployeePortal", EmployeePortalApp);
