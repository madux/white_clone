/** @odoo-module **/

import { Component } from "@odoo/owl";

const TABS = [
    { key: "overview", label: "Overview", icon: "fa-th-large" },
    { key: "candidates", label: "Candidates", icon: "fa-users" },
    { key: "pipeline", label: "Pipeline", icon: "fa-columns" },
    { key: "ai_interview", label: "AI Interview", icon: "fa-magic" },
    { key: "calendar", label: "Calendar", icon: "fa-calendar" },
    { key: "notes", label: "Notes", icon: "fa-sticky-note" },
    { key: "reports", label: "Reports", icon: "fa-bar-chart" },
    { key: "sourcing", label: "Sourcing", icon: "fa-search" },
];

export class JobHeader extends Component {
    static template = "hr_job_dashboard.JobHeader";
    static props = {
        job: Object, // { name, department, city, state, candidateCount, daysOpen, published }
        activeTab: String,
        onTabChange: Function,
        onBack: { type: Function, optional: true },
        onAddCandidate: { type: Function, optional: true },
    };

    get tabs() {
        return TABS;
    }

    isActive(key) {
        return key === this.props.activeTab;
    }
}
