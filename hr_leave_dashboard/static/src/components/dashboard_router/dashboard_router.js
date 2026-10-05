/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { HrLeaveDashboard } from "../../js/dashboard";
import { EmployeeLeaveDashboard } from "../employee_dashboard/employee_dashboard";
import { CalendarSidebar } from "../calendar_sidebar";
import { EmployeeRequestModal } from "../employee_request_modal/employee_request_modal";

export class LeaveDashboardRouter extends Component {
    static template = "hr_leave_dashboard.DashboardRouter";
    static components = { HrLeaveDashboard, EmployeeLeaveDashboard, CalendarSidebar, EmployeeRequestModal };
    static props = { "*": true };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        const contextMode = this.props.action?.context?.dashboard_view;

        this.state = useState({
            loading: true,
            access: {},
            personalData: null,
            viewMode: "organisation", // "organisation" | "personal"
            requestOpen: false,
            revision: 0,
        });

        onWillStart(async () => {
            await this.loadData(contextMode);
        });
    }

    async loadData(preferredMode) {
        this.state.loading = true;
        try {
            this.state.access = await this.orm.call(
                "hr.leave", "get_leave_access_profile", []
            );
            if (this.state.access.has_personal_scope) {
                try {
                    this.state.personalData = await this.orm.call(
                        "hr.leave", "get_employee_dashboard_data", []
                    );
                } catch (e) {
                    console.warn("Could not load employee dashboard data:", e);
                }
            }

            if (preferredMode === "organisation" && this.state.access.show_organisation_dashboard) {
                this.state.viewMode = "organisation";
            } else if (preferredMode === "personal" && this.state.access.has_personal_scope) {
                this.state.viewMode = "personal";
            } else if (this.state.access.show_organisation_dashboard) {
                this.state.viewMode = "organisation";
            } else {
                this.state.viewMode = "personal";
            }
        } catch (error) {
            console.error("Error loading leave dashboard access profile:", error);
        } finally {
            this.state.loading = false;
        }
    }

    switchView(mode) {
        if (mode === "organisation" && !this.state.access.show_organisation_dashboard) return;
        if (mode === "personal" && !this.state.access.has_personal_scope) return;
        if (this.state.viewMode !== mode) {
            this.state.viewMode = mode;
        }
    }

    toggleSidebar() {
        window.dispatchEvent(new CustomEvent("cleonhr:toggle-leave-sidebar"));
    }

    requestLeave() { this.state.requestOpen = true; }
    closeRequest() { this.state.requestOpen = false; }

    async requestSubmitted() {
        this.state.requestOpen = false;
        this.state.revision += 1;
        if (this.state.access.has_personal_scope) {
            try {
                this.state.personalData = await this.orm.call(
                    "hr.leave", "get_employee_dashboard_data", []
                );
            } catch (e) {
                console.warn("Could not reload personal leave data:", e);
            }
        }
    }

    openMyRequests() { return this.openRequestWorkspace("my"); }
    openApprovals() { return this.openRequestWorkspace("approvals"); }
    openRequestWorkspace(tab) {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests", {
            additionalContext: { request_workspace_tab: tab },
        });
    }
    openBalances() { return this.openConfiguration("balances"); }
    openLeaveTypes() { return this.openConfiguration("policies"); }
    openHolidays() { return this.openConfiguration("holidays"); }
    openApprovalSettings() { return this.openConfiguration("approvals"); }
    openConfiguration(tab = "policies") {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_configuration", {
            additionalContext: { configuration_tab: tab },
        });
    }
    openReports() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom"); }
    openAudit() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_audit_custom"); }
}
registry.category("actions").add("hr_leave_dashboard.Router", LeaveDashboardRouter);
