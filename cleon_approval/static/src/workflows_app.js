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
            activeTab: "chains",
            loading: false,
            approvalChains: [],
            workflowTypes: [],
            expandedChainIds: [],
            approvalRules: [],
            escalations: [],
        });

        onWillStart(async () => {
            await this.loadData();
        });
    }

    async loadData() {
        this.state.loading = true;
        try {
            const dbChains = await this.orm.call("cleon.approval.chain", "search_read", [], {
                fields: ["id", "name", "workflow_type_id", "active", "is_default", "step_ids"],
            });

            const dbSteps = await this.orm.call("cleon.approval.step", "search_read", [], {
                fields: ["id", "chain_id", "sequence", "name", "approver_type", "approver_group_id", "specific_user_id", "sla_timeout_hours", "sla_action"],
            });

            const dbTypes = await this.orm.call("cleon.approval.workflow.type", "search_read", [], {
                fields: ["id", "name", "code", "model_id", "model_name", "active"],
            });

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
                    }
                    stepsByChain[chainId].push({
                        id: step.id,
                        sequence: step.sequence,
                        name: step.name || approverDesc,
                        approverTypeLabel: approverDesc,
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
                    module: c.workflow_type_id ? c.workflow_type_id[1] : "General Workflow",
                    levels: chainSteps.length,
                    active: c.active,
                    steps: chainSteps,
                };
            });

            this.state.workflowTypes = dbTypes.map(t => ({
                id: t.id,
                name: t.name,
                code: t.code,
                module: t.model_name || "Odoo Model",
                description: `Registered workflow type for ${t.name} (${t.code})`,
                requiresApproval: true,
                status: t.active ? "Enabled" : "Disabled",
            }));

            // Derive Escalations from actual chain steps with configured SLA timeouts
            const derivedEscalations = [];
            for (const chain of this.state.approvalChains) {
                for (let idx = 0; idx < chain.steps.length; idx++) {
                    const step = chain.steps[idx];
                    if (step.slaTimeoutHours > 0) {
                        const actionLabel = step.slaAction === "escalate_next" ? "Escalate to Next Step" : step.slaAction === "auto_approve" ? "Auto-Approve" : "Auto-Reject";
                        derivedEscalations.push({
                            id: `${chain.id}_${step.id}`,
                            workflow: chain.name,
                            level: `Step ${idx + 1}: ${step.name}`,
                            escalateAfter: `${step.slaTimeoutHours} hours`,
                            escalateTo: step.approverTypeLabel,
                            slaAction: actionLabel,
                            notifyOriginal: true,
                            status: chain.active ? "Enabled" : "Disabled",
                        });
                    }
                }
            }
            this.state.escalations = derivedEscalations;

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
        this.notification.add("Custom conditional approval rules are not yet configured in this release.", { type: "info" });
    }

    addEscalationRule() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Configure Approval Chain Escalation Steps",
            res_model: "cleon.approval.chain",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        }, {
            onClose: () => this.loadData(),
        });
    }

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
