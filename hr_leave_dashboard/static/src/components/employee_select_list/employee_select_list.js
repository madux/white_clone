/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

/** Shared employee audience picker for leave operations. */
export class EmployeeSelectList extends Component {
    static template = "hr_leave_dashboard.EmployeeSelectList";
    static props = {
        employees: Array,
        selectedIds: Array,
        onToggle: Function,
        onSelectMany: Function,
        emptyMessage: { type: String, optional: true },
    };

    setup() { this.state = useState({ search: "" }); }
    get visibleEmployees() {
        const query = this.state.search.trim().toLowerCase();
        return query ? this.props.employees.filter(employee =>
            [employee.name, employee.code, employee.department].join(" ").toLowerCase().includes(query)
        ) : this.props.employees;
    }
    get allVisibleSelected() {
        return this.visibleEmployees.length > 0 && this.visibleEmployees.every(employee => this.props.selectedIds.includes(employee.id));
    }
    toggleVisible() {
        this.props.onSelectMany(this.visibleEmployees.map(employee => employee.id), !this.allVisibleSelected);
    }
    selectAll() { this.props.onSelectMany(this.visibleEmployees.map(employee => employee.id), true); }
    deselectAll() { this.props.onSelectMany(this.visibleEmployees.map(employee => employee.id), false); }
}
