/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useEffect, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";

export class LeaveReportsPage extends Component {
    static template = "hr_leave_dashboard.LeaveReportsPage";
    static components = { CalendarSidebar };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.action = useService("action");
        this.typeChartRef = useRef("typeChart");
        this.trendChartRef = useRef("trendChart");
        this.departmentChartRef = useRef("departmentChart");
        this.balanceChartRef = useRef("balanceChart");
        this.charts = {};
        this.state = useState({
            loading: true, data: { kpis: {}, status: {}, monthly: {}, by_type: [], departments: [], leave_types: [], leave_type_summary: [], type_usage: [], type_totals: {}, type_kpis: {}, department_summary: [], employee_summary: [], period: {}, balance: { allocated: 0, used: 0, pending: 0, remaining: 0, utilisation: 0, rows: [] } },
            activeTab: "overview", viewMode: "admin", lastRefreshed: "", exportOpen: false, revision: 0, selectedDepartmentId: null,
            filters: { date_range: "this_year", department_id: "", leave_type_id: "", start_date: "", end_date: "" },
        });
        for (const name of ["setTab", "setViewMode", "selectDepartment", "exportReport"]) this[name] = this[name].bind(this);
        onWillStart(async () => { await loadBundle("web.chartjs_lib"); await this.refresh(); });
        useEffect(() => { if (!this.state.loading) this.renderCharts(); return () => this.destroyCharts(); }, () => [this.state.revision, this.state.activeTab]);
        onWillUnmount(() => this.destroyCharts());
    }

    get tabs() { return [{ key: "overview", label: "Overview", icon: "fa-bar-chart" }, { key: "types", label: "Leave Type Summary", icon: "fa-pie-chart" }, { key: "departments", label: "Department Analysis", icon: "fa-building" }, { key: "balances", label: "Balance Report", icon: "fa-balance-scale" }, { key: "employees", label: "Employee Summary", icon: "fa-user" }]; }
    get dailyStatusLabel() { return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()); }
    async refresh() {
        this.state.loading = true;
        try {
            this.state.data = await this.orm.call("hr.leave.report.service", "get_report_data", [], { filters: { ...this.state.filters } });
            this.state.lastRefreshed = new Date().toLocaleTimeString(); this.state.revision++;
        } catch (error) { this.notification.add(error.message || "Unable to load leave reports.", { type: "danger" }); }
        finally { this.state.loading = false; }
    }
    setTab(key) { this.state.activeTab = key; }
    setViewMode(mode) { this.state.viewMode = mode; }
    openTour() { this.notification.add("Choose a report tab, then use the shared filters to update every report view.", { title: "Reports Tour", type: "info" }); }
    openHelp() { this.notification.add("Refresh retrieves live data; Print and Export use the active tab and filters.", { title: "Reports Guide", type: "info" }); }
    openSetup() { return this.action.doAction("hr_leave_dashboard.action_hr_leave_admin_dashboard", { additionalContext: { open_setup_wizard: true } }); }
    selectDepartment(id) { this.state.selectedDepartmentId = this.state.selectedDepartmentId === id ? null : id; }
    async viewToday() { this.state.filters.date_range = "today"; await this.refresh(); }
    destroyCharts() { Object.values(this.charts).forEach(chart => chart?.destroy()); this.charts = {}; }
    renderCharts() {
        this.destroyCharts();
        if (this.state.activeTab === "departments") return this.renderDepartmentChart();
        if (this.state.activeTab === "balances") return this.renderBalanceChart();
        if (this.state.activeTab !== "overview") return;
        const typeCanvas = this.typeChartRef.el, trendCanvas = this.trendChartRef.el;
        if (!typeCanvas || !trendCanvas) return;
        const types = this.state.data.by_type || [], monthly = this.state.data.monthly || {};
        this.charts.type = new Chart(typeCanvas.getContext("2d"), { type: "pie", data: { labels: types.map(item => `${item.name}: ${item.days}d`), datasets: [{ data: types.map(item => item.days), backgroundColor: types.map(item => item.color), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } } });
        this.charts.trend = new Chart(trendCanvas.getContext("2d"), { type: "line", data: { labels: monthly.labels || [], datasets: [{ label: "Approved", data: monthly.approved || [], borderColor: "#10b981", backgroundColor: "#10b98155", fill: true, tension: .35 }, { label: "Pending", data: monthly.pending || [], borderColor: "#f59e0b", backgroundColor: "#f59e0b55", fill: true, tension: .35 }, { label: "Rejected", data: monthly.rejected || [], borderColor: "#ef476f", backgroundColor: "#ef476f44", fill: true, tension: .35 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }
    renderDepartmentChart() {
        const canvas = this.departmentChartRef.el, rows = this.state.data.department_summary || [];
        if (!canvas) return;
        this.charts.department = new Chart(canvas.getContext("2d"), { type: "bar", data: { labels: rows.map(row => row.name), datasets: [{ label: "Total Days", data: rows.map(row => row.days), backgroundColor: "#ed3d98" }, { label: "Requests", data: rows.map(row => row.total), backgroundColor: "#8b5cf6" }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, onClick: (_event, elements) => { if (elements.length) this.selectDepartment(rows[elements[0].index].id); }, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { beginAtZero: true } } } });
    }
    renderBalanceChart() {
        const canvas = this.balanceChartRef.el, balance = this.state.data.balance || {};
        if (!canvas) return;
        this.charts.balance = new Chart(canvas.getContext("2d"), { type: "pie", data: { labels: ["Used", "Pending", "Remaining"], datasets: [{ data: [balance.used || 0, balance.pending || 0, Math.max(balance.remaining || 0, 0)], backgroundColor: ["#3b82f6", "#f59e0b", "#10b981"], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } } });
    }
    printReport() { window.print(); }
    exportReport(format) {
        this.state.exportOpen = false;
        const rows = this.exportRows(), separator = format === "excel" ? "\t" : ",";
        const quote = value => format === "excel" ? String(value ?? "") : `"${String(value ?? "").replaceAll('"', '""')}"`;
        const body = rows.map(row => row.map(quote).join(separator)).join("\n");
        const blob = new Blob(["\uFEFF" + body], { type: format === "excel" ? "application/vnd.ms-excel" : "text/csv;charset=utf-8" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `leave_${this.state.activeTab}_report.${format === "excel" ? "xls" : "csv"}`; link.click(); URL.revokeObjectURL(link.href);
    }
    exportRows() {
        const data = this.state.data;
        if (this.state.activeTab === "types") return [["Rank", "Leave Type", "Category", "Entitlement", "Employees", "Requests", "Approved", "Pending", "Rejected", "Cancelled", "Days Taken", "Average Days", "Share %"], ...data.type_usage.map(row => [row.rank, row.name, row.category_label, row.entitlement, row.employees, row.requests, row.approved, row.pending, row.rejected, row.cancelled, row.days_taken, row.average_days, row.share])];
        if (this.state.activeTab === "departments") return [["Department", "Total Requests", "Total Days", "Average Days/Request"], ...data.department_summary.map(row => [row.name, row.total, row.days, row.average_days])];
        if (this.state.activeTab === "employees") return [["Rank", "Employee ID", "Employee", "Department", "Total Approved Days", "Approved Requests", "Average Days/Request"], ...data.employee_summary.map(row => [row.rank, row.code, row.name, row.department, row.total_days, row.requests, row.average_days])];
        if (this.state.activeTab === "balances") return [["Metric", "Days", "% of Allocated"], ...(data.balance?.rows || []).map(row => [row.label, row.days, row.percentage])];
        return [["Measure", "Value"], ["Total Requests", data.kpis.total || 0], ["Approved", data.kpis.approved || 0], ["Pending", data.kpis.pending || 0], ["Total Days", data.kpis.total_days || 0]];
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveReportsPage", LeaveReportsPage);
