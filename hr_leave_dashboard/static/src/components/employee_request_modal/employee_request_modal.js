/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class EmployeeRequestModal extends Component {
    static template = "hr_leave_dashboard.EmployeeRequestModal";
    static props = { close: Function, submitted: { type: Function, optional: true } };
    setup() {
        this.orm = useService("orm"); this.notification = useService("notification");
        this.state = useState({ loading: true, submitting: false, types: [], balances: [], form: { leave_type_id: "", date_from: "", date_to: "", half_day: false, period: "am", reason: "", emergency_contact: "", attachment: null }, preview: null, error: "" });
        onWillStart(async () => { const data = await this.orm.call("hr.leave", "get_employee_request_options", []); this.state.types = data.leave_types || []; this.state.balances = data.leave_types || []; this.state.loading = false; });
    }
    get selectedType() { return this.state.types.find(item => item.id === Number(this.state.form.leave_type_id)); }
    get canSubmit() { const p = this.state.preview; return !this.state.submitting && p && p.eligible && !(p.errors || []).length && this.state.form.reason.trim().length >= 5 && (!p.document_required || this.state.form.attachment); }
    friendlyError(error, fallback) {
        const message = error?.data?.message || error?.cause?.data?.message || error?.cause?.message;
        if (message && !/odoo server error/i.test(message)) return message;
        return fallback;
    }
    onStartChange() { if (!this.state.form.date_to || this.state.form.date_to < this.state.form.date_from) this.state.form.date_to = this.state.form.date_from; return this.preview(); }
    async preview() {
        const f = this.state.form; this.state.error = "";
        if (!f.leave_type_id || !f.date_from || !f.date_to) { this.state.preview = null; return; }
        try { this.state.preview = await this.orm.call("hr.leave", "preview_employee_leave_request", [Number(f.leave_type_id), f.date_from, f.date_to, f.half_day, f.period]); }
        catch (error) { this.state.preview = null; this.state.error = this.friendlyError(error, "We could not validate these dates. Please review them and try again."); }
    }
    async onFileChange(event) {
        const file = event.target.files?.[0]; if (!file) { this.state.form.attachment = null; return; }
        if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { this.state.error = "Only PDF, JPG and PNG files are supported."; event.target.value = ""; return; }
        if (file.size > 10 * 1024 * 1024) { this.state.error = "The attachment must not exceed 10 MB."; event.target.value = ""; return; }
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        this.state.form.attachment = { name: file.name, mimetype: file.type, data }; this.state.error = "";
    }
    async submit() {
        if (!this.canSubmit) return; this.state.submitting = true;
        try { const result = await this.orm.call("hr.leave", "submit_employee_leave_request", [{ ...this.state.form, leave_type_id: Number(this.state.form.leave_type_id) }]); if (!result.ok) { this.state.error = result.message || "Please review the request details and try again."; return; } this.notification.add(result.message, { title: result.reference, type: "success" }); if (this.props.submitted) await this.props.submitted(); this.props.close(); }
        catch (error) { this.state.error = this.friendlyError(error, "We could not submit your request right now. Please try again or contact HR if the problem continues."); }
        finally { this.state.submitting = false; }
    }
}
