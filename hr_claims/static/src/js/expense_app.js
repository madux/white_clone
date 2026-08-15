/** @odoo-module **/

import {
    Component,
    onWillStart,
    onWillUnmount,
    useEffect,
    useRef,
    useState,
} from "@odoo/owl";
import { loadBundle } from "@web/core/assets";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class ExpenseKpiCard extends Component {
    static template = "hr_claims.ExpenseKpiCard";
    static props = {
        label: String,
        value: [String, Number],
        hint: { type: String, optional: true },
        icon: String,
        tone: { type: String, optional: true },
        onClick: { type: Function, optional: true },
    };

    click() {
        this.props.onClick?.();
    }
}

export class ExpenseApp extends Component {
    static template = "hr_claims.ExpenseApp";
    static components = { ExpenseKpiCard };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.statusChartRef = useRef("statusChart");
        this.trendChartRef = useRef("trendChart");
        this.departmentChartRef = useRef("departmentChart");
        this.charts = {};
        this.state = useState({
            loading: true,
            error: false,
            data: null,
            activeModule: "dashboard",
            activePage: "overview",
            sidebarCollapsed: false,
            moduleSearch: "",
            revision: 0,
        });

        onWillStart(async () => {
            await loadBundle("web.chartjs_lib");
            await this.refresh();
        });
        useEffect(
            () => {
                if (!this.state.loading && this.isDashboard) {
                    this.renderCharts();
                }
                return () => this.destroyCharts();
            },
            () => [
                this.state.loading,
                this.state.revision,
                this.state.activeModule,
                this.state.activePage,
            ]
        );
        onWillUnmount(() => this.destroyCharts());
    }

    async refresh() {
        this.state.loading = true;
        this.state.error = false;
        try {
            this.state.data = await this.orm.call("hr.claim", "get_app_bootstrap", []);
            this.state.revision += 1;
        } catch (error) {
            this.state.error = true;
            this.notification.add(error.message || "Unable to load Expense Management.", {
                type: "danger",
            });
        } finally {
            this.state.loading = false;
        }
    }

    get modules() {
        const query = this.state.moduleSearch.trim().toLowerCase();
        const modules = this.state.data?.modules || [];
        return query ? modules.filter((item) => item.label.toLowerCase().includes(query)) : modules;
    }

    get activeModule() {
        return (this.state.data?.modules || []).find(
            (item) => item.key === this.state.activeModule
        );
    }

    get activePage() {
        return this.activeModule?.pages.find((page) => page.key === this.state.activePage);
    }

    get dashboard() {
        return this.state.data?.dashboard || {};
    }

    get kpis() {
        return this.dashboard.kpis || {};
    }

    get isDashboard() {
        return this.state.activeModule === "dashboard" && this.state.activePage === "overview";
    }

    get isClaims() {
        return this.state.activeModule === "claims";
    }

    get isWorkflow() {
        return this.state.activeModule === "workflow";
    }

    get isPayments() {
        return this.state.activeModule === "payments";
    }

    get canCreateClaim() {
        const role = this.state.data?.role || {};
        return role.employee || role.admin;
    }

    formatMoney(value) {
        const currency = this.dashboard.currency || { symbol: "", position: "before" };
        const amount = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value || 0);
        return currency.position === "after" ? `${amount} ${currency.symbol}` : `${currency.symbol}${amount}`;
    }

    selectModule(key) {
        const module = (this.state.data?.modules || []).find((item) => item.key === key);
        if (!module) return;
        this.state.activeModule = key;
        this.state.activePage = module.pages[0]?.key || "overview";
    }

    selectPage(key) {
        this.state.activePage = key;
    }

    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    }

    updateModuleSearch(event) {
        this.state.moduleSearch = event.target.value;
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

    destroyCharts() {
        Object.values(this.charts).forEach((chart) => chart?.destroy());
        this.charts = {};
    }

    renderCharts() {
        this.destroyCharts();
        const statusCanvas = this.statusChartRef.el;
        const trendCanvas = this.trendChartRef.el;
        const departmentCanvas = this.departmentChartRef.el;
        if (!statusCanvas || !trendCanvas || !departmentCanvas) return;
        const status = this.dashboard.status || [];
        const monthly = this.dashboard.monthly || [];
        const departments = this.dashboard.departments || [];
        this.charts.status = new Chart(statusCanvas.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: status.map((row) => row.label),
                datasets: [{
                    data: status.map((row) => row.count),
                    backgroundColor: ["#ec4899", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#2563eb", "#64748b"],
                    borderWidth: 0,
                }],
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { position: "bottom" } } },
        });
        this.charts.trend = new Chart(trendCanvas.getContext("2d"), {
            type: "line",
            data: {
                labels: monthly.map((row) => row.label),
                datasets: [
                    { label: "Submitted", data: monthly.map((row) => row.submitted), borderColor: "#ec4899", backgroundColor: "#ec489922", fill: true, tension: 0.35 },
                    { label: "Approved", data: monthly.map((row) => row.approved), borderColor: "#10b981", tension: 0.35 },
                    { label: "Paid", data: monthly.map((row) => row.paid), borderColor: "#2563eb", tension: 0.35 },
                ],
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
        });
        this.charts.department = new Chart(departmentCanvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: departments.map((row) => row.name),
                datasets: [{ data: departments.map((row) => row.amount), backgroundColor: "#8b5cf6", borderRadius: 7 }],
            },
            options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
        });
    }
}

registry.category("actions").add("hr_claims.expense_app", ExpenseApp);
