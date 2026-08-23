/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";

export class GetStartedPage extends Component {
    static template = "hr_leave_dashboard.GetStartedPage";
    static components = { CalendarSidebar };

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.user = useService("user");

        this.state = useState({
            loading: true,
            checklist: {
                check_leave_type: false,
                check_allocate_balance: false,
                check_set_country: false,
                check_review_request: false,
                check_run_report: false,
            },
            completedCount: 0,
            setupState: "not_started",
            currentStep: 0,
            showWizard: false,
            wizardStep: 1,
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

    // ── Wizard Methods ─────────────────────────────────────────

    openWizard() {
        this.state.wizardStep = 1;
        this.state.showWizard = true;
    }

    closeWizard() {
        this.state.showWizard = false;
    }

    prevWizardStep() {
        if (this.state.wizardStep > 1) {
            this.state.wizardStep -= 1;
        } else {
            this.closeWizard();
        }
    }

    async nextWizardStep() {
        const nextStep = this.state.wizardStep + 1;
        if (nextStep > 5) {
            await this.orm.call("hr.leave.setup.progress", "complete_setup", []);
            this.state.showWizard = false;
            this.state.showCompletionModal = true;
            await this.loadProgress();
            return;
        }
        await this.orm.call("hr.leave.setup.progress", "advance_step", [], { step: nextStep });
        this.state.wizardStep = nextStep;
        await this.loadProgress();
    }

    async skipWizard() {
        this.state.showWizard = false;
        await this.orm.call("hr.leave.setup.progress", "skip_wizard", []);
    }

    closeCompletionModal() {
        this.state.showCompletionModal = false;
    }

    // ── Navigation Actions ─────────────────────────────────────

    setViewMode(mode) {
        if (mode === "employee") {
            return this.action.doAction("hr_leave_dashboard.action_hr_leave_employee_dashboard");
        }
        this.state.viewMode = mode;
    }

    openLeaveTypes() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_types_custom");
    }

    openLeaveBalances() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_balances_custom");
    }

    openSettings() {
        return this.action.doAction("hr_holidays.action_hr_holidays_configuration");
    }

    openLeaveRequests() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_requests_custom");
    }

    openLeaveCalendar() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");
    }

    openReports() {
        return this.action.doAction("hr_leave_dashboard.action_hr_leave_reports_custom");
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
