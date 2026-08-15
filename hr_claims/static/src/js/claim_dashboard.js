/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useEffect, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";

export class HrClaimDashboard extends Component {
    static template = "hr_claims.ClaimDashboard";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.statusChartRef = useRef("statusChart");
        this.trendChartRef = useRef("trendChart");
        this.departmentChartRef = useRef("departmentChart");
        this.charts = {};
        this.state = useState({ loading: true, data: null, revision: 0 });

        onWillStart(async () => {
            await loadBundle("web.chartjs_lib");
            await this.refresh();
        });
        useEffect(
            () => {
                if (!this.state.loading && this.state.data) {
                    this.renderCharts();
                }
                return () => this.destroyCharts();
            },
            () => [this.state.revision, this.state.loading]
        );
        onWillUnmount(() => this.destroyCharts());
    }

    async refresh() {
        this.state.loading = true;
        try {
            this.state.data = await this.orm.call("hr.claim", "get_dashboard_data", []);
            this.state.revision += 1;
        } catch (error) {
            this.notification.add(error.message || "Unable to load the claims dashboard.", {
                type: "danger",
            });
        } finally {
            this.state.loading = false;
        }
    }

    get kpis() {
        return this.state.data?.kpis || {};
    }

    get canReview() {
        const role = this.state.data?.role || {};
        return role.manager || role.admin;
    }

    get canPay() {
        const role = this.state.data?.role || {};
        return role.finance || role.admin;
    }

    formatMoney(value) {
        const currency = this.state.data?.currency || { symbol: "", position: "before" };
        const amount = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value || 0);
        return currency.position === "after" ? `${amount} ${currency.symbol}` : `${currency.symbol}${amount}`;
    }

    destroyCharts() {
        Object.values(this.charts).forEach((chart) => chart?.destroy());
        this.charts = {};
    }

    renderCharts() {
        this.destroyCharts();
        this.renderStatusChart();
        this.renderTrendChart();
        this.renderDepartmentChart();
    }

    renderStatusChart() {
        const canvas = this.statusChartRef.el;
        if (!canvas) return;
        const rows = this.state.data.status || [];
        this.charts.status = new Chart(canvas.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: rows.map((row) => row.label),
                datasets: [{
                    data: rows.map((row) => row.count),
                    backgroundColor: ["#94a3b8", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#2563eb", "#64748b"],
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } },
            },
        });
    }

    renderTrendChart() {
        const canvas = this.trendChartRef.el;
        if (!canvas) return;
        const rows = this.state.data.monthly || [];
        this.charts.trend = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: rows.map((row) => row.label),
                datasets: [
                    { label: "Submitted", data: rows.map((row) => row.submitted), borderColor: "#f59e0b", backgroundColor: "#f59e0b22", tension: 0.35, fill: true },
                    { label: "Approved", data: rows.map((row) => row.approved), borderColor: "#10b981", backgroundColor: "#10b98122", tension: 0.35, fill: true },
                    { label: "Paid", data: rows.map((row) => row.paid), borderColor: "#2563eb", backgroundColor: "#2563eb22", tension: 0.35, fill: true },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } },
                scales: { y: { beginAtZero: true } },
            },
        });
    }

    renderDepartmentChart() {
        const canvas = this.departmentChartRef.el;
        if (!canvas) return;
        const rows = this.state.data.departments || [];
        this.charts.department = new Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: rows.map((row) => row.name),
                datasets: [{ label: "Approved value", data: rows.map((row) => row.amount), backgroundColor: "#ed3d98", borderRadius: 6 }],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } },
            },
        });
    }

    openClaims(domain = []) {
        return this.action.doAction({
            type: "ir.actions.act_window",
            name: "Claims",
            res_model: "hr.claim",
            views: [[false, "list"], [false, "kanban"], [false, "form"]],
            domain,
        });
    }

    openClaim(claimId) {
        return this.action.doAction({
            type: "ir.actions.act_window",
            name: "Claim",
            res_model: "hr.claim",
            res_id: claimId,
            views: [[false, "form"]],
        });
    }

    newClaim() {
        return this.action.doAction({
            type: "ir.actions.act_window",
            name: "New Claim",
            res_model: "hr.claim",
            views: [[false, "form"]],
            target: "current",
        });
    }
}

registry.category("actions").add("hr_claims.dashboard", HrClaimDashboard);

