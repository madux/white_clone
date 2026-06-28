
/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, useRef, onMounted, onWillUnmount, onWillStart } from "@odoo/owl";
import { loadJS } from "@web/core/assets";
import { rpc } from "@web/core/network/rpc";

export class HrLeaveDashboard extends Component {
    static template = "hr_leave_dashboard.Dashboard2";

    setup() {
        this.state = useState({
            months: 6,
            kpis: {},
            trends: { labels: [], total: [], approved: [], pending: [], rejected: [], summary: {} },
            byType: [],
            balance: [],
            approval: { approved: 0, pending: 0, rejected: 0, approval_rate: 0 },
            loading: true,
        });

        // refs — Owl guarantees these are populated once mounted
        this.trendsCanvasRef = useRef("trendsCanvas");
        this.byTypeCanvasRef = useRef("byTypeCanvas");
        this.approvalCanvasRef = useRef("approvalCanvas");

        this.charts = {};

        onWillStart(async () => {
            await loadJS("/web/static/lib/Chart/Chart.js");
        });

        onMounted(() => {
            this.fetchAndRender(this.state.months);
        });

        onWillUnmount(() => {
            Object.values(this.charts).forEach((c) => c && c.destroy());
        });
    }

    async setRange(months) {
        this.state.months = months;
        await this.fetchAndRender(months);
    }

    async fetchAndRender(months) {
        this.state.loading = true;
        try {
            // rpc() is Odoo 17's modern fetch-based RPC helper — auto-cancels
            // outdated calls tied to this component when it unmounts.
            const data = await rpc("/hr_leave_dashboard/data", { months });

            // No manual "is this.el still alive" check needed —
            // if the component was destroyed, Owl simply won't re-render.
            this.state.kpis = data.kpis;
            this.state.trends = data.trends;
            this.state.byType = data.by_type;
            this.state.balance = data.balance;
            this.state.approval = data.approval_overview;

            this.renderCharts();
        } catch (e) {
            console.error("Dashboard load failed", e);
        } finally {
            this.state.loading = false;
        }
    }

    renderCharts() {
        this.renderTrendsChart();
        this.renderByTypeChart();
        this.renderApprovalChart();
    }

    renderTrendsChart() {
        const canvas = this.trendsCanvasRef.el; // guaranteed present post-mount
        if (!canvas) return;
        const d = this.state.trends;
        if (this.charts.trends) this.charts.trends.destroy();
        this.charts.trends = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: d.labels,
                datasets: [
                    { label: "Total", data: d.total, borderColor: "#e91e8c", tension: 0.4, fill: true, backgroundColor: "rgba(233,30,140,0.08)" },
                    { label: "Approved", data: d.approved, borderColor: "#17a673", tension: 0.4 },
                    { label: "Pending", data: d.pending, borderColor: "#f0ad4e", tension: 0.4 },
                    { label: "Rejected", data: d.rejected, borderColor: "#dc3545", tension: 0.4 },
                ],
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
        });
    }

    renderByTypeChart() {
        const canvas = this.byTypeCanvasRef.el;
        if (!canvas) return;
        const items = this.state.byType;
        const palette = ["#4e73df", "#e74a3b", "#e91e8c", "#f6a623", "#1cc88a", "#36b9cc", "#6f42c1", "#858796"];
        if (this.charts.byType) this.charts.byType.destroy();
        this.charts.byType = new Chart(canvas.getContext("2d"), {
            type: "doughnut",
            data: { labels: items.map((i) => i.name), datasets: [{ data: items.map((i) => i.count), backgroundColor: palette }] },
            options: { plugins: { legend: { display: false } }, cutout: "70%" },
        });
    }

    renderApprovalChart() {
        const canvas = this.approvalCanvasRef.el;
        if (!canvas) return;
        const a = this.state.approval;
        if (this.charts.approval) this.charts.approval.destroy();
        this.charts.approval = new Chart(canvas.getContext("2d"), {
            type: "doughnut",
            data: { datasets: [{ data: [a.approved, a.pending, a.rejected], backgroundColor: ["#1cc88a", "#f6c343", "#e74a3b"] }] },
            options: { cutout: "75%", plugins: { legend: { display: false } } },
        });
    }
}

registry.category("actions").add("hr_leave_dashboard2", HrLeaveDashboard);