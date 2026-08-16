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
import {
    detailFields,
    featureKpis,
    moduleDescription,
    moduleView,
    statusClass,
} from "./expense_app_registry";

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
        this.pageChartRef = useRef("pageChart");
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
            drawer: null,
            page: 1,
            pageSize: 25,
            sortAscending: true,
            favoriteModules: this._readStorage("expense.favoriteModules", []),
            moduleOrder: this._readStorage("expense.moduleOrder", []),
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
                } else if (!this.state.loading && this.hasFeatureChart) {
                    this.renderFeatureChart();
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
            this.state.data = await this.orm.call("hr.expense.app", "get_app_bootstrap", []);
            this._restoreNavigation();
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
        const configuredOrder = this.state.moduleOrder;
        const modules = [...(this.state.data?.modules || [])].sort((left, right) => {
            const leftFavorite = this.state.favoriteModules.includes(left.key) ? 0 : 1;
            const rightFavorite = this.state.favoriteModules.includes(right.key) ? 0 : 1;
            if (leftFavorite !== rightFavorite) return leftFavorite - rightFavorite;
            const leftIndex = configuredOrder.indexOf(left.key);
            const rightIndex = configuredOrder.indexOf(right.key);
            return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
        });
        return query ? modules.filter((item) => item.label.toLowerCase().includes(query)) : modules;
    }

    _readStorage(key, fallback) {
        try {
            return JSON.parse(window.localStorage.getItem(key)) || fallback;
        } catch (_error) {
            return fallback;
        }
    }

    _restoreNavigation() {
        const stored = this._readStorage("expense.navigation", {});
        const module = (this.state.data?.modules || []).find((item) => item.key === stored.module);
        const page = module?.pages.find((item) => item.key === stored.page);
        if (module && page) {
            this.state.activeModule = module.key;
            this.state.activePage = page.key;
        }
        const validKeys = (this.state.data?.modules || []).map((item) => item.key);
        this.state.moduleOrder = [...this.state.moduleOrder.filter((key) => validKeys.includes(key)), ...validKeys.filter((key) => !this.state.moduleOrder.includes(key))];
    }

    _saveNavigation() {
        window.localStorage.setItem("expense.navigation", JSON.stringify({ module: this.state.activeModule, page: this.state.activePage }));
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

    get moduleView() {
        return moduleView(this.state.activeModule, this.state.activePage);
    }

    get pageKpis() {
        return this.state.pageData?.kpis || {};
    }

    get pageRecords() {
        const start = (this.state.page - 1) * this.state.pageSize;
        return this.filteredRecords.slice(start, start + this.state.pageSize);
    }

    get filteredRecords() {
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
        }).sort((left, right) => {
            const leftValue = String(left.name || left.reference || left.employee || left.date || "");
            const rightValue = String(right.name || right.reference || right.employee || right.date || "");
            return leftValue.localeCompare(rightValue, undefined, { numeric: true }) * (this.state.sortAscending ? 1 : -1);
        });
    }

    get pageCount() { return Math.max(1, Math.ceil(this.filteredRecords.length / this.state.pageSize)); }

    get hasFeatureChart() {
        return Boolean(this.pageChartRef.el && this.featureChartRows.length);
    }

    get featureChartRows() {
        const charts = this.state.pageData?.charts || {};
        return charts.series || charts.monthly || charts.departments || [];
    }

    get themeStyle() {
        const theme = this.state.data?.theme || {};
        return `--expense-pink:${theme.primary_color || "#ec4899"};--expense-violet:${theme.secondary_color || "#8b5cf6"};--expense-sidebar:${theme.sidebar_color || "#1f1835"};--expense-bg:${theme.surface_color || "#f6f7fb"};`;
    }

    get currentTheme() {
        return this.state.pageData?.theme || this.state.data?.theme || {
            primary_color: "#ec4899",
            secondary_color: "#8b5cf6",
            sidebar_color: "#1f1835",
            surface_color: "#f6f7fb",
            font_family: "system",
            density: "comfortable",
            corner_style: "rounded",
        };
    }

    get themeClass() {
        const theme = this.state.data?.theme || {};
        return `o_expense_font_${theme.font_family || "system"} o_expense_density_${theme.density || "comfortable"} o_expense_corners_${theme.corner_style || "rounded"}`;
    }

    get drawerTitle() {
        const record = this.state.drawer || {};
        return record.name || record.reference || record.action || "Record details";
    }

    get claimTotal() {
        return (this.state.modal?.values?.lines || []).reduce((total, line) => total + Number(line.amount || 0), 0);
    }

    get moduleDescription() {
        return moduleDescription(this.state.activeModule);
    }

    get featureKpis() {
        return featureKpis(
            this.state.activeModule,
            this.pageKpis,
            this.kpis,
            (value) => this.formatMoney(value)
        );
    }

    recordDetails(record) {
        return detailFields(this.state.activeModule)
            .filter((key) => record[key] !== "" && record[key] !== false && record[key] !== null && record[key] !== undefined)
            .slice(0, 5)
            .map((key) => ({
                key,
                label: key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()),
                value: this.formatFeatureValue(key, record[key]),
            }));
    }

    formatFeatureValue(key, value) {
        if (["amount", "balance", "maximum", "threshold", "variance", "issued", "retired",
            "outstanding", "exposure", "submitted", "approved", "committed", "actual",
            "available", "paid", "spend", "debit", "credit"].includes(key)) return this.formatMoney(value);
        if (key === "utilization") return `${Number(value || 0).toFixed(1)}%`;
        if (key.includes("date") || key.includes("run")) return this.formatDate(value);
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return value;
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
        this.state.page = 1;
        await this.loadActivePage();
        this._saveNavigation();
    }

    async selectPage(key) {
        this.state.activePage = key;
        this.state.recordSearch = "";
        this.state.statusFilter = "all";
        this.state.page = 1;
        await this.loadActivePage();
        this._saveNavigation();
    }

    async loadActivePage() {
        const supported = this.state.data?.contract?.modules || [];
        if (!supported.includes(this.state.activeModule)) {
            this.state.pageData = { records: [], kpis: {} };
            return;
        }
        this.state.pageLoading = true;
        try {
            const payload = await this.orm.call("hr.expense.app", "get_app_page", [
                this.state.activeModule, this.state.activePage,
            ]);
            this._validatePagePayload(payload);
            this.state.pageData = payload;
        } catch (error) {
            this.notification.add(error.message || "Unable to load this page.", { type: "danger" });
            this.state.pageData = { records: [], kpis: {} };
        } finally {
            this.state.pageLoading = false;
        }
    }

    _validatePagePayload(payload) {
        const version = this.state.data?.contract?.version;
        if (payload?.contract_version !== version || payload?.module !== this.state.activeModule ||
            payload?.page !== this.state.activePage || !Array.isArray(payload?.records) ||
            typeof payload?.kpis !== "object" || typeof payload?.charts !== "object") {
            throw new Error("Expense page contract mismatch. Refresh the module assets and try again.");
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
        this.state.page = 1;
    }

    updateStatusFilter(event) {
        this.state.statusFilter = event.target.value;
        this.state.page = 1;
    }

    setViewMode(mode) {
        this.state.viewMode = mode;
    }

    changePage(delta) {
        this.state.page = Math.max(1, Math.min(this.pageCount, this.state.page + delta));
    }

    toggleSort() {
        this.state.sortAscending = !this.state.sortAscending;
        this.state.page = 1;
    }

    exportPage() {
        const records = this.filteredRecords;
        if (!records.length) {
            this.notification.add("There are no filtered records to export.", { type: "warning" });
            return;
        }
        const hidden = new Set(["permissions", "can_submit", "can_decide", "can_issue", "can_retire", "can_writeoff", "can_approve", "can_appeal"]);
        const columns = [...new Set(records.flatMap((record) => Object.keys(record)))].filter((key) => !hidden.has(key));
        const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const rows = [columns.map((key) => escape(key.replaceAll("_", " "))).join(","), ...records.map((record) => columns.map((key) => escape(record[key])).join(","))];
        const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${this.state.activeModule}-${this.state.activePage}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    toggleFavorite(key) {
        const favorites = this.state.favoriteModules;
        const index = favorites.indexOf(key);
        if (index >= 0) favorites.splice(index, 1);
        else favorites.push(key);
        window.localStorage.setItem("expense.favoriteModules", JSON.stringify(favorites));
    }

    moveModule(key, delta) {
        const order = this.state.moduleOrder;
        const index = order.indexOf(key);
        const nextIndex = Math.max(0, Math.min(order.length - 1, index + delta));
        if (index < 0 || index === nextIndex) return;
        const [item] = order.splice(index, 1);
        order.splice(nextIndex, 0, item);
        window.localStorage.setItem("expense.moduleOrder", JSON.stringify(order));
    }

    openDrawer(record) { this.state.drawer = record; }
    closeDrawer() { this.state.drawer = null; }

    openDrawerAdvanced() {
        const record = this.state.drawer;
        if (!record || typeof record.id !== "number") return;
        if (this.moduleView === "claims" && this.state.activePage === "data") return this.openClaim(record.id);
        if (this.moduleView === "requests") return this.openRequest(record.id);
        if (this.moduleView === "advances" && this.state.activePage !== "writeoffs") return this.openAdvance(record.id);
    }

    async runQuickAction(record) {
        if (record.action === "new_claim") {
            await this.selectModule("claims");
            return this.openClaimModal();
        }
        if (record.action === "new_request") {
            await this.selectModule("requests");
            return this.openRequestModal();
        }
        if (record.action === "claims") return this.selectModule("claims");
        if (record.action === "claim") return this.openClaim(record.id);
        this.openDrawer(record);
    }

    async openTasks() {
        await this.selectModule("dashboard");
        await this.selectPage("tasks");
    }

    formatDate(value) {
        return value ? new Date(value).toLocaleDateString() : "—";
    }

    statusClass(state) {
        return statusClass(state);
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

    openClaimModal() {
        const firstType = this.state.pageData?.claim_options?.types?.[0];
        this.state.modal = { type: "claim", step: 1, values: { claim_type_id: firstType?.id || "", title: "", description: "", money_type: "personal", expense_date: "", lines: [{ id: 1, category: "other", description: "", amount: "", receipt_reference: "" }] } };
    }

    claimStep(delta) {
        this.state.modal.step = Math.max(1, Math.min(3, this.state.modal.step + delta));
    }

    addClaimLine() {
        const lines = this.state.modal.values.lines;
        lines.push({ id: Math.max(0, ...lines.map((line) => line.id)) + 1, category: "other", description: "", amount: "", receipt_reference: "" });
    }

    removeClaimLine(lineId) {
        const lines = this.state.modal.values.lines;
        if (lines.length === 1) return;
        lines.splice(lines.findIndex((line) => line.id === lineId), 1);
    }

    updateClaimLine(event) {
        const line = this.state.modal.values.lines.find((item) => item.id === Number(event.target.dataset.lineId));
        if (line) line[event.target.dataset.field] = event.target.value;
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

    openWriteoffModal(record = null) {
        const option = record || this.state.pageData?.advance_options?.[0];
        this.state.modal = { type: "writeoff", record: option, values: { advance_id: option?.id || "", amount: option?.outstanding || "", reason: "" } };
    }

    openWriteoffDecision(record, decision) {
        this.state.modal = { type: "writeoff_decision", record, decision, values: { note: "" } };
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

    openPolicyModal() {
        this.state.modal = { type: "policy", values: { name: "", code: "", policy_type: "general", effective_date: "", description: "" } };
    }

    openReportModal() {
        this.state.modal = { type: "report", values: { name: "", report_type: "custom", date_basis: "current_month", description: "" } };
    }

    openScheduleModal() {
        const first = this.state.pageData?.report_options?.[0];
        const recipient = this.state.pageData?.recipient_options?.[0];
        this.state.modal = { type: "schedule", values: { name: "", report_id: first?.id || "", recipient_id: recipient?.id || "", frequency: "monthly", format: "pdf", next_run: "" } };
    }

    openCompanyModal() {
        const company = this.state.pageData?.company || this.state.data?.company || {};
        this.state.modal = { type: "company", values: { name: company.name || "", email: company.email || "", phone: company.phone || "" } };
    }

    openSettingsModal() {
        const settings = this.state.pageData?.settings || {};
        this.state.modal = { type: "settings", values: { ...settings } };
    }

    openThemeModal() {
        const theme = this.state.pageData?.theme || this.state.data?.theme || {};
        this.state.modal = { type: "theme", values: { ...theme } };
    }

    closeModal() {
        this.state.modal = null;
    }

    updateModalValue(event) {
        const field = event.target.dataset.field;
        if (this.state.modal?.values) this.state.modal.values[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        else if (field === "comment" && this.state.modal) this.state.modal.comment = event.target.value;
    }

    updateReceipt(event) {
        const file = event.target.files?.[0];
        if (!file || !this.state.modal?.values) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.state.modal.values.receipt_name = file.name;
            this.state.modal.values.receipt_mimetype = file.type || "application/octet-stream";
            this.state.modal.values.receipt_data = String(reader.result).split(",")[1] || "";
        };
        reader.readAsDataURL(file);
    }

    _contractModalValues(scope, kind, overrides = {}) {
        const contract = this.state.data?.contract?.actions?.[scope]?.[kind];
        if (!contract) {
            throw new Error(`Missing ${scope}/${kind} action contract.`);
        }
        const allowedOverrides = Object.fromEntries(
            Object.entries(overrides).filter(([field]) => contract.fields.includes(field))
        );
        return { ...contract.defaults, ...allowedOverrides };
    }

    openPettyModal(kind) {
        const options = this.state.pageData?.petty_options || {};
        this.state.modal = { type: "petty", kind, values: this._contractModalValues("petty", kind, {
            fund_id: options.funds?.[0]?.id || "", custodian_id: options.employees?.[0]?.id || "",
        }) };
    }

    openAccountingModal(kind) {
        const options = this.state.pageData?.account_options || {};
        this.state.modal = { type: "accounting", kind, values: this._contractModalValues("accounting", kind, {
            debit_account_id: options.accounts?.[0]?.id || "",
            credit_account_id: options.accounts?.[1]?.id || "", journal_id: options.journals?.[0]?.id || "",
        }) };
    }

    openBudgetModal(kind) {
        const options = this.state.pageData?.budget_options || {};
        this.state.modal = { type: "budget", kind, values: this._contractModalValues("budget", kind, {
            period_id: options.periods?.[0]?.id || "", department_id: options.departments?.[0]?.id || "", cost_center: "",
            budget_id: options.budgets?.[0]?.id || "", category_id: "", account_id: "",
        }) };
    }

    openConfigModal(kind) {
        const claimOptions = this.state.pageData?.claim_options || {};
        const vendorOptions = this.state.pageData?.vendor_options || {};
        this.state.modal = { type: "config", kind, values: this._contractModalValues("configuration", kind, {
            category_id: claimOptions.claim_categories?.[0]?.id || "",
            account_id: vendorOptions.accounts?.[0]?.id || "",
        }) };
    }

    async submitOperationalModal() {
        const modal = this.state.modal;
        const call = modal.type === "petty" && modal.kind === "custodian" ? ["app_assign_custodian", [modal.values.fund_id, modal.values.custodian_id]]
            : modal.type === "petty" ? ["app_create_petty_record", [modal.kind, { ...modal.values }]]
            : modal.type === "accounting" ? ["app_create_accounting_record", [modal.kind, { ...modal.values }]]
                : ["app_create_budget_record", [modal.kind, { ...modal.values }]];
        try {
            await this.orm.call("hr.expense.app", call[0], call[1]);
            this.notification.add("Record created successfully.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to create the record.", { type: "danger" });
        }
    }

    async pettyAction(kind, record, action) {
        try {
            await this.orm.call("hr.expense.app", "app_petty_action", [kind, record.id, action]);
            this.notification.add(`Petty cash ${action} completed.`, { type: "success" });
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to update petty cash.", { type: "danger" });
        }
    }

    async submitConfigurationModal() {
        try {
            await this.orm.call("hr.expense.app", "app_create_configuration", [this.state.modal.kind, { ...this.state.modal.values }]);
            this.notification.add("Configuration created.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to create the configuration.", { type: "danger" });
        }
    }

    async createRequest(submit = true) {
        const values = { ...this.state.modal.values, submit };
        try {
            await this.orm.call("hr.expense.app", "app_create_request", [values]);
            this.notification.add(submit ? "Request submitted for approval." : "Request saved as draft.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to save the request.", { type: "danger" });
        }
    }

    async createClaim(submit = true) {
        try {
            const claim = await this.orm.call("hr.expense.app", "app_create_claim", [{ ...this.state.modal.values, submit }]);
            this.notification.add(`${claim.name} ${submit ? "submitted" : "saved"}.`, { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to save the claim.", { type: "danger" });
        }
    }

    async createVendor() {
        try {
            const vendor = await this.orm.call("hr.expense.app", "app_create_vendor", [
                { ...this.state.modal.values },
            ]);
            this.notification.add(`Vendor ${vendor.name} created.`, { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to create the vendor.", { type: "danger" });
        }
    }

    async submitGovernanceModal() {
        const modal = this.state.modal;
        const methods = {
            policy: "app_create_policy", report: "app_create_custom_report",
            schedule: "app_create_scheduled_report", settings: "app_save_company_settings",
            theme: "app_save_theme",
            company: "app_save_company_profile",
        };
        try {
            const result = await this.orm.call("hr.expense.app", methods[modal.type], [{ ...modal.values }]);
            if (modal.type === "theme" && result) this.state.data.theme = result;
            if (modal.type === "company" && result) this.state.data.company = result;
            this.notification.add("Changes saved.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
            this.state.revision += 1;
        } catch (error) {
            this.notification.add(error.message || "Unable to save these changes.", { type: "danger" });
        }
    }

    async requestAction(record, action) {
        try {
            await this.orm.call("hr.expense.app", "app_request_action", [record.id, action, ""]);
            this.notification.add("Request updated.", { type: "success" });
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to update the request.", { type: "danger" });
        }
    }

    async submitDecision() {
        const modal = this.state.modal;
        try {
            await this.orm.call("hr.expense.app", "app_workflow_decision", [
                modal.kind, modal.record.id, modal.action, modal.comment,
            ]);
            const actionLabel = modal.action === "appeal" ? "appealed" : `${modal.action}d`;
            this.notification.add(`${modal.kind === "claim" ? "Claim" : "Request"} ${actionLabel}.`, { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to record the decision.", { type: "danger" });
        }
    }

    async retireAdvance() {
        const modal = this.state.modal;
        try {
            await this.orm.call("hr.expense.app", "app_retire_advance", [
                modal.record.id, Number(modal.values.amount), modal.values.reference,
            ]);
            this.notification.add("Advance retirement posted.", { type: "success" });
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to retire the advance.", { type: "danger" });
        }
    }

    async submitWriteoff() {
        const modal = this.state.modal;
        try {
            if (modal.type === "writeoff") {
                await this.orm.call("hr.expense.app", "app_create_writeoff", [modal.values.advance_id || modal.record.id, Number(modal.values.amount), modal.values.reason]);
                this.notification.add("Write-off submitted for independent approval.", { type: "success" });
            } else {
                await this.orm.call("hr.expense.app", "app_writeoff_decision", [modal.record.id, modal.decision, modal.values.note]);
                this.notification.add(`Write-off ${modal.decision}d.`, { type: "success" });
            }
            this.closeModal();
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to update the write-off.", { type: "danger" });
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
        const claimIds = this.filteredRecords.map((record) => record.id);
        if (!method || !claimIds.length) {
            this.notification.add("There are no payable claims or active payment methods.", { type: "warning" });
            return;
        }
        try {
            const batch = await this.orm.call("hr.expense.app", "app_process_payment_batch", [claimIds, method.id]);
            this.notification.add(`Batch ${batch.name} finished with status ${batch.state}.`, { type: batch.state === "completed" ? "success" : "warning" });
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to process the payment batch.", { type: "danger" });
        }
    }

    async processOnePayable(record) {
        const method = this.state.pageData.methods?.[0];
        if (!method) {
            this.notification.add("Configure an active payment method first.", { type: "warning" });
            return;
        }
        try {
            const batch = await this.orm.call("hr.expense.app", "app_process_payment_batch", [[record.id], method.id]);
            this.notification.add(`${record.name} processed in ${batch.name}.`, { type: batch.state === "completed" ? "success" : "warning" });
            await this.loadActivePage();
        } catch (error) {
            this.notification.add(error.message || "Unable to process this payment.", { type: "danger" });
        }
    }

    openPettyCashAction(xmlId) {
        return this.action.doAction(xmlId);
    }

    openFinancialAction(xmlId) {
        return this.action.doAction(xmlId);
    }

    openGlobalAction(xmlId) {
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
        return this.openClaimModal();
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

    renderFeatureChart() {
        this.destroyCharts();
        const canvas = this.pageChartRef.el;
        if (!canvas) return;
        const charts = this.state.pageData?.charts || {};
        if (charts.monthly) {
            this.charts.page = new Chart(canvas.getContext("2d"), {
                type: "line",
                data: { labels: charts.monthly.map((row) => row.label), datasets: [
                    { label: "Submitted", data: charts.monthly.map((row) => row.submitted), borderColor: "#ec4899", backgroundColor: "#ec489922", fill: true, tension: 0.35 },
                    { label: "Paid", data: charts.monthly.map((row) => row.paid), borderColor: "#10b981", tension: 0.35 },
                ] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
            });
        } else if (charts.departments) {
            this.charts.page = new Chart(canvas.getContext("2d"), {
                type: "bar", data: { labels: charts.departments.map((row) => row.label), datasets: [{ label: "Members", data: charts.departments.map((row) => row.value), backgroundColor: "#8b5cf6", borderRadius: 7 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
            });
        } else if (charts.series) {
            this.charts.page = new Chart(canvas.getContext("2d"), {
                type: charts.series.length <= 5 ? "doughnut" : "bar",
                data: { labels: charts.series.map((row) => row.label), datasets: [{ label: "Value", data: charts.series.map((row) => row.value), backgroundColor: ["#ec4899", "#8b5cf6", "#10b981", "#f59e0b", "#2563eb", "#ef4444", "#14b8a6", "#64748b"], borderWidth: 0, borderRadius: 7 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: charts.series.length <= 5 ? {} : { y: { beginAtZero: true } } },
            });
        }
    }
}

registry.category("actions").add("hr_expense_management.expense_app", ExpenseApp);
