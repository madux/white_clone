/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";
import { LEAVE_SETUP_STEPS, LeaveSetupCompletion, LeaveSetupWizard } from "../setup_wizard/setup_wizard";

export class GetStartedPage extends Component {
    static template = "hr_leave_dashboard.GetStartedPage";
    static components = { CalendarSidebar, LeaveSetupWizard, LeaveSetupCompletion };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.user = useService("user");

        this.state = useState({
            loading: true,
            checklist: {
                check_leave_type: false,
                check_approval_workflow: false,
                check_allocate_balance: false,
                check_set_country: false,
                check_review_request: false,
            },
            completedCount: 0,
            setupState: "not_started",
            currentStep: 0,
            showWizard: false,
            wizardStep: 1,
            reviewMode: false,
            showCompletionModal: false,
            viewMode: "admin",
            progressExpanded: true,
        });

        onWillStart(async () => {
            await this.loadProgress();
        });
    }

    async loadProgress() {
        try {
            const setup = await this.orm.call("hr.leave.setup.progress", "get_welcome_state", []);
            this.state.setupState = setup.state || "not_started";
            this.state.currentStep = setup.current_step || 0;
            if (setup.checklist) {
                this.state.checklist = setup.checklist;
                this.state.completedCount = setup.completed_count || 0;
            }
        } catch (error) {
            console.error("Failed to load leave setup progress:", error);
        } finally {
            this.state.loading = false;
        }
    }

    async toggleChecklistItem(itemKey) {
        const targetVal = !this.state.checklist[itemKey];
        try {
            const res = await this.orm.call(
                "hr.leave.setup.progress",
                "set_checklist_item",
                [],
                { item_key: itemKey, completed: targetVal }
            );
            if (res && res.checklist) {
                this.state.checklist = res.checklist;
                this.state.completedCount = res.completed_count || 0;
                if (this.state.completedCount === 5 && !this.state.showCompletionModal) {
                    this.state.showCompletionModal = true;
                    await this.orm.call("hr.leave.setup.progress", "complete_setup", []);
                }
            }
        } catch (error) {
            console.error("Failed to toggle checklist item:", error);
        }
    }

    toggleProgressExpanded() {
        this.state.progressExpanded = !this.state.progressExpanded;
    }

    get setupSteps() {
        return LEAVE_SETUP_STEPS;
    }

    openChecklistStep(step) {
        return this.action.doAction(step.actionId);
    }

    // ── Wizard Methods ─────────────────────────────────────────

    async openWizard() {
        if (this.state.setupState === "completed") {
            this.state.wizardStep = 1;
            this.state.reviewMode = true;
            this.state.showWizard = true;
            return;
        }
        try {
            const setup = await this.orm.call("hr.leave.setup.progress", "start_setup", []);
            this.state.setupState = setup.state;
            this.state.currentStep = setup.current_step;
            this.state.wizardStep = setup.current_step || 1;
            this.state.reviewMode = false;
            this.state.showWizard = true;
        } catch (error) {
            console.error("Failed to start leave setup:", error);
            this.notification.add("The setup guide could not be opened. Please try again.", { type: "danger" });
        }
    }

    closeWizard() {
        this.state.showWizard = false;
        this.state.reviewMode = false;
    }

    backFromWizardStart() {
        this.closeWizard();
    }

    async wizardCompleted() {
        this.state.showWizard = false;
        this.state.reviewMode = false;
        this.state.showCompletionModal = true;
        await this.loadProgress();
    }

    async wizardSkipped() {
        this.state.showWizard = false;
        this.state.reviewMode = false;
        await this.loadProgress();
    }

    closeCompletionModal() {
        this.state.showCompletionModal = false;
    }

    reviewWizardSteps() {
        this.state.showCompletionModal = false;
        this.state.wizardStep = 1;
        this.state.reviewMode = true;
        this.state.showWizard = true;
    }

    doneGoToDashboard() {
        this.state.showCompletionModal = false;
        return this.openDashboard();
    }

    // ── Navigation Actions ─────────────────────────────────────

    setViewMode(mode) {
        if (mode === "employee") {
            return this.action.doAction("hr_leave_dashboard.action_hr_leave_employee_dashboard");
        }
        this.state.viewMode = mode;
    }

    openDashboard() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");
    }

    openTour() {
        this.notification.add("Use this guide to complete your leave management setup. Click any step's action button to jump directly to its configuration page.", {
            title: "Leave Setup Guide",
            type: "info",
        });
    }
}

registry.category("actions").add("hr_leave_dashboard.GetStartedPage", GetStartedPage);
