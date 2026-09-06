/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

export class WorkflowsApp extends Component {
    static template = "cleon_approval.WorkflowsApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.dialog = useService("dialog");

        this.state = useState({
            activeTab: "types",
            loading: false,
            approvalChains: [],
            approvalTemplates: [],
            workflowTypes: [],
            expandedChainIds: [],
            approvalRules: [],
            escalations: [],
            delegations: [],
            history: [],
        });

        onWillStart(async () => {
            await this.loadData();
        });
    }

    async loadData() {
        this.state.loading = true;
        try {
            const dbChains = await this.orm.call("cleon.approval.chain", "search_read", [], {
                fields: ["id", "name", "code", "description", "workflow_type_id", "route_type", "lifecycle_state", "active", "is_default", "step_ids", "backup_approver_ids", "escalation_days", "auto_approve_days", "applies_to", "department_ids", "employee_ids", "create_uid", "write_date"],
            });

            const dbSteps = await this.orm.call("cleon.approval.step", "search_read", [], {
                fields: ["id", "chain_id", "sequence", "name", "completion_mode", "approver_type", "approver_group_id", "specific_user_id", "approver_job_id", "sla_timeout_hours", "sla_action"],
            });

            const dbTypes = await this.orm.call("cleon.approval.workflow.type", "search_read", [], {
                fields: ["id", "name", "code", "description", "event_trigger", "module_code", "approval_requirement", "default_behavior", "default_chain_id", "rules_enabled", "escalation_enabled", "model_id", "model_name", "active"],
            });
            const dbRules = await this.orm.call("cleon.approval.rule", "search_read", [], {
                fields: ["id", "name", "workflow_type_id", "chain_id", "priority", "applies_to", "department_ids", "employee_ids", "condition_ids", "active"],
            });
            const dbEscalations = await this.orm.call("cleon.approval.escalation.rule", "search_read", [], {
                fields: ["id", "name", "workflow_type_id", "chain_id", "step_id", "response_value", "response_unit", "escalation_action", "target_group_id", "target_user_id", "active"],
            });
            const dbDelegations = await this.orm.call("cleon.approval.delegation", "search_read", [], {
                fields: ["id", "user_id", "delegate_user_id", "date_from", "date_to", "reason", "active"],
            });
            const dbHistory = await this.orm.call("cleon.approval.instance", "search_read", [], {
                fields: ["id", "workflow_type_id", "employee_id", "source_chain_id", "source_rule_id", "state", "decision_source", "create_date"], limit: 50, order: "id desc",
            });
            let dbTemplates = [];
            try {
                dbTemplates = await this.orm.call("hr.leave.approval.template", "search_read", [], {
                    fields: ["id", "name", "description", "template_type", "level_count", "policy_ids", "chain_id", "active", "write_date"],
                });
            } catch (_error) {
                // Approval templates are supplied by Leave Management and are optional for the core engine.
            }
            this.state.approvalTemplates = dbTemplates.map(t => ({
                id: t.id, name: t.name, description: t.description || "", type: t.template_type,
                levels: t.level_count, assigned: t.policy_ids.length, flow: t.chain_id?.[1] || "", active: t.active,
                lastUpdated: t.write_date || "",
            }));

            const stepsByChain = {};
            for (const step of dbSteps) {
                const chainId = step.chain_id ? step.chain_id[0] : false;
                if (chainId) {
                    if (!stepsByChain[chainId]) stepsByChain[chainId] = [];
                    let approverDesc = "Direct Manager";
                    if (step.approver_type === "group") {
                        approverDesc = step.approver_group_id ? step.approver_group_id[1] : "User Group";
                    } else if (step.approver_type === "specific_user") {
                        approverDesc = step.specific_user_id ? `Specific User: ${step.specific_user_id[1]}` : "Specific User";
                    } else if (step.approver_type === "managers_manager") {
                        approverDesc = "Manager's Manager";
                    } else if (step.approver_type === "department_head") {
                        approverDesc = "Department Head";
                    } else if (step.approver_type === "job") {
                        approverDesc = step.approver_job_id ? `Position: ${step.approver_job_id[1]}` : "Position / Job";
                    }
                    stepsByChain[chainId].push({
                        id: step.id,
                        sequence: step.sequence,
                        name: step.name || approverDesc,
                        approverTypeLabel: approverDesc,
                        completionMode: step.completion_mode,
                        slaTimeoutHours: step.sla_timeout_hours,
                        slaAction: step.sla_action,
                    });
                }
            }

            this.state.approvalChains = dbChains.map(c => {
                const chainSteps = (stepsByChain[c.id] || []).sort((a, b) => a.sequence - b.sequence);
                return {
                    id: c.id,
                    name: c.name,
                    code: c.code || "—",
                    description: c.description || "",
                    module: c.workflow_type_id ? c.workflow_type_id[1] : "General Workflow",
                    levels: chainSteps.length,
                    active: c.active,
                    routeType: c.route_type,
                    lifecycleState: c.lifecycle_state,
                    steps: chainSteps,
                    backups: c.backup_approver_ids?.length || 0,
                    escalationDays: c.escalation_days || 0,
                    autoApproveDays: c.auto_approve_days || 0,
                    appliesTo: c.applies_to,
                    coverage: c.applies_to === "departments" ? c.department_ids.length : c.applies_to === "employees" ? c.employee_ids.length : "All",
                    createdBy: c.create_uid?.[1] || "",
                    lastUpdated: c.write_date || "",
                };
            });

            const eventLabels = {leave_request: "Leave Request", leave_extension: "Leave Extension", leave_cancellation: "Leave Cancellation", early_return: "Early Return", normal_return: "Normal Return", late_return: "Late / Unconfirmed Return", balance_amendment: "Leave Balance Amendment", negative_balance: "Negative Balance Exception", blackout_exception: "Blackout Period Exception", coverage_exception: "Coverage / Handover Exception", handover_requirement: "Handover Requirement", approval_override: "Approval Override"};
            const behaviourLabels = {approval_route: "Approval Route", linked: "Linked Approval", exception: "Exception Review", automatic: "Automatic", override: "Override Workflow"};
            const approvalLabels = {yes: "Yes", no: "No — Automatic", conditional: "Conditional"};
            this.state.workflowTypes = dbTypes.map(t => ({
                id: t.id,
                name: t.name,
                code: t.code,
                module: t.module_code === "leave" ? "Leave Management" : (t.model_name || "Odoo Model"),
                description: t.description || `Registered workflow type for ${t.name} (${t.code})`,
                eventTrigger: eventLabels[t.event_trigger] || t.event_trigger,
                defaultBehavior: behaviourLabels[t.default_behavior] || t.default_behavior,
                defaultRoute: t.default_chain_id?.[1] || "—",
                requiresApproval: approvalLabels[t.approval_requirement] || t.approval_requirement,
                status: t.active ? "Enabled" : "Disabled",
            }));
            this.state.approvalRules = dbRules.map(rule => ({id: rule.id, name: rule.name, workflow: rule.workflow_type_id?.[1] || "", route: rule.chain_id?.[1] || "", priority: rule.priority, appliesTo: rule.applies_to, conditions: rule.condition_ids.length, active: rule.active}));
            this.state.escalations = dbEscalations.map(rule => ({id: rule.id, name: rule.name, workflow: rule.workflow_type_id?.[1] || "", route: rule.chain_id?.[1] || "", level: rule.step_id?.[1] || "", escalateAfter: `${rule.response_value} ${rule.response_unit}`, slaAction: rule.escalation_action, target: rule.target_group_id?.[1] || rule.target_user_id?.[1] || "Next level", status: rule.active ? "Enabled" : "Disabled"}));
            this.state.delegations = dbDelegations.map(item => ({id: item.id, approver: item.user_id?.[1] || "", delegate: item.delegate_user_id?.[1] || "", dateFrom: item.date_from, dateTo: item.date_to, reason: item.reason || "", active: item.active}));
            this.state.history = dbHistory.map(item => ({id: item.id, workflow: item.workflow_type_id?.[1] || "", employee: item.employee_id?.[1] || "", route: item.source_chain_id?.[1] || "Fallback", rule: item.source_rule_id?.[1] || "Default", state: item.state, source: item.decision_source, started: item.create_date}));

        } catch (e) {
            console.warn("Failed to load approval data", e);
        } finally {
            this.state.loading = false;
        }
    }

    setTab(tab) {
        this.state.activeTab = tab;
    }

    toggleExpandChain(chainId) {
        if (this.state.expandedChainIds.includes(chainId)) {
            this.state.expandedChainIds = this.state.expandedChainIds.filter(id => id !== chainId);
        } else {
            this.state.expandedChainIds.push(chainId);
        }
    }

    addApprovalChain() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "New Approval Chain",
            res_model: "cleon.approval.chain",
            views: [[false, "form"]],
            target: "new",
        }, {
            onClose: () => this.loadData(),
        });
    }

    addApprovalTemplate() {
        this.action.doAction({type: "ir.actions.act_window", name: "Create Approval Template", res_model: "hr.leave.approval.template", views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()});
    }

    editApprovalTemplate(templateId) {
        this.action.doAction({type: "ir.actions.act_window", name: "Edit Approval Template", res_model: "hr.leave.approval.template", res_id: templateId, views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()});
    }

    async duplicateApprovalTemplate(templateId) {
        const duplicateId = await this.orm.call("hr.leave.approval.template", "action_duplicate_template", [[templateId]]);
        this.notification.add("Approval template duplicated as inactive.", {type: "success"});
        await this.loadData();
        if (duplicateId) this.editApprovalTemplate(duplicateId);
    }

    editApprovalChain(chainId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Edit Approval Chain",
            res_model: "cleon.approval.chain",
            res_id: chainId,
            views: [[false, "form"]],
            target: "new",
        }, {
            onClose: () => this.loadData(),
        });
    }

    addWorkflowType() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "New Workflow Type",
            res_model: "cleon.approval.workflow.type",
            views: [[false, "form"]],
            target: "new",
        }, {
            onClose: () => this.loadData(),
        });
    }

    editWorkflowType(typeId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Edit Workflow Type",
            res_model: "cleon.approval.workflow.type",
            res_id: typeId,
            views: [[false, "form"]],
            target: "new",
        }, {
            onClose: () => this.loadData(),
        });
    }

    addApprovalRule() {
        this.action.doAction({type: "ir.actions.act_window", name: "Create Approval Rule", res_model: "cleon.approval.rule", views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()});
    }

    editApprovalRule(ruleId) { this.action.doAction({type: "ir.actions.act_window", name: "Edit Approval Rule", res_model: "cleon.approval.rule", res_id: ruleId, views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()}); }

    addEscalationRule() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Add Escalation Rule",
            res_model: "cleon.approval.escalation.rule",
            views: [[false, "form"]],
            target: "new",
        }, {
            onClose: () => this.loadData(),
        });
    }

    editEscalationRule(ruleId) { this.action.doAction({type: "ir.actions.act_window", name: "Edit Escalation Rule", res_model: "cleon.approval.escalation.rule", res_id: ruleId, views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()}); }
    addDelegation() { this.action.doAction({type: "ir.actions.act_window", name: "Add Approval Delegation", res_model: "cleon.approval.delegation", views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()}); }
    editDelegation(id) { this.action.doAction({type: "ir.actions.act_window", name: "Edit Approval Delegation", res_model: "cleon.approval.delegation", res_id: id, views: [[false, "form"]], target: "new"}, {onClose: () => this.loadData()}); }
    openHistory(id) { this.action.doAction({type: "ir.actions.act_window", name: "Approval History", res_model: "cleon.approval.instance", res_id: id, views: [[false, "form"]], target: "new"}); }

    async toggleApprovalChain(chainId) {
        const chain = this.state.approvalChains.find(c => c.id === chainId);
        if (chain) {
            const nextActive = !chain.active;
            try {
                await this.orm.write("cleon.approval.chain", [chainId], { active: nextActive });
                this.notification.add(`Approval Chain '${chain.name}' ${nextActive ? 'activated' : 'deactivated'}.`, { type: "success" });
            } catch (error) {
                this.notification.add(error?.data?.message || "Failed to update chain status.", { type: "danger" });
            }
            await this.loadData();
        }
    }

    async duplicateApprovalChain(chainId) {
        const duplicateId = await this.orm.call("cleon.approval.chain", "action_duplicate_leave_workflow", [[chainId]]);
        this.notification.add("Approval workflow duplicated as inactive.", { type: "success" });
        await this.loadData();
        if (duplicateId) this.editApprovalChain(duplicateId);
    }

    deleteApprovalChain(chainId) {
        const chain = this.state.approvalChains.find(c => c.id === chainId);
        if (!chain) return;
        this.dialog.add(ConfirmationDialog, {
            body: `Are you sure you want to delete approval chain '${chain.name}'? This will permanently delete all configured approval steps for this chain.`,
            confirm: async () => {
                try {
                    await this.orm.unlink("cleon.approval.chain", [chainId]);
                    this.notification.add(`Approval Chain '${chain.name}' deleted successfully.`, { type: "info" });
                } catch (error) {
                    this.notification.add(error?.data?.message || "Cannot delete active approval chain.", { type: "danger" });
                }
                await this.loadData();
            },
            cancel: () => {},
        });
    }

    deleteWorkflowType(typeId) {
        const typeRecord = this.state.workflowTypes.find(t => t.id === typeId);
        if (!typeRecord) return;
        this.dialog.add(ConfirmationDialog, {
            body: `Are you sure you want to delete workflow type '${typeRecord.name}'? Note: Standard module workflow types registered by installed apps cannot be unlinked if referenced.`,
            confirm: async () => {
                try {
                    await this.orm.unlink("cleon.approval.workflow.type", [typeId]);
                    this.notification.add(`Workflow Type '${typeRecord.name}' deleted successfully.`, { type: "info" });
                } catch (error) {
                    this.notification.add(error?.data?.message || "Cannot delete workflow type referenced by active chains or modules.", { type: "danger" });
                }
                await this.loadData();
            },
            cancel: () => {},
        });
    }
}

registry.category("actions").add("cleon_approval.WorkflowsApp", WorkflowsApp);
