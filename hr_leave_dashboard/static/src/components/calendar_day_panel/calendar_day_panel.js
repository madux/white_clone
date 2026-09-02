/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CalendarDayPanel extends Component {
    static template = "hr_leave_dashboard.CalendarDayPanel";
    static props = {
        dateFrom: String,
        dateTo: String,
        leaves: Array,
        holidays: Array,
        canBook: Boolean,
        startOnBook: Boolean,
        canRequest: Boolean,
        openRequest: Function,
        openDetail: Function,
        close: Function,
        submitted: { type: Function, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({
            loading: this.props.canBook,
            tab: this.props.startOnBook || this.props.dateFrom !== this.props.dateTo ? "book" : "roster",
            activeRosterStatus: this.props.leaves[0]?.status || "",
            employees: [], leaveTypes: [], selectedEmployee: null,
            preview: null, submitting: false, error: "",
            form: {
                employee_id: "", leave_type_id: "",
                date_from: this.props.dateFrom, date_to: this.props.dateTo,
                reason: "", note: "", attachment: null, half_day: false, period: "am",
            },
        });
        onWillStart(async () => {
            if (!this.props.canBook) return;
            try {
                const data = await this.orm.call("hr.leave", "get_admin_create_options", []);
                this.state.employees = data.employees || [];
                const current = this.state.employees.find(employee => employee.is_current_user);
                if (current) await this.selectEmployee(current.id);
            } catch (error) {
                this.state.error = error?.data?.message || error.message || "Unable to load booking options.";
            } finally {
                this.state.loading = false;
            }
        });
    }

    get periodLabel() {
        if (this.props.dateFrom === this.props.dateTo) return this.formatDate(this.props.dateFrom);
        return `${this.formatDate(this.props.dateFrom)} – ${this.formatDate(this.props.dateTo)}`;
    }
    get canSubmit() {
        const f = this.state.form;
        return !this.state.submitting && f.employee_id && f.leave_type_id && f.date_from
            && f.date_to && f.reason.trim().length >= 10 && this.state.preview;
    }
    get rosterGroups() {
        const labels = {
            approved: "Approved", pending: "Pending Approval", cancelled: "Cancelled",
            rejected: "Rejected", draft: "Draft", active: "Active",
            extension_pending: "Extension Pending", return_overdue: "Return Overdue",
        };
        const order = ["active", "approved", "pending", "extension_pending", "return_overdue", "draft", "rejected", "cancelled"];
        const grouped = new Map();
        for (const leave of this.props.leaves) {
            const key = leave.status || "pending";
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(leave);
        }
        return [...grouped.entries()]
            .sort(([left], [right]) => {
                const a = order.indexOf(left); const b = order.indexOf(right);
                return (a < 0 ? order.length : a) - (b < 0 ? order.length : b);
            })
            .map(([status, leaves]) => ({ status, label: labels[status] || status.replaceAll("_", " "), leaves }));
    }
    get activeRosterLeaves() {
        const group = this.rosterGroups.find(item => item.status === this.state.activeRosterStatus);
        return group ? group.leaves : [];
    }
    openRosterDetail(leave) {
        if (leave.can_open_detail) this.props.openDetail(leave.id);
    }
    formatDate(value) {
        return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "short", day: "numeric", month: "short", year: "numeric",
        });
    }
    async selectEmployee(value) {
        const employeeId = Number(value);
        this.state.form.employee_id = employeeId || "";
        this.state.selectedEmployee = this.state.employees.find(employee => employee.id === employeeId) || null;
        this.state.form.leave_type_id = "";
        this.state.leaveTypes = employeeId
            ? await this.orm.call("hr.leave", "get_admin_leave_types_for_employee", [], { employee_id: employeeId })
            : [];
        this.state.preview = null;
    }
    async preview() {
        const f = this.state.form;
        this.state.error = "";
        if (!f.employee_id || !f.leave_type_id || !f.date_from || !f.date_to) {
            this.state.preview = null;
            return;
        }
        if (f.date_to < f.date_from) f.date_to = f.date_from;
        try {
            this.state.preview = await this.orm.call("hr.leave", "preview_admin_leave_request", [], {
                employee_id: f.employee_id,
                leave_type_id: Number(f.leave_type_id),
                date_from: f.date_from,
                date_to: f.date_to,
                half_day: f.half_day,
                period: f.period,
            });
        } catch (error) {
            this.state.preview = null;
            this.state.error = error?.data?.message || error.message || "Unable to validate this booking.";
        }
    }
    async onFileChange(event) {
        const file = event.target.files?.[0];
        if (!file) { this.state.form.attachment = null; return; }
        const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];
        if (!allowed.includes(file.type)) {
            this.state.error = "Only PDF, DOC, DOCX, JPG and PNG files are supported.";
            event.target.value = "";
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.state.error = "The attachment must not exceed 10 MB.";
            event.target.value = "";
            return;
        }
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        this.state.form.attachment = { name: file.name, mimetype: file.type, data };
        this.state.error = "";
    }
    async submit() {
        if (!this.canSubmit) return;
        this.state.submitting = true;
        this.state.error = "";
        const f = this.state.form;
        try {
            const result = await this.orm.call("hr.leave", "create_admin_leave_request", [], {
                employee_id: f.employee_id,
                leave_type_id: Number(f.leave_type_id),
                date_from: f.date_from,
                date_to: f.date_to,
                admin_note: f.reason.trim(),
                half_day: f.half_day,
                period: f.period,
                override_conflict: false,
                note: f.note.trim(),
                attachment: f.attachment,
            });
            if (result.conflict) {
                this.state.error = "This employee already has leave overlapping the selected dates.";
                return;
            }
            if (!result.created) {
                this.state.error = result.message || "The booking could not be created.";
                return;
            }
            this.notification.add(result.message || (result.approved
                ? "Time off was booked and approved."
                : "The booking was sent through its approval workflow."), { type: "success" });
            if (this.props.submitted) await this.props.submitted();
            this.props.close();
        } catch (error) {
            this.state.error = error?.data?.message || error.message || "The booking could not be submitted.";
        } finally {
            this.state.submitting = false;
        }
    }
}
