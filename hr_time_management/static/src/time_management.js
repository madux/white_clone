/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class TimeManagementApp extends Component {
    static template = "hr_time_management.App";

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        const now = new Date();
        const iso = now.toISOString().slice(0, 10);
        this.state = useState({
            gateway: true, page: "dashboard", loading: false, rows: [], counts: {}, attendanceRate: 0,
            departments: [], shifts: [], status: "all", search: "", departmentId: "",
            dateFrom: iso, dateTo: iso, detail: null, edit: null, editReason: "", error: "", gatewayMessage: "",
        });
        onWillStart(() => this.load());
    }

    async load() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("hr.attendance", "get_cleon_time_data", [], {
                view: this.state.page, date_from: this.state.dateFrom, date_to: this.state.dateTo,
                department_id: this.state.departmentId || false, search: this.state.search,
            });
            this.state.rows = data.rows; this.state.counts = data.counts;
            this.state.attendanceRate = data.attendance_rate;
            this.state.departments = data.departments; this.state.shifts = data.shifts;
        } catch (error) {
            this.notification.add(error?.data?.message || "Could not load attendance data.", { type: "danger" });
        } finally { this.state.loading = false; }
    }

    get filteredRows() {
        return this.state.status === "all" ? this.state.rows : this.state.rows.filter(row => row.status === this.state.status);
    }
    label(status) { return ({present:"Present", late:"Late", absent:"Absent", on_leave:"On Leave"})[status] || status; }
    selectAttendance() { this.state.gateway = false; this.state.page = "dashboard"; this.load(); }
    selectPending(name) { this.state.gatewayMessage = `${name} is part of this foundation; its detailed screens are the next implementation stage.`; }
    showGateway() { this.state.gateway = true; }
    setPage(page) {
        this.state.page = page; this.state.status = "all"; this.state.detail = null;
        if (page === "sheet") {
            const today = new Date();
            this.state.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1, 12).toISOString().slice(0, 10);
            this.state.dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12).toISOString().slice(0, 10);
        }
        this.load();
    }
    setStatus(status) { this.state.status = status; }
    openDetail(row) { this.state.detail = row; }
    closeDetail() { this.state.detail = null; }
    openEdit(row) { this.state.edit = {...row}; this.state.editReason = ""; this.state.error = ""; }
    closeEdit() { this.state.edit = null; this.state.error = ""; }
    async applyFilters() { await this.load(); }

    localInput(value) {
        if (!value) return "";
        const date = new Date(value.replace(" ", "T") + "Z");
        const offset = date.getTimezoneOffset();
        return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
    }
    serverDatetime(value) {
        if (!value) return false;
        return new Date(value).toISOString().slice(0, 19).replace("T", " ");
    }
    async saveEdit() {
        if (!this.state.editReason.trim()) { this.state.error = "A reason is required for audit and compliance."; return; }
        try {
            await this.orm.call("hr.attendance", "cleon_update_attendance", [[this.state.edit.id], {
                check_in: this.serverDatetime(this.state.edit.check_in_input),
                check_out: this.serverDatetime(this.state.edit.check_out_input),
                cleon_break_minutes: Number(this.state.edit.break_minutes || 0),
                cleon_status_override: this.state.edit.status,
                cleon_shift_id: this.state.edit.shift_id || false,
            }, this.state.editReason]);
            this.notification.add("Attendance record updated and added to the audit trail.", { type: "success" });
            this.closeEdit(); await this.load();
        } catch (error) { this.state.error = error?.data?.message || "The attendance record could not be updated."; }
    }
    beginEdit(row) {
        this.openEdit({...row, check_in_input: this.localInput(row.check_in_raw), check_out_input: this.localInput(row.check_out_raw)});
    }
    exportCsv() {
        const header = ["Employee","Employee ID","Department","Date","Clock In","Clock Out","Hours","Status"];
        const lines = this.filteredRows.map(r => [r.employee,r.employee_code,r.department,r.date,r.check_in,r.check_out,r.hours,this.label(r.status)]);
        const csv = [header, ...lines].map(line => line.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
        link.download = `attendance-${this.state.dateFrom}.csv`; link.click(); URL.revokeObjectURL(link.href);
    }
}

registry.category("actions").add("hr_time_management.App", TimeManagementApp);
