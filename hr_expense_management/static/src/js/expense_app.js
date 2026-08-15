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
    static template = "hr_expense_management.ExpenseKpiCard";
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
    static template = "hr_expense_management.ExpenseApp";
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
            recordSearch: "",
            statusFilter: "all",
            viewMode: "table",
            pageLoading: false,
            pageData: { records: [], kpis: {} },
            modal: null,
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
            await this.loadActivePage();
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

    get isRequests() {
        return this.state.activeModule === "requests";
    }

    get isAdvances() {
        return this.state.activeModule === "advances";
    }

    get pageKpis() {
        return this.state.pageData?.kpis || {};
    }

    get pageRecords() {
        const query = this.state.recordSearch.trim().toLowerCase();
        const status = this.state.statusFilter;
        return (this.state.pageData?.records || []).filter((record) => {
            const matchesStatus = status === "all" || record.state === status;
            const haystack = [record.name, record.reference, record.employee, record.type,
                record.purpose, record.description, record.department, record.kind_label,
                record.fund, record.custodian, record.payee, record.category, record.location,
                record.code, record.vendor, record.account, record.source, record.cost_center,
                record.period, record.parent, record.subtype]
                .filter(Boolean).join(" ").toLowerCase();
            return matchesStatus && (!query || haystack.includes(query));
        });
    }

    get isPayments() {
        return this.state.activeModule === "payments";
    }

    get isPettyCash() {
        return this.state.activeModule === "petty_cash";
    }

    get isAccounts() {
        return this.state.activeModule === "accounts";
    }

    get isVendors() {
        return this.state.activeModule === "vendors";
    }

    get isBudget() {
        return this.state.activeModule === "budget";
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

    async selectModule(key) {
        const module = (this.state.data?.modules || []).find((item) => item.key === key);
        if (!module) return;
        this.state.activeModule = key;
        this.state.activePage = module.pages[0]?.key || "overview";
        this.state.recordSearch = "";
        this.state.statusFilter = "all";
        await this.loadActivePage();
    }

    async selectPage(key) {
        this.state.activePage = key;
        this.state.recordSearch = "";
        this.state.statusFilter = "all";
        await this.loadActivePage();
    }

    async loadActivePage() {
        const supported = ["requests", "advances", "workflow", "payments", "petty_cash",
            "accounts", "vendors", "budget"];
        if (!supported.includes(this.state.activeModule)) {
            this.state.pageData = { records: [], kpis: {} };
            return;
        }
        this.state.pageLoading = true;
        try {
            this.state.pageData = await this.orm.call("hr.claim", "get_app_page", [
                this.state.activeModule, this.state.activePage,
            ]);
        } catch (error) {
            this.notification.add(error.message || "Unable to load this page.", { type: "danger" });
            this.state.pageData = { records: [], kpis: {} };
        } finally {
            this.state.pageLoading = false;
        }
    }

    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    }

    updateModuleSearch(event) {
        this.state.moduleSearch = event.target.value;
    }

    updateRecordSearch(event) {
        this.state.recordSearch = event.target.value;
    }

    updateStatusFilter(event) {
        this.state.statusFilter = event.target.value;
    }

    setViewMode(mode) {
        this.state.viewMode = mode;
    }

    formatDate(value) {
        return value ? new Date(value).toLocaleDateString() : "—";
    }

    statusClass(state) {
        if (["approved", "fulfilled", "retired", "paid", "posted", "active", "under"].includes(state)) return "text-bg-success";
        if (["submitted", "outstanding", "partial", "pending", "track", "risk", "draft"].includes(state)) return "text-bg-warning";
        if (["rejected", "cancelled", "written_off", "over"].includes(state)) return "text-bg-danger";
        return "text-bg-light";
    }

    openRequestModal() {
        const firstType = this.state.pageData?.request_types?.[0];
        this.state.modal = {
            type: "request",
            values: {
                request_type_id: firstType?.id || "",
                purpose: "", description: "", amount: "", needed_date: "",
            },
        };
    }

    openDecisionModal(kind, record, action) {
        this.state.modal = { type: "decision", kind, record, action, comment: "" };
    }

    openRetirementModal(record) {
        this.state.modal = {
            type: "retire", record,
            values: { amount: record.outstanding, reference: "" },
        };
    }

    openVendorModal() {
        const options = this.state.pageData?.vendor_options || {};
        this.state.modal = {
            type: "vendor",
            values: {
                name: "", code: "", email: "", phone: "", rating: "3",
                category_id: options.categories?.[0]?.id || "",
                term_id: options.terms?.[0]?.id || "",
                account_id: options.accounts?.[0]?.id || "",
            },
        };
    }

    closeModal() {
        this.state.modal = null;
    }

    updateModalValue(event) {
        const field = event.target.dataset.field;
        if (this.state.modal?.values) this.state.modal.values[field] = event.target.value;
        else if (field === "comment" && this.state.modal) this.state.modal.comment = event.target.value;
    }

    async createRequest(submit = true) {
        const values = { ...this.state.modal.values, submit };
        try {
            await this.orm.call("hr.claim", "app_create_request", [values]);
            this.notification.add(submit ? "Request submitted for approval." : "Request saved as draft.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to save the request.", { type: "danger" });
        }
    }

    async createVendor() {
        try {
            const vendor = await this.orm.call("hr.claim", "app_create_vendor", [
                { ...this.state.modal.values },
            ]);
            this.notification.add(`Vendor ${vendor.name} created.`, { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to create the vendor.", { type: "danger" });
        }
    }

    async requestAction(record, action) {
        try {
            await this.orm.call("hr.claim", "app_request_action", [record.id, action, ""]);
            this.notification.add("Request updated.", { type: "success" });
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to update the request.", { type: "danger" });
        }
    }

    async submitDecision() {
        const modal = this.state.modal;
        try {
            await this.orm.call("hr.claim", "app_workflow_decision", [
                modal.kind, modal.record.id, modal.action, modal.comment,
            ]);
            this.notification.add(`${modal.kind === "claim" ? "Claim" : "Request"} ${modal.action}d.`, { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to record the decision.", { type: "danger" });
        }
    }

    async retireAdvance() {
        const modal = this.state.modal;
        try {
            await this.orm.call("hr.claim", "app_retire_advance", [
                modal.record.id, Number(modal.values.amount), modal.values.reference,
            ]);
            this.notification.add("Advance retirement posted.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to retire the advance.", { type: "danger" });
        }
    }

    openRequest(requestId) {
        return this.action.doAction({
            type: "ir.actions.act_window", name: "Request", res_model: "hr.expense.request",
            res_id: requestId, views: [[false, "form"]],
        });
    }

    openAdvance(advanceId) {
        return this.action.doAction({
            type: "ir.actions.act_window", name: "Cash Advance", res_model: "hr.cash.advance",
            res_id: advanceId, views: [[false, "form"]],
        });
    }

    openApprovalRules() {
        return this.action.doAction("hr_expense_management.action_hr_expense_approval_rules");
    }

    async processAllPayables() {
        const method = this.state.pageData.methods?.[0];
        const claimIds = this.pageRecords.map((record) => record.id);
        if (!method || !claimIds.length) {
            this.notification.add("There are no payable claims or active payment methods.", { type: "warning" });
            return;
        }
        try {
            const batch = await this.orm.call("hr.claim", "app_process_payment_batch", [claimIds, method.id]);
            this.notification.add(`Batch ${batch.name} finished with status ${batch.state}.`, { type: batch.state === "completed" ? "success" : "warning" });
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to process the payment batch.", { type: "danger" });
        }
    }

    openPettyCashAction(xmlId) {
        return this.action.doAction(xmlId);
    }

    openFinancialAction(xmlId) {
        return this.action.doAction(xmlId);
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

registry.category("actions").add("hr_expense_management.expense_app", ExpenseApp);
