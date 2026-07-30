/** @odoo-module **/

import { Component } from "@odoo/owl";

export class JobSideBar extends Component {
    static template = "hr_job_dashboard.JobSideBar";
    static props = {
        activeSection: String,
        onNavigate: Function,     // (sectionKey) => void
    };

    isActive(key) {
        return key === this.props.activeSection;
    }

    // Each of these just reports which section was clicked. The parent
    // (JobDashboard) decides what "opening" that section actually means —
    // swap a panel in place, or doAction() to a different Odoo view.
    openDashboard() { this.props.onNavigate("dashboard"); }
    openGetStarted() { this.props.onNavigate("get_started"); }
    openJobs() { this.props.onNavigate("jobs"); }
    openCandidates() { this.props.onNavigate("candidates"); }
    openOffersHired() { this.props.onNavigate("offers_hired"); }
    openVendors() { this.props.onNavigate("vendors"); }
    openRequisition() { this.props.onNavigate("requisition"); }
    openCbtTest() { this.props.onNavigate("cbt_test"); }
    openTalentMobility() { this.props.onNavigate("talent_mobility"); }
    openSettings() { this.props.onNavigate("settings"); }
    onCollapse() { /* toggle a collapsed prop/state if you want it foldable */ }
}