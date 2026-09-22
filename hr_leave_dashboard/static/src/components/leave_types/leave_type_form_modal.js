/** @odoo-module **/

import { Component, useRef, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * LeaveTypeFormModal — identity-only form for Leave Type records.
 *
 * A Leave Type is just a label: Name, Code, Description, Colour, and
 * broad classification (Category). All business rules — entitlement,
 * accrual period, approval workflow, carry-forward, eligibility
 * conditions — live on the Leave Policy that references this type.
 */
export class LeaveTypeFormModal extends Component {
    static template = "hr_leave_dashboard.LeaveTypeFormModal";
    static props = {
        mode: String,                              // "create" | "edit"
        leaveTypeData: { type: Object, optional: true },
        departments: Array,
        units: Array,
        grades: Array,
        employees: Array,
        employmentTypes: Array,
        locations: Array,
        close: Function,
        onSaved: Function,
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.modalBodyRef = useRef("modalBody");

        this.state = useState({
            form: this._buildForm(this.props.leaveTypeData),
            errors: {},
            saving: false,
        });

        this.initialSnapshot = JSON.stringify(this._serialize(this.state.form));
    }

    // ── Form initialisation ────────────────────────────────────────────────

    _buildForm(data = null) {
        if (!data) {
            return {
                id: null,
                name: "",
                code: "",
                description: "",
                colorHex: "#3B82F6",
                category: "paid",
                visibleToEmployees: true,
                active: true,
                assignedEmployeeCount: 0,
                activeRequestCount: 0,
            };
        }
        return {
            id: data.id || null,
            name: data.name || "",
            code: data.code || "",
            description: data.description || "",
            colorHex: data.color_hex || "#3B82F6",
            category: data.category || "paid",
            visibleToEmployees: data.visible_to_employees !== undefined
                ? Boolean(data.visible_to_employees)
                : true,
            active: data.active !== undefined ? Boolean(data.active) : true,
            assignedEmployeeCount: data.assigned_count || 0,
            activeRequestCount: data.active_request_count || 0,
        };
    }

    _serialize(f) {
        return {
            name: f.name,
            code: f.code,
            description: f.description,
            colorHex: f.colorHex,
            category: f.category,
            visibleToEmployees: f.visibleToEmployees,
            active: f.active,
        };
    }

    get isDirty() {
        return JSON.stringify(this._serialize(this.state.form)) !== this.initialSnapshot;
    }

    // ── Colour presets ─────────────────────────────────────────────────────

    get presetSwatches() {
        return [
            "#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#F59E0B", "#06B6D4", "#EC4899", "#84CC16",
            "#2563EB", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2", "#DB2777", "#65A30D",
        ];
    }

    selectPresetColor(hex) {
        this.state.form.colorHex = hex;
    }

    // ── Validation ─────────────────────────────────────────────────────────

    get validationMessages() {
        return Object.values(this.state.errors).filter(Boolean);
    }

    _validate() {
        const errors = {};
        const f = this.state.form;

        if (!f.name || !f.name.trim()) {
            errors.name = "Leave type name is required.";
        }
        if (!f.code || !f.code.trim()) {
            f.code = (f.name || "LT").trim().substring(0, 4).toUpperCase();
        }
        if ((f.code || "").trim().length > 4) {
            errors.code = "Code must be 4 characters or fewer.";
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test((f.colorHex || "").trim())) {
            errors.colorHex = "Enter a valid hex colour, e.g. #3B82F6.";
        }

        this.state.errors = errors;
        return Object.keys(errors).length === 0;
    }

    // ── Save ───────────────────────────────────────────────────────────────

    async saveForm(addAnother = false) {
        if (!this._validate()) {
            this.modalBodyRef.el?.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        this.state.saving = true;
        try {
            const f = this.state.form;
            await this.orm.call("hr.leave.type", "save_leave_type_configuration", [f]);

            this.notification.add(
                f.id
                    ? `Leave type '${f.name}' updated.`
                    : `Leave type '${f.name}' created.`,
                { type: "success" }
            );

            await this.props.onSaved();

            if (addAnother) {
                this.state.form = this._buildForm(null);
                this.state.errors = {};
                this.initialSnapshot = JSON.stringify(this._serialize(this.state.form));
            } else {
                this.props.close();
            }
        } catch (err) {
            console.error("Failed to save leave type", err);
            this.notification.add(err.message || "Failed to save leave type.", { type: "danger" });
        } finally {
            this.state.saving = false;
        }
    }

    // ── Close ──────────────────────────────────────────────────────────────

    handleCancel() {
        if (this.isDirty) {
            if (confirm("You have unsaved changes. Discard them?")) {
                this.props.close();
            }
        } else {
            this.props.close();
        }
    }
}
