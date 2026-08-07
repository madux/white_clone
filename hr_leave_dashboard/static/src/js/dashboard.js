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
        this.charts = {};
        this.isDestroyed = false;
        this.currentRequest = null;
        this.canvasRef = useRef("trendsChart");
        this.byTypeChart = useRef("byTypeChart");
        this.approvalChart = useRef("approvalChart");

        this.state = useState({
            months: 6,
            kpis: {},
            trends: { labels: [], total: [], approved: [], pending: [], rejected: [], summary: {} },
            byType: [],
            balance: [],
            approval: { approved: 0, pending: 0, rejected: 0, approval_rate: 0 },
            loading: true,
            // ── Welcome Modal ──────────────────────────
            showWelcomeModal: false,
            // ── Setup Wizard ───────────────────────────
            showWizard: false,
            wizardStep: 1,       // 1–5, which step is currently displayed
            setupState: "not_started",
            setupStep: 0,        // highest step reached (from DB)
            reviewMode: false,   // read-only review of completed setup
            // ── Completion Screen & Checklist (Screen 7)
            showCompletionScreen: false,
            checklist: {
                check_leave_type: false,
                check_allocate_balance: false,
                check_set_country: false,
                check_review_request: false,
                check_run_report: false,
            },
            completedChecklistCount: 0,
        });

        this.onKeyDown = (ev) => {
            if (ev.key === "Escape") {
                if (this.state.showCompletionScreen) {
                    this.closeCompletionScreen();
                } else if (this.state.showWizard) {
                    this.closeWizard();
                } else if (this.state.showWelcomeModal) {
                    this.closeWelcomeModal();
                }
            }
        };

        onWillStart(async () => {
            const force = new URLSearchParams(window.location.search).get("leave_setup") === "1";
            const [, setup] = await Promise.all([
                loadBundle("web.chartjs_lib"),
                this.orm.call("hr.leave.setup.progress", "get_welcome_state", [], { force }),
            ]);
            this.state.setupState = setup.state;
            this.state.setupStep = setup.current_step;
            if (setup.checklist) {
                this.state.checklist = setup.checklist;
                this.state.completedChecklistCount = setup.completed_count || 0;
            }

            if (force) {
                this.openSetupExperience();
            } else if (setup.state === "in_progress") {
                // Resume wizard at the last saved step
                this.state.wizardStep = setup.current_step || 1;
                this.state.showWizard = true;
            } else {
                // Show welcome modal only if setup has not been dismissed/completed
                this.state.showWelcomeModal = setup.show_welcome;
            }
        });

        useEffect(() => {
            window.addEventListener("keydown", this.onKeyDown);
            return () => {
                window.removeEventListener("keydown", this.onKeyDown);
            };
        }, () => []);

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

    // ═══════════════════════════════════════════════════════════════
    //  CENTRAL RE-OPENING METHOD (FR-054 Fix)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Central state-aware method for reopening setup from header icons,
     * Help menu, Get Started menu, or dev URL parameter.
     */
    openSetupExperience() {
        this.state.showWelcomeModal = false;
        this.state.showWizard = false;
        this.state.showCompletionScreen = false;

        if (this.state.setupState === "completed") {
            this.state.showCompletionScreen = true;
        } else if (this.state.setupState === "in_progress") {
            this.state.wizardStep = this.state.setupStep || 1;
            this.state.showWizard = true;
        } else {
            this.state.showWelcomeModal = true;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WELCOME MODAL METHODS
    // ═══════════════════════════════════════════════════════════════

    /** Re-open welcome modal explicitly if needed. */
    openWelcomeModal() {
        this.state.showWizard = false;
        this.state.showCompletionScreen = false;
        this.state.showWelcomeModal = true;
    }

    /** FR-006: Dismiss modal via X button — marks user as dismissed. */
    async closeWelcomeModal() {
        this.state.showWelcomeModal = false;
        await this.orm.call("hr.leave.setup.progress", "dismiss_welcome", []);
    }

    /** FR-005: "Explore on my own" — dismiss modal, show dashboard. */
    async exploreOnMyOwn() {
        await this.closeWelcomeModal();
    }

    /**
     * FR-004: "Start Setup Guide (5 steps)".
     * Persists state=in_progress, step=1 to DB, then opens the wizard.
     */
    async startSetupGuide() {
        const setup = await this.orm.call("hr.leave.setup.progress", "start_setup", []);
        this.state.setupState = setup.state;
        this.state.setupStep = setup.current_step;
        this.state.wizardStep = setup.current_step;
        this.state.reviewMode = false;
        this.state.showWelcomeModal = false;
        this.state.showCompletionScreen = false;
        this.state.showWizard = true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SETUP WIZARD METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * FR-015: "← Back" in the wizard.
     * From Step 1 → closes wizard and re-shows Welcome or Completion screen depending on reviewMode.
     * From Step 2+ → goes to the previous step.
     */
    goBackFromWizard() {
        if (this.state.wizardStep <= 1) {
            this.state.showWizard = false;
            if (this.state.reviewMode) {
                this.state.reviewMode = false;
                this.state.showCompletionScreen = true;
            } else {
                this.state.showWelcomeModal = true;
            }
        } else {
            this.state.wizardStep -= 1;
        }
    }

    /**
     * FR-016 / FR-043: "Next →" or "Finish →" in the wizard.
     * If in reviewMode: advances UI steps without corrupting DB state.
     * Otherwise: persists progress to DB. Upon completing Step 5, displays Completion Screen.
     */
    async nextWizardStep() {
        const nextStep = this.state.wizardStep + 1;

        if (this.state.reviewMode) {
            if (nextStep > 5) {
                this.state.showWizard = false;
                this.state.reviewMode = false;
                this.state.showCompletionScreen = true;
            } else {
                this.state.wizardStep = nextStep;
            }
            return;
        }

        if (nextStep > 5) {
            // Complete setup and show Screen 7 (Completion Screen)
            const result = await this.orm.call("hr.leave.setup.progress", "complete_setup", []);
            this.state.setupState = result.state;
            this.state.showWizard = false;
            this.state.showCompletionScreen = true;
            return;
        }
        const saved = await this.orm.call(
            "hr.leave.setup.progress", "advance_step", [], { step: nextStep }
        );
        this.state.setupStep = saved.current_step;
        this.state.wizardStep = nextStep;
    }

    /**
     * FR-017: "Skip and explore on my own" text link.
     */
    async skipWizard() {
        this.state.showWizard = false;
        if (!this.state.reviewMode) {
            await this.orm.call("hr.leave.setup.progress", "skip_wizard", []);
        }
        this.state.reviewMode = false;
    }

    /**
     * Closes the wizard via backdrop click or ESC key.
     */
    closeWizard() {
        this.state.showWizard = false;
        this.state.reviewMode = false;
    }

    /**
     * FR-014: "→ Go to Leave Types" inside the wizard.
     */
    goToLeaveTypesFromWizard() {
        return this.openLeaveTypes();
    }

    // ═══════════════════════════════════════════════════════════════
    //  SETUP COMPLETION SCREEN & CHECKLIST METHODS (Screen 7 — FR-045 to FR-054)
    // ═══════════════════════════════════════════════════════════════

    /**
     * FR-050: Explicitly set checklist item completion state and persist.
     */
    async toggleChecklistItem(itemKey) {
        const targetVal = !this.state.checklist[itemKey];
        const res = await this.orm.call(
            "hr.leave.setup.progress", "set_checklist_item", [],
            { item_key: itemKey, completed: targetVal }
        );
        if (res && res.checklist) {
            this.state.checklist = res.checklist;
            this.state.completedChecklistCount = res.completed_count || 0;
        }
    }

    /** Handle keypress (Enter/Space) on accessible checklist item div. */
    onChecklistKeydown(ev, itemKey) {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.toggleChecklistItem(itemKey);
        }
    }

    /**
     * FR-052: "← Review steps" button returns to Step 1 of wizard in read-only reviewMode.
     * Prevents modifying DB completion status.
     */
    reviewWizardSteps() {
        this.state.showCompletionScreen = false;
        this.state.reviewMode = true;
        this.state.wizardStep = 1;
        this.state.showWizard = true;
    }

    /** FR-051: "Done — Go to Dashboard" CTA button. */
    doneGoToDashboard() {
        this.state.showCompletionScreen = false;
    }

    /** FR-053: Close (X) button on completion screen. */
    closeCompletionScreen() {
        this.state.showCompletionScreen = false;
    }

    // ═══════════════════════════════════════════════════════════════
    //  NAVIGATION ACTIONS (used by wizard tiles + sidebar + checklist)
    // ═══════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════
    //  DASHBOARD DATA
    // ═══════════════════════════════════════════════════════════════

    fetchAndRender(months) {
        if (this.currentRequest) this.currentRequest.abort();

        this.currentRequest = $.ajax({
            url: "/hr_leave_dashboard/data",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ jsonrpc: "2.0", params: { months } }),
            dataType: "json",
        }).done((res) => {
            if (this.isDestroyed || !$(this.el)) return;

            const data = res.result;
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
                    { label: "Total",    data: d.total,    borderColor: "#e91e8c", tension: 0.4, fill: true, backgroundColor: "rgba(233,30,140,0.08)" },
                    { label: "Approved", data: d.approved, borderColor: "#17a673", tension: 0.4 },
                    { label: "Pending",  data: d.pending,  borderColor: "#f0ad4e", tension: 0.4 },
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
