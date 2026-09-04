/** @odoo-module **/

import { Component, onWillStart, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CalendarSidebar extends Component {
    static template = "hr_leave_dashboard.CalendarSidebar";
    static props = {
        activeMenu: { type: String, optional: true },
        onOpenSetup: { type: Function, optional: true },
        mode: { type: String, optional: true },
    };

    setup() {
        this.action = useService("action");
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.state = useState({
            collapsed: localStorage.getItem("cleonhr_leave_sidebar_collapsed") === "1",
            access: {
                hasPersonalScope: false,
                canApprove: false,
                canOperate: false,
                canConfigure: false,
                canViewAudit: false,
                canViewReports: false,
            },
            pending: 0,
        });
        onWillStart(async () => {
            const profile = await this.orm.call("hr.leave", "get_leave_access_profile", []);
            this.state.access = {
                hasPersonalScope: profile.has_personal_scope,
                canApprove: profile.can_approve,
                canOperate: profile.can_operate,
                canConfigure: profile.can_configure,
                canViewAudit: profile.can_view_audit,
                canViewReports: profile.can_view_reports,
            };
            this.state.pending = profile.pending_approvals || 0;
        });
        this.externalToggle = () => this.toggleCollapsed();
        onMounted(() => { this.applyCollapsedClass(); window.addEventListener("cleonhr:toggle-leave-sidebar", this.externalToggle); });
        onWillUnmount(() => { window.removeEventListener("cleonhr:toggle-leave-sidebar", this.externalToggle); document.documentElement.classList.remove("o_leave_sidebar_collapsed"); });
    }

    applyCollapsedClass() { document.documentElement.classList.toggle("o_leave_sidebar_collapsed", this.state.collapsed); }
    toggleCollapsed() { this.state.collapsed = !this.state.collapsed; localStorage.setItem("cleonhr_leave_sidebar_collapsed", this.state.collapsed ? "1" : "0"); this.applyCollapsedClass(); }
    openDashboard() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openOperationsRequests() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_requests_custom");
    }

    openSetupExperience() {
        if (this.props.onOpenSetup) {
            this.props.onOpenSetup();
        } else {
            this.action.doAction("hr_leave_dashboard.action_hr_leave_get_started");
        }
    }

    openTour() { this.notification.add("Your Leave menu combines personal, approval, and administrative sections according to your current permissions.", { title: "Leave Management Tour", type: "info" }); }

    openCalendar() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");
    }

    async openRequests() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests");
    }

    openApprovals() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests");
    }

    openConfiguration() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_configuration");
    }

    openReports() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom");
    }

    openAuditLog() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_audit_custom");
    }

}
