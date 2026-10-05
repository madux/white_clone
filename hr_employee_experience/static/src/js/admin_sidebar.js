/** @odoo-module **/
import { Component, useState } from "@odoo/owl";

import { FormController } from "@web/views/form/form_controller";
import { registry }       from "@web/core/registry";
import { patch }          from "@web/core/utils/patch";
import { useService }     from "@web/core/utils/hooks";
import { onMounted, onWillUnmount } from "@odoo/owl";
import { formView } from "@web/views/form/form_view";

export class AdminSidebar extends Component {
setup() {
        super.setup();
        this.orm     = useService("orm");
        this.action  = useService("action");

        // Calendar state
        this._currentDate  = new Date();
        this._currentCalView = "list";  // list | month | week | day
        this._cachedEvents = [];

        // onMounted(() => this._onMount());
        // onWillUnmount(() => this._onDestroy());
        this.state = useState({ collapsed: false, active: "dashboard" });
        this.menuItems = [
            { id: "dashboard", label: "Dashboard", icon: "fa-calendar", badge: 2, action: "openRecord" },
            { id: "profiles", label: "Employee Profiles", icon: "fa-users", action: "openCustomHearings" },
            { id: "org_chart", label: "Organisation Chart", icon: "fa-building", badge: 2, href: "/organisation-chart" },
            { id: "messages", label: "Messages", icon: "fa-comments", iconClass: "green_badge_status", action: "openMessage" },
            { id: "meeting", label: "Meeting", icon: "fa-calendar", action: "openCalendar" },
            { id: "vacations", label: "Vacations", icon: "fa-plane", iconClass: "green_badge_status", action: "openRecord" },
            { id: "announcement", label: "Announcement", icon: "fa-bell", action: "openAnnouncement" },
            { id: "disciplinary", label: "Disciplinary", icon: "fa-frown-o", iconClass: "yellow_badge_status", action: "openCustomAppeal" },
            { id: "positions", label: "Positions", icon: "fa-id-badge", iconClass: "red_badge_status", href: "/incident-reporting" },
            { id: "tasks", label: "Task & Assignments", icon: "fa-thumb-tack", iconClass: "yellow_badge_status", action: "openRecord" },
            { id: "active_staff", label: "Active Staff", icon: "fa-star", iconClass: "green_badge_status", action: "openRecord" },
            { id: "terminated_staff", label: "Terminated Staff", icon: "fa-ban", iconClass: "red_badge_status", action: "openRecord" },
            { id: "setting", label: "Setting", icon: "fa-cog", action: "openInvestigations" },
        ];
    }
    toggleCollapse() {
        this.state.collapsed = !this.state.collapsed;
    }

    onItemClick(item) {
        this.state.active = item.id;
        if (item.href) {
            return; // let the <a href> handle navigation
        }
        if (item.action && this.props.onNavigate) {
            this.props.onNavigate(item.action);
        }
    }

}

AdminSidebar.template = "hr_exployee_experience.AdminSidebar";

// Register
registry.category("views").add("experience_sidebar_form", {
    ...registry.category("views").get("form"),
    Controller: AdminSidebar,
});



// export class AdminSidebar extends Component {
//     static template = "hr_exployee_experience.AdminSidebar";
//     static props = {
//         onNavigate: { type: Function, optional: true },
//     };

//     setup() {
//         this.state = useState({ collapsed: false, active: "dashboard" });

//         this.menuItems = [
//             { id: "dashboard", label: "Dashboard", icon: "fa-calendar", badge: 2, action: "openRecord" },
//             { id: "profiles", label: "Employee Profiles", icon: "fa-users", action: "openCustomHearings" },
//             { id: "org_chart", label: "Organisation Chart", icon: "fa-building", badge: 2, href: "/organisation-chart" },
//             { id: "messages", label: "Messages", icon: "fa-comments", iconClass: "green_badge_status", action: "openMessage" },
//             { id: "meeting", label: "Meeting", icon: "fa-calendar", action: "openCalendar" },
//             { id: "vacations", label: "Vacations", icon: "fa-plane", iconClass: "green_badge_status", action: "openRecord" },
//             { id: "announcement", label: "Announcement", icon: "fa-bell", action: "openAnnouncement" },
//             { id: "disciplinary", label: "Disciplinary", icon: "fa-frown-o", iconClass: "yellow_badge_status", action: "openCustomAppeal" },
//             { id: "positions", label: "Positions", icon: "fa-id-badge", iconClass: "red_badge_status", href: "/incident-reporting" },
//             { id: "tasks", label: "Task & Assignments", icon: "fa-thumb-tack", iconClass: "yellow_badge_status", action: "openRecord" },
//             { id: "active_staff", label: "Active Staff", icon: "fa-star", iconClass: "green_badge_status", action: "openRecord" },
//             { id: "terminated_staff", label: "Terminated Staff", icon: "fa-ban", iconClass: "red_badge_status", action: "openRecord" },
//             { id: "setting", label: "Setting", icon: "fa-cog", action: "openInvestigations" },
//         ];
//     }

//     toggleCollapse() {
//         this.state.collapsed = !this.state.collapsed;
//     }

//     onItemClick(item) {
//         this.state.active = item.id;
//         if (item.href) {
//             return; // let the <a href> handle navigation
//         }
//         if (item.action && this.props.onNavigate) {
//             this.props.onNavigate(item.action);
//         }
//     }
// }