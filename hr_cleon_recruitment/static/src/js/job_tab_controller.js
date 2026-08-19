/** @odoo-module **/

import { Component, useState, onMounted, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "candidates", label: "Candidates" },
    { id: "pipeline", label: "Pipeline" },
    { id: "collaboration", label: "Collaboration" },
    { id: "reports", label: "Reports" },
    { id: "sourcing", label: "Sourcing" },
    { id: "status", label: "Status" },
];

export class JobTabs extends Component {
    static template = "hr_cleon_recruitment.JobTabs";
    static props = { ...standardWidgetProps };
    setup() {
        this.state = useState({ active: "overview" });
        this.TABS = TABS;

        // Re-apply visibility whenever active tab changes, and on (re)mount
        useEffect(
            () => {
                this.applyVisibility();
            },
            () => [this.state.active]
        );
        onMounted(() => this.applyVisibility());
    }

    setActive(tabId) {
        this.state.active = tabId;
    }

    applyVisibility() {
        document
            .querySelectorAll(".jb-detail-dashboard-layout-matrix")
            .forEach((el) => {
                el.classList.toggle("d-none", el.dataset.section !== this.state.active);
            });
    }
}

registry.category("view_widgets").add("job_tabs", {
    component: JobTabs,
}); 