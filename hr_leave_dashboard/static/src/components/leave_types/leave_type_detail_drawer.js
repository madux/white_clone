/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class LeaveTypeDetailDrawer extends Component {
    static template = "hr_leave_dashboard.LeaveTypeDetailDrawer";
    static props = {
        leaveType: Object,
        initialTab: { type: String, optional: true },
        close: Function,
        onEdit: Function,
        onDuplicate: Function,
        onToggleActive: Function,
    };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            activeTab: this.props.initialTab || "overview",
            activityLogs: [],
            loadingLogs: false,
            leaveTypeEmployees: [],
            loadingEmployees: false,
            policies: [],
            loadingPolicies: false,
        });

        onWillStart(() => {
            if (this.state.activeTab === "activity") {
                this.loadActivityLogs();
            } else if (this.state.activeTab === "employees") {
                this.loadEmployeesData();
            } else if (this.state.activeTab === "policies") {
                this.loadPoliciesData();
            }
        });
    }

    async setActiveTab(tab) {
        this.state.activeTab = tab;
        if (tab === "activity" && this.state.activityLogs.length === 0) {
            await this.loadActivityLogs();
        } else if (tab === "employees" && this.state.leaveTypeEmployees.length === 0) {
            await this.loadEmployeesData();
        } else if (tab === "policies" && this.state.policies.length === 0) {
            await this.loadPoliciesData();
        }
    }

    async loadPoliciesData() {
        this.state.loadingPolicies = true;
        try {
            const policies = await this.orm.call("hr.leave.type", "get_leave_type_policies_data", [this.props.leaveType.id]);
            this.state.policies = policies || [];
        } catch (err) {
            console.error("Failed to load governing policies data", err);
            this.state.policies = [];
        } finally {
            this.state.loadingPolicies = false;
        }
    }

    async loadEmployeesData() {
        this.state.loadingEmployees = true;
        try {
            const emps = await this.orm.call("hr.leave.type", "get_leave_type_employee_data", [this.props.leaveType.id]);
            this.state.leaveTypeEmployees = emps || [];
        } catch (err) {
            console.error("Failed to load eligible employees data", err);
            this.state.leaveTypeEmployees = [];
        } finally {
            this.state.loadingEmployees = false;
        }
    }

    async loadActivityLogs() {
        this.state.loadingLogs = true;
        try {
            const logs = await this.orm.searchRead(
                "hr.leave.audit.log",
                [
                    ["action", "=", "policy_change"],
                    ["leave_type_id", "=", this.props.leaveType.id],
                ],
                ["id", "note", "occurred_at", "actor_label", "actor_role"],
                { limit: 20, order: "occurred_at desc" }
            );

            this.state.activityLogs = (logs || []).map(l => ({
                id: l.id,
                details: l.note || "Policy Configuration Changed",
                date: l.occurred_at ? l.occurred_at.substring(0, 16) : "",
                user: l.actor_label || "Administrator",
                role: l.actor_role || "HR Officer",
            }));
        } catch (err) {
            console.error("Failed to load audit logs", err);
            this.state.activityLogs = [];
        } finally {
            this.state.loadingLogs = false;
        }
    }
}
