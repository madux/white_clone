/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class CalendarDayPanel extends Component {
    static template = "hr_leave_dashboard.CalendarDayPanel";
    static props = {
        dateFrom: String,
        dateTo: String,
        leaves: Array,
        holidays: Array,
        canRequest: Boolean,
        openRequest: Function,
        openDetail: Function,
        close: Function,
    };

    setup() {
        this.state = useState({
            activeRosterStatus: this.props.leaves[0]?.status || "",
        });
    }

    get periodLabel() {
        if (this.props.dateFrom === this.props.dateTo) return this.formatDate(this.props.dateFrom);
        return `${this.formatDate(this.props.dateFrom)} – ${this.formatDate(this.props.dateTo)}`;
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
                const a = order.indexOf(left);
                const b = order.indexOf(right);
                return (a < 0 ? order.length : a) - (b < 0 ? order.length : b);
            })
            .map(([status, leaves]) => ({
                status,
                label: labels[status] || status.replaceAll("_", " "),
                leaves,
            }));
    }

    get activeRosterLeaves() {
        const group = this.rosterGroups.find(item => item.status === this.state.activeRosterStatus);
        return group ? group.leaves : [];
    }

    openRosterDetail(leave) {
        if (!leave.can_open_detail) return;
        // Remove the roster overlay before mounting the shared request-detail
        // modal. Otherwise the roster remains above the new modal and makes a
        // successful row click look as though nothing happened.
        this.props.close();
        this.props.openDetail(leave.id);
    }

    requestLeave() {
        this.props.openRequest(this.props.dateFrom, this.props.dateTo);
    }

    formatDate(value) {
        return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "short", day: "numeric", month: "short", year: "numeric",
        });
    }
}
