/** @odoo-module **/

import { Component, useEffect, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export const LEAVE_SETUP_STEPS = [
    {
        number: 1,
        checklistKey: "check_leave_type",
        cardClass: "purple",
        cardDescription: "Create leave categories and configure their entitlement and accrual rules.",
        cardActionLabel: "Set Up",
        title: "Configure Leave Types",
        icon: "fa-tags",
        iconClass: "",
        description: "Define every leave category your organisation offers. Configure entitlements, carry-forward rules, accrual methods, and the approval behaviour for each type before allocating balances.",
        actions: [
            ["Create leave types", "such as Annual, Sick, Maternity/Paternity, Compassionate, and any custom policies."],
            ["Set entitlements", "and decide whether unused days can be carried forward."],
            ["Choose an accrual method", "such as monthly, pro-rated, or full allocation at year start."],
        ],
        actionLabel: "Go to Leave Types",
        actionId: "hr_leave_dashboard.action_hr_leave_types_custom",
    },
    {
        number: 2,
        checklistKey: "check_approval_workflow",
        cardClass: "amber",
        cardDescription: "Choose who approves requests and how multi-level approvals should work.",
        cardActionLabel: "Configure",
        title: "Set Up Approval Workflows",
        icon: "fa-shield",
        iconClass: "cleon-wiz-icon-blue",
        description: "Control how leave requests are reviewed and authorised. Choose the approval path before employees begin submitting requests.",
        actions: [
            ["Choose single-level approval", "when one manager can authorise a request."],
            ["Configure multi-level approval", "for policies that require Manager, HR, or Director review."],
            ["Review escalation rules", "so requests do not remain unattended."],
        ],
        actionLabel: "Go to Settings",
        actionId: "hr_holidays.action_hr_holidays_configuration",
    },
    {
        number: 3,
        checklistKey: "check_allocate_balance",
        cardClass: "green",
        cardDescription: "Assign leave-day allocations by employee, department, or employee group.",
        cardActionLabel: "Manage",
        title: "Manage Leave Balances",
        icon: "fa-balance-scale",
        iconClass: "cleon-wiz-icon-teal",
        description: "Allocate balances only after leave types exist. Assign entitlements individually or in bulk and retain an auditable history of adjustments.",
        actions: [
            ["Use bulk allocation", "to assign balances to a department or employee group."],
            ["Apply individual adjustments", "when an employee needs a specific top-up or deduction."],
            ["Review balance history", "before employees begin requesting leave."],
        ],
        actionLabel: "Go to Balance Management",
        actionId: "hr_leave_dashboard.action_hr_leave_balances_custom",
    },
    {
        number: 4,
        checklistKey: "check_set_country",
        cardClass: "blue",
        cardDescription: "Configure regional holidays and working calendars used in leave calculations.",
        cardActionLabel: "Configure",
        title: "Configure Calendar & Holidays",
        icon: "fa-calendar",
        iconClass: "cleon-wiz-icon-orange",
        description: "Configure regional public holidays and working calendars so non-working days are excluded correctly and team coverage is visible.",
        actions: [
            ["Choose the country and region", "used for public holidays and working-day rules."],
            ["Review working calendars", "for the locations and employee groups you support."],
            ["Check team coverage", "in the leave calendar before opening requests to employees."],
        ],
        actionLabel: "Go to Settings",
        actionId: "hr_holidays.action_hr_holidays_configuration",
    },
    {
        number: 5,
        checklistKey: "check_review_request",
        cardClass: "pink",
        cardDescription: "Review and process employee requests after configuration is complete.",
        cardActionLabel: "Review",
        title: "Process Leave Requests",
        icon: "fa-file-text-o",
        iconClass: "cleon-wiz-icon-pink",
        description: "Once policies, workflows, balances, and calendars are configured, employees can submit requests and administrators can process them confidently.",
        actions: [
            ["Approve or reject requests", "with comments while checking balance and coverage impact."],
            ["Use reports", "to analyse trends, utilisation, and departmental coverage."],
            ["Review the audit log", "for a complete record of administrative actions."],
        ],
        actionLabel: "Go to Leave Requests",
        actionId: "hr_leave_dashboard.action_hr_leave_requests_custom",
    },
];

export class LeaveSetupWizard extends Component {
    static template = "hr_leave_dashboard.LeaveSetupWizard";
    static props = {
        initialStep: { type: Number, optional: true },
        reviewMode: { type: Boolean, optional: true },
        onClose: Function,
        onBackAtFirst: { type: Function, optional: true },
        onCompleted: Function,
        onSkipped: Function,
    };
    static defaultProps = {
        initialStep: 1,
        reviewMode: false,
    };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({
            step: Math.min(5, Math.max(1, this.props.initialStep || 1)),
            busy: false,
        });

        useEffect(() => {
            const onKeydown = (ev) => {
                if (ev.key === "Escape" && !this.state.busy) {
                    this.props.onClose();
                }
            };
            window.addEventListener("keydown", onKeydown);
            return () => window.removeEventListener("keydown", onKeydown);
        }, () => []);
    }

    get stepData() {
        return LEAVE_SETUP_STEPS[this.state.step - 1];
    }

    goBack() {
        if (this.state.step > 1) {
            this.state.step -= 1;
        } else if (this.props.onBackAtFirst) {
            this.props.onBackAtFirst();
        } else {
            this.props.onClose();
        }
    }

    async nextStep() {
        if (this.state.busy) return;
        if (this.props.reviewMode) {
            if (this.state.step === 5) {
                this.props.onCompleted({ state: "completed", reviewMode: true });
            } else {
                this.state.step += 1;
            }
            return;
        }

        this.state.busy = true;
        try {
            if (this.state.step === 5) {
                const result = await this.orm.call("hr.leave.setup.progress", "complete_setup", []);
                this.props.onCompleted(result);
            } else {
                const nextStep = this.state.step + 1;
                await this.orm.call("hr.leave.setup.progress", "advance_step", [], { step: nextStep });
                this.state.step = nextStep;
            }
        } catch (error) {
            console.error("Failed to advance leave setup:", error);
            this.notification.add("The setup progress could not be saved. Please try again.", { type: "danger" });
        } finally {
            this.state.busy = false;
        }
    }

    async skip() {
        if (this.state.busy) return;
        this.state.busy = true;
        try {
            if (!this.props.reviewMode) {
                await this.orm.call("hr.leave.setup.progress", "skip_wizard", []);
            }
            this.props.onSkipped();
        } catch (error) {
            console.error("Failed to skip leave setup:", error);
            this.notification.add("The setup guide could not be closed. Please try again.", { type: "danger" });
        } finally {
            this.state.busy = false;
        }
    }

    async openStepAction() {
        if (this.state.busy) return;
        this.state.busy = true;
        try {
            if (!this.props.reviewMode) {
                await this.orm.call("hr.leave.setup.progress", "advance_step", [], { step: this.state.step });
            }
            return await this.action.doAction(this.stepData.actionId);
        } catch (error) {
            console.error("Failed to open leave setup step:", error);
            this.notification.add("The configuration page could not be opened. Please try again.", { type: "danger" });
        } finally {
            this.state.busy = false;
        }
    }
}

export class LeaveSetupCompletion extends Component {
    static template = "hr_leave_dashboard.LeaveSetupCompletion";
    static props = {
        checklist: Object,
        completedCount: Number,
        onToggle: Function,
        onReview: Function,
        onDone: Function,
        onClose: Function,
    };

    setup() {
        this.action = useService("action");
        useEffect(() => {
            const onKeydown = (ev) => {
                if (ev.key === "Escape") this.props.onClose();
            };
            window.addEventListener("keydown", onKeydown);
            return () => window.removeEventListener("keydown", onKeydown);
        }, () => []);
    }

    get setupSteps() {
        return LEAVE_SETUP_STEPS;
    }

    onChecklistKeydown(ev, key) {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.props.onToggle(key);
        }
    }

    openStep(step) {
        return this.action.doAction(step.actionId);
    }
}
