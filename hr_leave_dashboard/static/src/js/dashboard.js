/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillUnmount, useState, useRef, onWillStart, useEffect } from "@odoo/owl";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";

export class HrLeaveDashboard extends Component {
    static template = "hr_leave_dashboard.Dashboard";

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.charts = {};
        this.isDestroyed = false;
        this.currentRequest = null;
        this.charts_trends = null;
        this.canvasRef = useRef("trendsChart");
        this.byTypeChart = useRef("byTypeChart");
        this.approvalChart = useRef("approvalChart");

        this.state = useState({
            months: 6,
            kpis: {},
            trends: {labels: [], total: [], approved: [], pending: [], rejected: [], summary: {} },
            byType: [],
            balance: [],
            approval: { approved: 0, pending: 0, rejected: 0, approval_rate: 0 },
            loading: true,
            // Welcome Modal state
            showWelcomeModal: false,
            setupState: "not_started",
            setupStep: 0,
        });

        onWillStart(async () => {
            const force = new URLSearchParams(window.location.search).get("leave_setup") === "1";
            const [, setup] = await Promise.all([
                loadBundle("web.chartjs_lib"),
                this.orm.call("hr.leave.setup.progress", "get_welcome_state", [], { force }),
            ]);
            this.state.showWelcomeModal = setup.show_welcome;
            this.state.setupState = setup.state;
            this.state.setupStep = setup.current_step;
        });

        onWillUnmount(() => {
            this.isDestroyed = true;
            if (this.currentRequest) this.currentRequest.abort();
            Object.values(this.charts).forEach((chart) => chart?.destroy());
        });

        useEffect(
            () => {
                this.fetchAndRender(this.state.months);
                return () => {
                    if (this.charts.trends) this.charts.trends.destroy();
                    if (this.charts.byType) this.charts.byType.destroy();
                    if (this.charts.approval) this.charts.approval.destroy();
                };
            },
            () => [this.state.months]
        );
    }

    // ── Welcome Modal Methods ──────────────────────────────────────

    /**
     * FR-008: Re-open the welcome modal from the Help (?) or Setup Wizard (✦) icon.
     */
    openWelcomeModal() {
        this.state.showWelcomeModal = true;
    }

    /**
     * FR-006: Dismiss modal via X button — marks as shown, does NOT launch wizard.
     */
    async closeWelcomeModal() {
        this.state.showWelcomeModal = false;
        await this.orm.call("hr.leave.setup.progress", "dismiss_welcome", []);
    }

    /**
     * FR-005: "Explore on my own" — dismisses modal, takes user to dashboard.
     */
    async exploreOnMyOwn() {
        await this.closeWelcomeModal();
    }

    /**
     * FR-004: "Start Setup Guide (5 steps)" — dismisses modal and launches wizard.
     */
    async startSetupGuide() {
        const setup = await this.orm.call("hr.leave.setup.progress", "start_setup", []);
        this.state.setupState = setup.state;
        this.state.setupStep = setup.current_step;
        this.state.showWelcomeModal = false;
        this.notification.add(
            "Setup started and saved. Step 1 of the guided wizard is the next screen to implement.",
            { title: "Leave setup", type: "info" }
        );
    }

    openDashboard() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openLeaveTypes() {
        return this.action.doAction("hr_holidays.open_view_holiday_status");
    }

    openLeaveRequests() {
        return this.action.doAction("hr_holidays.hr_leave_action_action_approve_department");
    }

    openLeaveCalendar() {
        return this.action.doAction({
            type: "ir.actions.act_window", name: "Leave Calendar", res_model: "hr.leave",
            views: [[false, "calendar"], [false, "list"], [false, "form"]],
        });
    }

    openLeaveBalances() {
        return this.action.doAction("hr_holidays.hr_leave_allocation_action_all");
    }

    openReports() {
        return this.action.doAction("hr_holidays.action_hr_available_holidays_report");
    }

    openSettings() {
        return this.action.doAction("base_setup.action_general_configuration");
    }

    // ── Dashboard Data Methods ─────────────────────────────────────

    fetchAndRender(months) {
        if (this.currentRequest) {
            this.currentRequest.abort();
        }

        this.currentRequest = $.ajax({
            url: "/hr_leave_dashboard/data",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ jsonrpc: "2.0", params: { months } }),
            dataType: "json",
        }).done((res) => {
            if (this.isDestroyed || !$(this.el)) {
                return;
            }

            const data = res.result;

            console.log(`logger22-3 ${JSON.stringify(data)}`);
            this.state.kpis = data.kpis;
            this.state.trends = data.trends;
            this.state.byType = data.by_type;
            this.state.balance = data.balance;
            this.state.approval = data.approval_overview;

            this.renderKpis(data.kpis);
            this.renderTrends(data.trends);
            this.renderByType(data.by_type);
            this.renderApproval(data.approval_overview);
        }).fail((err) => {
            if (err.statusText === "abort") return;
            console.error("Dashboard load failed", err);
        });
    }

    renderTrends(d) {
        const canvas = this.canvasRef.el;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (this.charts.trends) this.charts.trends.destroy();
        this.charts.trends = new Chart(ctx, {
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

        $(this.el).find("[data-summary='total']").text(d.summary.total);
        $(this.el).find("[data-summary='approved']").text(d.summary.approved);
        $(this.el).find("[data-summary='pending']").text(d.summary.pending);
        $(this.el).find("[data-summary='rejected']").text(d.summary.rejected);
    }

    renderKpis(k) {
        const $root = $(this.el);
        $root.find("[data-kpi='total_employees']").text(k.total_employees);
        $root.find("[data-kpi='pending_approvals']").text(k.pending_approvals);
        $root.find("[data-kpi='on_leave_today']").text(k.on_leave_today);
        $root.find("[data-kpi='upcoming']").text(k.upcoming_7_days);
        $root.find("[data-kpi='utilisation']").text(k.utilisation_rate + "%");
        $root.find("[data-kpi='coverage']").text(k.coverage_alerts);
    }

    renderByType(items) {
        const ctx = this.byTypeChart.el.getContext("2d");
        if (this.charts.byType) this.charts.byType.destroy();
        const palette = ["#4e73df", "#e74a3b", "#e91e8c", "#f6a623", "#1cc88a", "#36b9cc", "#6f42c1", "#858796"];
        this.charts.byType = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: items.map((i) => i.name),
                datasets: [{ data: items.map((i) => i.count), backgroundColor: palette }],
            },
            options: { plugins: { legend: { display: false } }, cutout: "70%" },
        });

    }

    getPaletteColor(index) {
        const palette = ["#4e73df", "#e74a3b", "#e91e8c", "#f6a623", "#1cc88a", "#36b9cc", "#6f42c1", "#858796"];
        return palette[index % palette.length];
    }

    renderApproval(a) {
        const canvas = this.approvalChart.el;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (this.charts.approval) this.charts.approval.destroy();
        this.charts.approval = new Chart(ctx, {
            type: "doughnut",
            data: {
                datasets: [{
                    data: [a.approved, a.pending, a.rejected],
                    backgroundColor: ["#1cc88a", "#f6c343", "#e74a3b"],
                }],
            },
            options: { cutout: "75%", plugins: { legend: { display: false } } },
        });
        $(this.el).find("[data-approval='rate']").text(a.approval_rate + "%");
        $(this.el).find("[data-approval='approved']").text(a.approved);
        $(this.el).find("[data-approval='pending']").text(a.pending);
        $(this.el).find("[data-approval='rejected']").text(a.rejected);
    }
}

registry.category("actions").add("hr_leave_dashboard", HrLeaveDashboard);
