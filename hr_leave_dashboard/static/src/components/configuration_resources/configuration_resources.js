/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SettingsPanel, TagsPicker } from "../policy_controls";

const holidayForm = () => ({ id: false, name: "", type: "public", date_from: "", date_to: "", applies_to: "all", location_ids: [], repeats: "once", country_id: false, state_id: false, country_region: "", description: "", active: true });
const blackoutForm = () => ({ id: false, name: "", date_from: "", date_to: "", applies_to: "all", department_ids: [], policy_ids: [], group_ids: [], reason: "", state: "draft", exception_mode: "hard_block", exception_chain_id: false });

class ResourcePage extends Component {
    setup() {
        this.orm = useService("orm"); this.notification = useService("notification");
        this.state = useState({ loading: true, rows: [], options: [], catalog: {}, form: null, search: "", actionMenu: false, canExport: false });
        onWillStart(async () => {
            const access = await this.orm.call("hr.leave", "get_leave_access_profile", []);
            this.state.canExport = Boolean(access.can_export);
            await this.load();
        });
    }
    get visibleRows() { const q = this.state.search.toLowerCase(); return this.state.rows.filter(row => !q || `${row.name} ${row.reason || row.description || ""}`.toLowerCase().includes(q)); }
    get resourceLabel() { return this.model === "hr.leave.official.holiday" ? "Holiday" : "Blackout Window"; }
    get resourceLabelPlural() { return this.model === "hr.leave.official.holiday" ? "Holidays" : "Blackout Windows"; }
    actionLabel(action) { return `${action} ${this.resourceLabel}`; }
    statusActionLabel(row) { return this.model === "hr.leave.blackout.period" ? "Change Status" : (row.active === false ? "Activate" : "Deactivate"); }
    scopeLabel(value) { return ({ all: "Company Wide", departments: "Department Based", policies: "Policy Based", groups: "Group Based" })[value] || "—"; }
    formatDate(value) { if (!value) return "—"; return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
    formatDateRange(row) { const start = this.formatDate(row.date_from); return row.date_to && row.date_to !== row.date_from ? `${start} – ${this.formatDate(row.date_to)}` : start; }
    holidayTypeLabel(value) { return ({ public: "Public Holiday", religious: "Religious Holiday", regional: "Regional Holiday", observance: "Observance" })[value] || value || "—"; }
    repeatLabel(value) { return value === "annually" ? "Annually" : "One-off"; }
    toggle(field, id) { const values = this.state.form[field], index = values.indexOf(id); index < 0 ? values.push(id) : values.splice(index, 1); }
    edit(row) { this.state.actionMenu = false; this.state.form = { ...JSON.parse(JSON.stringify(row)), viewOnly: false }; }
    view(row) { this.state.actionMenu = false; this.state.form = { ...JSON.parse(JSON.stringify(row)), viewOnly: true }; }
    toggleActionMenu(id) { this.state.actionMenu = this.state.actionMenu === id ? false : id; }
    close() { this.state.form = null; }
    async remove(row) { this.state.actionMenu = false; if (!window.confirm(`Delete ${row.name}?`)) return; await this.orm.call(this.model, this.deleteMethod, [row.id]); await this.load(); }
    async duplicate(row) { this.state.actionMenu = false; await this.orm.call(this.model, this.duplicateMethod, [row.id]); await this.load(); }
}

export class OfficialHolidaysPage extends ResourcePage {
    static template = "hr_leave_dashboard.OfficialHolidaysPage";
    static props = ["*"];
    static components = { SettingsPanel, TagsPicker };
    model = "hr.leave.official.holiday"; deleteMethod = "delete_holiday"; duplicateMethod = "duplicate_holiday";
    async load() { this.state.loading = true; const data = await this.orm.call(this.model, "get_holiday_page_data", []); this.state.rows = data.rows; this.state.options = data.locations; this.state.catalog = data; this.state.loading = false; }
    add() { this.state.form = holidayForm(); }
    get holidayStates() {
        const countryId = Number(this.state.form?.country_id || 0);
        return (this.state.catalog.states || []).filter((state) => !countryId || state.country_id === countryId);
    }
    onHolidayCountryChange() {
        const selected = this.holidayStates.find((state) => state.id === Number(this.state.form.state_id));
        if (!selected) this.state.form.state_id = false;
    }
    onStartDateChange() {
        // A one-day holiday is the common case; assist the user while still
        // allowing a later end date for multi-day holidays.
        if (!this.state.form.date_to || this.state.form.date_to === this.state.form.date_from) {
            this.state.form.date_to = this.state.form.date_from;
        }
    }
    get selectedLocations() { return (this.state.options || []).filter(item => this.state.form?.location_ids?.includes(item.id)); }
    async save() { try { await this.orm.call(this.model, "save_holiday", [this.state.form]); this.close(); await this.load(); this.notification.add("Official holiday saved.", { type: "success" }); } catch (e) { this.notification.add(e.data?.message || e.message, { type: "danger" }); } }
    async change(row) { this.state.actionMenu = false; await this.orm.call(this.model, "set_holiday_active", [row.id, !row.active]); await this.load(); }
}

export class BlackoutWindowsPage extends ResourcePage {
    static template = "hr_leave_dashboard.BlackoutWindowsPage";
    static props = ["*"];
    static components = { SettingsPanel, TagsPicker };
    model = "hr.leave.blackout.period"; deleteMethod = "delete_blackout"; duplicateMethod = "duplicate_blackout";
    async load() { this.state.loading = true; const data = await this.orm.call(this.model, "get_blackout_page_data", []); this.state.rows = data.rows; this.state.options = data.departments; this.state.catalog = data; this.state.loading = false; }
    add() { this.state.form = blackoutForm(); }
    get selectedDepartments() { return (this.state.options || []).filter(item => this.state.form?.department_ids?.includes(item.id)); }
    get selectedPolicies() { return (this.state.catalog.policies || []).filter(item => this.state.form?.policy_ids?.includes(item.id)); }
    get selectedGroups() { return (this.state.catalog.groups || []).filter(item => this.state.form?.group_ids?.includes(item.id)); }
    async save() { try { await this.orm.call(this.model, "save_blackout", [this.state.form]); this.close(); await this.load(); this.notification.add("Blackout window saved.", { type: "success" }); } catch (e) { this.notification.add(e.data?.message || e.message, { type: "danger" }); } }
    parseCsv(text) {
        const rows = []; let row = [], cell = "", quoted = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i], next = text[i + 1];
            if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
            else if (char === '"') quoted = !quoted;
            else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
            else if ((char === "\n" || char === "\r") && !quoted) {
                if (char === "\r" && next === "\n") i++;
                row.push(cell.trim()); if (row.some(value => value)) rows.push(row);
                row = []; cell = "";
            } else cell += char;
        }
        if (cell || row.length) { row.push(cell.trim()); if (row.some(value => value)) rows.push(row); }
        if (rows.length < 2) throw new Error("The import contains no blackout rows.");
        const headers = rows.shift().map(value => value.replace(/^\ufeff/, "").toLowerCase().replace(/\s+/g, "_") );
        return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
    }
    async importBlackouts(event) {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        try {
            const result = await this.orm.call(this.model, "import_blackouts", [this.parseCsv(await file.text())]);
            if (result.errors?.length) {
                this.notification.add(`${result.imported} row(s) imported; ${result.errors.length} row(s) rejected.`, { type: "warning" });
                console.warn("Blackout import row errors", result.errors);
            } else this.notification.add(`${result.imported} blackout window(s) imported.`, { type: "success" });
            await this.load();
        } catch (e) { this.notification.add(e.data?.message || e.message || "Blackout import failed.", { type: "danger" }); }
    }
    exportRows() {
        if (!this.visibleRows.length) { this.notification.add("No blackout windows available to export.", { type: "warning" }); return; }
        const columns = ["name", "date_from", "date_to", "applies_to", "department_ids", "policy_ids", "group_ids", "exception_mode", "exception_chain_id", "reason", "state"];
        const csv = [columns.join(","), ...this.visibleRows.map(row => columns.map(column => {
            const value = column === "department_ids" ? (row.department_ids || []).join(";") : column === "policy_ids" ? (row.policy_ids || []).join(";") : column === "group_ids" ? (row.group_ids || []).join(";") : (row[column] ?? "");
            return `"${String(value).replaceAll('"', '""')}"`;
        }).join(","))].join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = `blackout_windows_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
        this.notification.add("Blackout windows exported as CSV.", { type: "success" });
    }
    async setStatus(row, state) {
        this.state.actionMenu = false;
        if (state === row.state) return;
        try {
            await this.orm.call(this.model, "set_blackout_state", [row.id, state]);
            await this.load();
        } catch (e) {
            this.notification.add(e.data?.message || e.message, { type: "danger" });
        }
    }
}
