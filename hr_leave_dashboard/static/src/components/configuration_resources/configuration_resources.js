/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

const holidayForm = () => ({ id: false, name: "", type: "public", date_from: "", date_to: "", applies_to: "all", location_ids: [], repeats: "once", country_id: false, state_id: false, country_region: "", description: "", active: true });
const blackoutForm = () => ({ id: false, name: "", date_from: "", date_to: "", applies_to: "all", department_ids: [], policy_ids: [], group_ids: [], reason: "", state: "draft", exception_mode: "hard_block", exception_chain_id: false });

class ResourcePage extends Component {
    setup() {
        this.orm = useService("orm"); this.notification = useService("notification");
        this.state = useState({ loading: true, rows: [], options: [], catalog: {}, form: null, search: "" });
        onWillStart(() => this.load());
    }
    get visibleRows() { const q = this.state.search.toLowerCase(); return this.state.rows.filter(row => !q || `${row.name} ${row.reason || row.description || ""}`.toLowerCase().includes(q)); }
    toggle(field, id) { const values = this.state.form[field], index = values.indexOf(id); index < 0 ? values.push(id) : values.splice(index, 1); }
    edit(row) { this.state.form = JSON.parse(JSON.stringify(row)); }
    close() { this.state.form = null; }
    async remove(row) { if (!window.confirm(`Delete ${row.name}?`)) return; await this.orm.call(this.model, this.deleteMethod, [row.id]); await this.load(); }
    async duplicate(row) { await this.orm.call(this.model, this.duplicateMethod, [row.id]); await this.load(); }
}

export class OfficialHolidaysPage extends ResourcePage {
    static template = "hr_leave_dashboard.OfficialHolidaysPage";
    static props = ["*"];
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
    async save() { try { await this.orm.call(this.model, "save_holiday", [this.state.form]); this.close(); await this.load(); this.notification.add("Official holiday saved.", { type: "success" }); } catch (e) { this.notification.add(e.data?.message || e.message, { type: "danger" }); } }
    async change(row) { await this.orm.call(this.model, "set_holiday_active", [row.id, !row.active]); await this.load(); }
}

export class BlackoutWindowsPage extends ResourcePage {
    static template = "hr_leave_dashboard.BlackoutWindowsPage";
    static props = ["*"];
    model = "hr.leave.blackout.period"; deleteMethod = "delete_blackout"; duplicateMethod = "duplicate_blackout";
    async load() { this.state.loading = true; const data = await this.orm.call(this.model, "get_blackout_page_data", []); this.state.rows = data.rows; this.state.options = data.departments; this.state.catalog = data; this.state.loading = false; }
    add() { this.state.form = blackoutForm(); }
    async save() { try { await this.orm.call(this.model, "save_blackout", [this.state.form]); this.close(); await this.load(); this.notification.add("Blackout window saved.", { type: "success" }); } catch (e) { this.notification.add(e.data?.message || e.message, { type: "danger" }); } }
    async change(row) { const next = row.state === "active" ? "draft" : "active"; await this.orm.call(this.model, "set_blackout_state", [row.id, next]); await this.load(); }
}
