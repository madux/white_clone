/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useEffect, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";

const EMPTY_DATA = {
    meta: { period: {}, scope_label: "", employee_count: 0 },
    options: { departments: [], locations: [], units: [], employees: [], leave_types: [] },
    reports: {
        utilisation: { by_type: [], by_employee: [] }, balances: { rows: [], totals: {} },
        request_volume: { counts: {}, monthly: [] }, turnaround: { by_approver: [], by_type: [] },
        trends: { monthly: [] }, frequency: { department: [], location: [], unit: [] },
        policy_usage: [], absence_risk: { mode: "aggregate", rows: [], bands: {}, settings: { thresholds: {} } },
    },
};

export class LeaveReportsPage extends Component {
    static template = "hr_leave_dashboard.LeaveReportsPage";
    static components = { CalendarSidebar };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.action = useService("action");
        this.chartRef = useRef("reportChart");
        this.chart = null;
        this.loadSequence = 0;
        this.state = useState({
            loading: true, exporting: false, data: EMPTY_DATA, activeReport: "request_volume",
            frequencyDimension: "department", filtersOpen: false, exportOpen: false,
            revision: 0, lastRefreshed: "", drilldown: null, riskSettingsOpen: false,
            riskForm: { enabled: true, window_weeks: 52, minimum_spell_days: 1, thresholds: { caution: 51, concern: 101, serious: 201, critical: 401 } },
            filters: {
                date_range: "this_year", start_date: "", end_date: "",
                department_ids: [], location_ids: [], unit_ids: [], leave_type_ids: [], employee_ids: [],
            },
        });
        onWillStart(async () => { await loadBundle("web.chartjs_lib"); await this.refresh(); });
        useEffect(() => { if (!this.state.loading) this.renderChart(); return () => this.destroyChart(); }, () => [this.state.revision, this.state.activeReport, this.state.frequencyDimension]);
        onWillUnmount(() => this.destroyChart());
    }

    get reports() {
        return [
            { key: "request_volume", label: "Request Volume", icon: "fa-inbox" },
            { key: "utilisation", label: "Leave Utilisation", icon: "fa-pie-chart" },
            { key: "balances", label: "Balance Summary", icon: "fa-balance-scale" },
            { key: "turnaround", label: "Approval Turnaround", icon: "fa-clock-o" },
            { key: "trends", label: "Absence Trends", icon: "fa-line-chart" },
            { key: "frequency", label: "Leave Frequency", icon: "fa-building-o" },
            { key: "policy_usage", label: "Policy Usage", icon: "fa-sliders" },
            { key: "absence_risk", label: "Absence Risk", icon: "fa-exclamation-triangle" },
        ];
    }
    get activeDefinition() { return this.reports.find(item => item.key === this.state.activeReport) || this.reports[0]; }
    get usesDateRange() { return !["utilisation", "balances", "absence_risk"].includes(this.state.activeReport); }
    get currentFrequencyRows() { return this.state.data.reports.frequency?.[this.state.frequencyDimension] || []; }
    get activeFilterCount() { return ["department_ids", "location_ids", "unit_ids", "leave_type_ids", "employee_ids"].reduce((total, key) => total + this.state.filters[key].length, 0); }
    get filterGroups() {
        const options = this.state.data.options;
        return [
            { key: "department_ids", label: "Department", rows: options.departments || [] },
            { key: "location_ids", label: "Location", rows: options.locations || [] },
            { key: "unit_ids", label: "Unit", rows: options.units || [] },
            { key: "leave_type_ids", label: "Leave Type", rows: options.leave_types || [] },
            { key: "employee_ids", label: "Employee", rows: options.employees || [] },
        ];
    }
    get activeChips() {
        const chips = [];
        for (const group of this.filterGroups) {
            for (const id of this.state.filters[group.key]) {
                const row = group.rows.find(item => item.id === id);
                if (row) chips.push({ key: group.key, id, label: `${group.label}: ${row.name}` });
            }
        }
        return chips;
    }

    async refresh() {
        if (this.usesDateRange && this.state.filters.date_range === "custom" && (!this.state.filters.start_date || !this.state.filters.end_date)) {
            this.state.loading = false;
            return;
        }
        const loadSequence = ++this.loadSequence;
        const reportKey = this.state.activeReport;
        this.state.loading = true;
        try {
            const filters = { ...this.state.filters, frequency_dimension: this.state.frequencyDimension };
            const response = await this.orm.call("hr.leave.report.service", "get_report_data", [], { filters, report_key: reportKey });
            if (loadSequence !== this.loadSequence) return;
            this.state.data = {
                ...response,
                reports: {
                    ...EMPTY_DATA.reports,
                    ...(this.state.data.reports || {}),
                    ...(response.reports || {}),
                },
            };
            this.state.lastRefreshed = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            this.state.revision++;
            const settings = this.state.data.reports.absence_risk?.settings;
            if (settings) this.state.riskForm = JSON.parse(JSON.stringify(settings));
            window.dispatchEvent(new CustomEvent("cleon-ai-context", { detail: {
                screen: "leave.reports", title: this.activeDefinition.label,
                report: this.state.activeReport, filters,
            }}));
        } catch (error) {
            if (loadSequence !== this.loadSequence) return;
            this.notification.add(error.data?.message || error.message || "Unable to load leave reports.", { type: "danger" });
        } finally {
            if (loadSequence === this.loadSequence) this.state.loading = false;
        }
    }
    async setReport(key) {
        this.state.loading = true;
        this.state.activeReport = key;
        this.state.exportOpen = false;
        await this.refresh();
    }
    setFrequencyDimension(dimension) { this.state.frequencyDimension = dimension; this.state.revision++; }
    async setDateRange() { if (this.state.filters.date_range !== "custom") await this.refresh(); }
    toggleFilter(key, id) {
        const selected = this.state.filters[key];
        this.state.filters[key] = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    }
    isSelected(key, id) { return this.state.filters[key].includes(id); }
    async removeChip(chip) { this.state.filters[chip.key] = this.state.filters[chip.key].filter(id => id !== chip.id); await this.refresh(); }
    async clearFilters() {
        for (const key of ["department_ids", "location_ids", "unit_ids", "leave_type_ids", "employee_ids"]) this.state.filters[key] = [];
        await this.refresh();
    }
    async applyFilters() { this.state.filtersOpen = false; await this.refresh(); }

    destroyChart() { if (this.chart) this.chart.destroy(); this.chart = null; }
    renderChart() {
        this.destroyChart();
        const canvas = this.chartRef.el;
        if (!canvas || !["request_volume", "utilisation", "turnaround", "trends", "frequency", "absence_risk"].includes(this.state.activeReport)) return;
        let config;
        const reports = this.state.data.reports;
        if (this.state.activeReport === "request_volume") {
            const rows = reports.request_volume.monthly || [];
            config = { type: "line", data: { labels: rows.map(row => row.month), datasets: [
                { label: "Submitted", data: rows.map(row => row.submitted), borderColor: "#d90868", backgroundColor: "#d9086822", fill: true, tension: .3 },
                { label: "Approved", data: rows.map(row => row.approved), borderColor: "#16a36a", tension: .3 },
                { label: "Rejected", data: rows.map(row => row.rejected), borderColor: "#e34b5f", tension: .3 },
            ] } };
        } else if (this.state.activeReport === "utilisation") {
            const rows = reports.utilisation.by_type || [];
            config = { type: "bar", data: { labels: rows.map(row => row.name), datasets: [
                { label: "Allocated", data: rows.map(row => row.allocated), backgroundColor: "#dbe4f4" },
                { label: "Used", data: rows.map(row => row.used), backgroundColor: "#d90868" },
            ] } };
        } else if (this.state.activeReport === "turnaround") {
            const rows = reports.turnaround.by_approver || [];
            config = { type: "bar", data: { labels: rows.map(row => row.name), datasets: [{ label: "Average hours", data: rows.map(row => row.average_hours), backgroundColor: "#7c5ce7" }] } };
        } else if (this.state.activeReport === "trends") {
            const rows = reports.trends.monthly || [];
            config = { type: "line", data: { labels: rows.map(row => row.month), datasets: [
                { label: "Approved days", data: rows.map(row => row.days), borderColor: "#d90868", backgroundColor: "#d9086822", fill: true, tension: .3 },
                { label: "Approved requests", data: rows.map(row => row.requests), borderColor: "#2785da", tension: .3 },
            ] } };
        } else if (this.state.activeReport === "frequency") {
            const rows = this.currentFrequencyRows;
            config = { type: "bar", data: { labels: rows.map(row => row.name), datasets: [
                { label: "Requests", data: rows.map(row => row.requests), backgroundColor: "#d90868" },
                { label: "Requests / employee", data: rows.map(row => row.requests_per_employee), backgroundColor: "#7c5ce7" },
            ] } };
        } else {
            const bands = reports.absence_risk.bands || {};
            config = { type: "doughnut", data: { labels: ["Low", "Caution", "Concern", "Serious", "Critical"], datasets: [{ data: [bands.low || 0, bands.caution || 0, bands.concern || 0, bands.serious || 0, bands.critical || 0], backgroundColor: ["#20a46b", "#e9b949", "#ef8d32", "#e34b5f", "#8e244d"] }] } };
        }
        config.options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 9 } } }, scales: config.type === "doughnut" ? undefined : { y: { beginAtZero: true } } };
        this.chart = new Chart(canvas.getContext("2d"), config);
    }

    async openDrilldown(row) {
        try {
            this.state.drilldown = { title: row.name, loading: true, rows: [] };
            const result = await this.orm.call("hr.leave.report.service", "get_report_drilldown", [this.state.frequencyDimension, row.id, { ...this.state.filters }]);
            this.state.drilldown = { title: row.name, loading: false, rows: result.rows || [] };
        } catch (error) {
            this.state.drilldown = null;
            this.notification.add(error.data?.message || error.message || "Unable to open report records.", { type: "danger" });
        }
    }
    closeDrilldown() { this.state.drilldown = null; }

    async exportReport(format) {
        this.state.exportOpen = false; this.state.exporting = true;
        try {
            const filters = { ...this.state.filters, frequency_dimension: this.state.frequencyDimension };
            const result = await this.orm.call("hr.leave.report.service", "export_report", [this.state.activeReport, filters, format]);
            const binary = atob(result.data); const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
            const url = URL.createObjectURL(new Blob([bytes], { type: result.mimetype }));
            const link = document.createElement("a"); link.href = url; link.download = result.filename; link.click(); URL.revokeObjectURL(url);
        } catch (error) {
            this.notification.add(error.data?.message || error.message || "Unable to export this report.", { type: "danger" });
        } finally { this.state.exporting = false; }
    }

    openRiskSettings() { this.state.riskSettingsOpen = true; }
    closeRiskSettings() { this.state.riskSettingsOpen = false; }
    async saveRiskSettings() {
        try {
            await this.orm.call("hr.leave.report.service", "save_absence_risk_settings", [this.state.riskForm]);
            this.state.riskSettingsOpen = false;
            this.notification.add("Absence-risk settings saved. They apply on the next calculation.", { type: "success" });
            await this.refresh();
        } catch (error) { this.notification.add(error.data?.message || error.message || "Unable to save risk settings.", { type: "danger" }); }
    }
    formatBand(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Low"; }
    formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—"; }
}

registry.category("actions").add("hr_leave_dashboard.LeaveReportsPage", LeaveReportsPage);
