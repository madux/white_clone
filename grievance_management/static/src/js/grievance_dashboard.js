/** @odoo-module **/

import { registry } from "@web/core/registry";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { Component, onWillStart, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";

const STAGE_COLORS = {
    total: "#5F5E5A",
    submitted: "#378ADD",
    "under review": "#7F77DD",
    "investigation in progress": "#EF9F27",
    escalated: "#E24B4A",
    resolved: "#1D9E75",
    closed: "#B4B2A9",
};

export class GrievanceDashboard extends Component {
    static template = "grievance_management.Dashboard";
    static props = { ...standardActionServiceProps };

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.barRef = useRef("barChart");
        this.pieRef = useRef("pieChart");
        this.barChart = null;
        this.pieChart = null;

        this.state = useState({
            loading: true,
            greeting_name: "",
            stat_cards: [],
            month_labels: [],
            monthly_open: [],
            monthly_closed: [],
            by_type: [],
        });

        onWillStart(async () => {
            await loadBundle("web.chartjs_lib");
            await this.loadData();
        });

        onMounted(() => {
            this.renderCharts();
        });

        onWillUnmount(() => {
            if (this.barChart) {
                this.barChart.destroy();
            }
            if (this.pieChart) {
                this.pieChart.destroy();
            }
        });
    }

    async loadData() {
        const data = await this.orm.call("grievance.case", "get_dashboard_data", []);
        Object.assign(this.state, data, { loading: false });
    }

    get greeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }

    cardColor(key) {
        return STAGE_COLORS[key] || "#5F5E5A";
    }

    renderCharts() {
        if (!window.Chart || !this.barRef.el || !this.pieRef.el) {
            return;
        }
        const isDark = document.documentElement.dataset.mode === "dark";
        const textColor = isDark ? "#c2c0b6" : "#3d3d3a";
        const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

        this.barChart = new window.Chart(this.barRef.el, {
            type: "bar",
            data: {
                labels: this.state.month_labels,
                datasets: [
                    {
                        label: "Open",
                        data: this.state.monthly_open,
                        backgroundColor: "#378ADD",
                        borderRadius: 4,
                    },
                    {
                        label: "Closed / Resolved",
                        data: this.state.monthly_closed,
                        backgroundColor: "#1D9E75",
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor } } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { display: false } },
                    y: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
                },
            },
        });

        const palette = ["#7F77DD", "#1D9E75", "#D85A30", "#D4537E", "#378ADD", "#BA7517", "#888780"];
        this.pieChart = new window.Chart(this.pieRef.el, {
            type: "pie",
            data: {
                labels: this.state.by_type.map((t) => t.label),
                datasets: [
                    {
                        data: this.state.by_type.map((t) => t.count),
                        backgroundColor: this.state.by_type.map((_, i) => palette[i % palette.length]),
                        borderWidth: 1,
                        borderColor: isDark ? "#1e1e1c" : "#ffffff",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "right", labels: { color: textColor } } },
            },
        });
    }

    openCases(stageLabel) {
        const domain = stageLabel && stageLabel !== "Total" ? [["stage_id.name", "=", stageLabel]] : [];
        this.actionService.doAction({
            type: "ir.actions.act_window",
            name: stageLabel || "All Cases",
            res_model: "grievance.case",
            views: [
                [false, "list"],
                [false, "form"],
            ],
            domain,
        });
    }
}

registry.category("actions").add("grievance_dashboard", GrievanceDashboard);
