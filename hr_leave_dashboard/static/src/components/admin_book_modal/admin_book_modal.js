/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * Admin Book Time Off modal — reusable component for booking leave on behalf
 * of any employee.  Used from the Organisation calendar and the Day Roster.
 *
 * Backend RPCs used (all already exist on hr.leave):
 *   - get_admin_create_options
 *   - get_admin_leave_types_for_employee
 *   - preview_admin_leave_request
 *   - create_admin_leave_request
 */
export class AdminBookTimeOffModal extends Component {
    static template = "hr_leave_dashboard.AdminBookTimeOffModal";
    static props = {
        close: Function,
        submitted: { type: Function, optional: true },
        initialDateFrom: { type: String, optional: true },
        initialDateTo: { type: String, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            loading: true,
            submitting: false,

            // Employee picker
            employees: [],
            employeeSearch: "",
            employeeDropdownOpen: false,
            selectedEmployee: null,

            // Leave form
            leaveTypes: [],
            form: {
                employee_id: "",
                leave_type_id: "",
                date_from: this.props.initialDateFrom || "",
                date_to: this.props.initialDateTo || "",
                admin_note: "",
                half_day: false,
                period: "am",
            },
            preview: null,
            showOverlapWarning: false,
            overrideConflict: false,
            error: "",
        });

        onWillStart(async () => {
            try {
                const opts = await this.orm.call("hr.leave", "get_admin_create_options", []);
                this.state.employees = opts.employees || [];
            } catch (e) {
                this.state.error = "Could not load employee list.";
            }
            this.state.loading = false;
        });
    }

    // ── Employee picker ──────────────────────────────────────────────

    get filteredEmployees() {
        const term = (this.state.employeeSearch || "").trim().toLowerCase();
        if (!term) return this.state.employees;
        return this.state.employees.filter((emp) => {
            const text = [emp.name, emp.department, emp.job_title].filter(Boolean).join(" ").toLowerCase();
            return text.includes(term);
        });
    }

    openEmployeeDropdown() { this.state.employeeDropdownOpen = true; }

    onEmployeeSearchInput(ev) {
        this.state.employeeSearch = ev.target.value;
        this.state.employeeDropdownOpen = true;
    }

    async selectEmployee(employee) {
        this.state.selectedEmployee = employee;
        this.state.form.employee_id = employee.id;
        this.state.employeeSearch = employee.name;
        this.state.employeeDropdownOpen = false;
        this.state.form.leave_type_id = "";
        this.state.leaveTypes = [];
        this.state.preview = null;
        this.state.error = "";
        try {
            const types = await this.orm.call("hr.leave", "get_admin_leave_types_for_employee", [], { employee_id: employee.id });
            this.state.leaveTypes = types || [];
        } catch (e) {
            this.state.error = "Could not load leave types for this employee.";
        }
    }

    clearEmployee() {
        this.state.selectedEmployee = null;
        this.state.form.employee_id = "";
        this.state.employeeSearch = "";
        this.state.employeeDropdownOpen = false;
        this.state.form.leave_type_id = "";
        this.state.leaveTypes = [];
        this.state.preview = null;
        this.state.error = "";
    }

    // ── Form logic ───────────────────────────────────────────────────

    onStartChange() {
        if (!this.state.form.date_to || this.state.form.date_to < this.state.form.date_from) {
            this.state.form.date_to = this.state.form.date_from;
        }
        return this.previewRequest();
    }

    async previewRequest() {
        const f = this.state.form;
        this.state.error = "";
        if (f.employee_id && f.leave_type_id && f.date_from && f.date_to) {
            try {
                const preview = await this.orm.call("hr.leave", "preview_admin_leave_request", [], {
                    employee_id: f.employee_id,
                    leave_type_id: f.leave_type_id,
                    date_from: f.date_from,
                    date_to: f.date_to,
                    half_day: f.half_day,
                    period: f.period,
                });
                this.state.preview = preview;
                this.state.showOverlapWarning = preview.conflicts && preview.conflicts.length > 0;
            } catch (e) {
                this.state.preview = null;
                this.state.error = e?.data?.message || "Could not validate these dates.";
            }
        } else {
            this.state.preview = null;
        }
    }

    get selectedLeaveTypeInfo() {
        const typeId = Number(this.state.form.leave_type_id);
        if (!typeId) return null;
        return this.state.leaveTypes.find((lt) => lt.id === typeId) || null;
    }

    get isFormValid() {
        const f = this.state.form;
        return (
            Boolean(f.employee_id) &&
            Boolean(f.leave_type_id) &&
            Boolean(f.date_from) &&
            Boolean(f.date_to) &&
            Boolean(f.admin_note && f.admin_note.trim().length >= 10)
        );
    }

    get today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // ── Submit ───────────────────────────────────────────────────────

    async submit() {
        const f = this.state.form;
        if (!this.isFormValid || this.state.submitting) return;
        this.state.submitting = true;
        this.state.error = "";
        try {
            const res = await this.orm.call("hr.leave", "create_admin_leave_request", [], {
                employee_id: f.employee_id,
                leave_type_id: f.leave_type_id,
                date_from: f.date_from,
                date_to: f.date_to,
                admin_note: f.admin_note.trim(),
                half_day: f.half_day,
                period: f.period,
                override_conflict: this.state.overrideConflict,
            });
            if (res.conflict && !res.created) {
                this.state.showOverlapWarning = true;
                this.state.error = "Overlapping leave request detected. Check the override box to proceed.";
                return;
            }
            if (res.created) {
                this.notification.add("Leave request created successfully on behalf of employee.", { type: "success" });
                if (this.props.submitted) await this.props.submitted();
                this.props.close();
            }
        } catch (e) {
            this.state.error = e?.data?.message || "Could not submit this request. Please try again.";
        } finally {
            this.state.submitting = false;
        }
    }
}
