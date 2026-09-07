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
    get navigationSections() {
        const access = this.state.access;
        return [
            {
                key: "workspace",
                label: "",
                items: [
                    { key: "dashboard", label: "Dashboard", icon: "fa-calendar", description: "Your personal, team, and organisation leave information in one workspace", action: "openDashboard", visible: true },
                    { key: "get_started", label: "Get Started", icon: "fa-magic", description: "Follow the guided steps to configure and launch Leave Management", action: "openSetupExperience", visible: access.canConfigure },
                    { key: "calendar", label: "Leave Calendar", icon: "fa-calendar-o", description: "Manage and visualise authorised leave, coverage, and public holidays", action: "openCalendar", visible: true },
                    { key: "requests", label: "Leave Requests", icon: "fa-file-text-o", description: "Submit, track, approve, and manage leave requests from one workspace", action: "openRequests", visible: access.hasPersonalScope || access.canApprove || access.canOperate, pending: access.canApprove ? this.state.pending : 0 },
                ],
            },
            {
                key: "administration",
                label: "HR / Admin Operations",
                items: [
                    { key: "configuration", label: "Leave Configuration", icon: "fa-cog", description: "Manage leave policies, balances, and organisation-wide settings", action: "openConfiguration", visible: access.canOperate || access.canConfigure },
                ],
            },
            {
                key: "reporting",
                label: "Reports",
                items: [
                    { key: "reports", label: "Reports", icon: "fa-line-chart", description: "Analyse permission-scoped leave activity, balances, and absence patterns", action: "openReports", visible: access.canViewReports },
                    { key: "audit", label: "Audit Log", icon: "fa-shield", description: "Track authorised leave-management actions and configuration changes", action: "openAuditLog", visible: access.canViewAudit },
                ],
            },
        ].map((section) => ({
            ...section,
            items: section.items.filter((item) => item.visible),
        })).filter((section) => section.items.length);
    }

    navigate(item) {
        return this[item.action]();
    }
    openDashboard() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
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
        this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests", {
            additionalContext: { request_workspace_tab: "my" },
        });
    }

    openApprovals() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests", {
            additionalContext: { request_workspace_tab: "approvals" },
        });
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
