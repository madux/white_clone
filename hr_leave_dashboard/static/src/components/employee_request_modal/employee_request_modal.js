/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SmartDateRecommendationsModal } from "../smart_date_modal/smart_date_modal";

export class EmployeeRequestModal extends Component {
    static template = "hr_leave_dashboard.EmployeeRequestModal";
    static components = { SmartDateRecommendationsModal };
    static props = { close: Function, submitted: { type: Function, optional: true }, initial: { type: Object, optional: true }, existingRequestId: { type: Number, optional: true } };
    setup() {
        this.orm = useService("orm"); this.notification = useService("notification");
        this.state = useState({
            loading: true,
            submitting: false,
            step: 1,
            types: [],
            balances: [],
            backupColleagues: [],
            nlEnabled: false,
            dateRecEnabled: false,
            nlText: "",
            nlLoading: false,
            nlError: "",
            nlSummary: "",
            showNlSummary: false,
            aiAssistedFields: [],
            showDateRecModal: false,
            form: {
                leave_type_id: "",
                date_from: "",
                date_to: "",
                half_day: false,
                period: "am",
                reason: "",
                blackout_exception_requested: false,
                handover_enabled: false,
                backup_colleague_ids: [],
                emergency_contact: "",
                handover_notes: "",
                attachment: null,
                submission_channel: "form",
            },
            preview: null,
            error: "",
        });
        onWillStart(async () => {
            const data = await this.orm.call("hr.leave", "get_employee_request_options", []);
            this.state.types = data.leave_types || [];
            this.state.balances = data.leave_types || [];
            this.state.backupColleagues = data.backup_colleagues || [];
            this.state.nlEnabled = Boolean(data.ai_capabilities?.nl_request);
            this.state.dateRecEnabled = Boolean(data.ai_capabilities?.date_recommendations);
            if (this.props.initial) Object.assign(this.state.form, this.props.initial);
            this.state.loading = false;
            if (this.props.initial) await this.preview();
        });
    }
    get selectedType() { return this.state.types.find(item => item.id === Number(this.state.form.leave_type_id)); }
    get detailsValid() { const p = this.state.preview; return p && p.eligible && !(p.errors || []).length && this.state.form.reason.trim().length >= 5; }
    get handoverValid() { return (!this.state.form.handover_enabled || this.state.form.backup_colleague_ids.length > 0) && (!this.state.preview?.document_required || Boolean(this.state.form.attachment)); }
    get canSubmit() { return !this.state.submitting && this.detailsValid && this.handoverValid; }
    get selectedBackups() { return this.state.backupColleagues.filter(item => this.state.form.backup_colleague_ids.includes(item.id)); }
    get today() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    friendlyError(error, fallback) {
        const message = error?.data?.message || error?.cause?.data?.message || error?.cause?.message;
        if (message && !/odoo server error/i.test(message)) return message;
        return fallback;
    }
    onStartChange() { if (!this.state.form.date_to || this.state.form.date_to < this.state.form.date_from) this.state.form.date_to = this.state.form.date_from; return this.preview(); }
    onTypeChange() { if (this.selectedType && !this.selectedType.allow_half_day) this.state.form.half_day = false; return this.preview(); }
    async preview() {
        const f = this.state.form; this.state.error = "";
        if (!f.leave_type_id || !f.date_from || !f.date_to) { this.state.preview = null; return; }
        try { this.state.preview = await this.orm.call("hr.leave", "preview_employee_leave_request", [Number(f.leave_type_id), f.date_from, f.date_to, f.half_day, f.period]); }
        catch (error) { this.state.preview = null; this.state.error = this.friendlyError(error, "We could not validate these dates. Please review them and try again."); }
    }
    async onFileChange(event) {
        const file = event.target.files?.[0]; if (!file) { this.state.form.attachment = null; return; }
        if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"].includes(file.type)) { this.state.error = "Only PDF, DOC, DOCX, JPG and PNG files are supported."; event.target.value = ""; return; }
        if (file.size > 10 * 1024 * 1024) { this.state.error = "The attachment must not exceed 10 MB."; event.target.value = ""; return; }
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        this.state.form.attachment = { name: file.name, mimetype: file.type, data }; this.state.error = "";
    }
    removeFile() { this.state.form.attachment = null; }
    toggleBackup(id) { const selected = this.state.form.backup_colleague_ids; this.state.form.backup_colleague_ids = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]; }
    next() { if (this.state.step === 1 && !this.detailsValid) return; if (this.state.step === 2 && !this.handoverValid) return; this.state.step = Math.min(3, this.state.step + 1); }
    back() { this.state.step = Math.max(1, this.state.step - 1); }
    async parseNlRequest() {
        if (!this.state.nlText.trim() || this.state.nlLoading) return;
        this.state.nlLoading = true;
        this.state.nlError = "";
        try {
            const res = await this.orm.call("hr.leave.ai.service", "parse_nl_leave_request", [this.state.nlText]);
            if (!res.ok) {
                this.state.nlError = res.error || "Failed to process text.";
                return;
            }
            if (res.clarification_needed) {
                this.state.nlError = res.clarification_needed;
            }
            if (res.leave_type_id) {
                this.state.form.leave_type_id = String(res.leave_type_id);
            }
            if (res.date_from) {
                this.state.form.date_from = res.date_from;
            }
            if (res.date_to) {
                this.state.form.date_to = res.date_to;
            }
            if (res.half_day) {
                this.state.form.half_day = true;
                this.state.form.period = res.period || "am";
            }
            if (res.reason) {
                this.state.form.reason = res.reason;
            }
            this.state.aiAssistedFields = res.suggested_fields || [];
            this.state.nlSummary = res.summary || "";
            this.state.showNlSummary = Boolean(res.summary);
            this.state.form.submission_channel = "ai_assisted";
            await this.preview();
        } catch (error) {
            this.state.nlError = this.friendlyError(error, "Could not process request via AI. Please fill in details manually.");
        } finally {
            this.state.nlLoading = false;
        }
    }

    clearNl() {
        this.state.nlText = "";
        this.state.nlSummary = "";
        this.state.showNlSummary = false;
        this.state.nlError = "";
        this.state.aiAssistedFields = [];
        this.state.form.submission_channel = "form";
    }

    openDateRecModal() {
        this.state.showDateRecModal = true;
    }

    closeDateRecModal() {
        this.state.showDateRecModal = false;
    }

    async onSelectRecommendedDate(item) {
        if (!item) return;
        this.state.form.date_from = item.date_from;
        this.state.form.date_to = item.date_to;
        if (item.leave_type_id) {
            this.state.form.leave_type_id = String(item.leave_type_id);
        }
        this.state.aiAssistedFields = [...new Set([...this.state.aiAssistedFields, "date_from", "date_to"])];
        this.state.form.submission_channel = "ai_assisted";
        this.state.showDateRecModal = false;
        await this.preview();
    }

    async submit() {
        if (!this.canSubmit) return; this.state.submitting = true;
        try {
            const values = {
                ...this.state.form,
                leave_type_id: Number(this.state.form.leave_type_id),
                submission_channel: this.state.aiAssistedFields.length > 0 ? "ai_assisted" : (this.state.form.submission_channel || "form"),
            };
            const existingRequestId = this.props.existingRequestId || this.props.initial?._existing_request_id;
            const result = existingRequestId ? await this.orm.call("hr.leave", "resubmit_employee_leave_request", [existingRequestId, values]) : await this.orm.call("hr.leave", "submit_employee_leave_request", [values]);
            if (!result.ok) { this.state.error = result.message || "Please review the request details and try again."; return; }
            this.notification.add(result.message, { title: result.reference, type: "success" });
            if (this.props.submitted) await this.props.submitted();
            this.props.close();
        }
        catch (error) { this.state.error = this.friendlyError(error, "We could not submit your request right now. Please try again or contact HR if the problem continues."); }
        finally { this.state.submitting = false; }
    }
}
