/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
import { useService } from "@web/core/utils/hooks";
import { onMounted, onWillUpdateProps } from "@odoo/owl";

export class CustomRecruitmentListRenderer extends ListRenderer {

    setup() {
        super.setup();
        this.orm           = useService("orm");
        this.actionService = useService("action");
        this.userService   = useService("user");

        // Debug — runs once on mount so you can inspect in the console
        onMounted(() => {
            console.group("[Recruitment] DEBUG — action resolution");
            console.log("env.config              →", this.env.config);
            console.log("env.config.action       →", this.env.config?.action);
            console.log("env.config.actionId     →", this.env.config?.actionId);
            console.log("env.config.actionType   →", this.env.config?.actionType);
            console.log("currentController       →", this.actionService.currentController);
            console.log("currentController.action→", this.actionService.currentController?.action);
            console.log("props.list              →", this.props.list);
            console.log("props.list.resModel     →", this.props.list?.resModel);
            console.log("_resolveActionName()    →", this._resolveCurrentActionName());
            console.groupEnd();
        });

        // Also re-log when props change (navigation between actions)
        onWillUpdateProps((nextProps) => {
            console.group("[Recruitment] onWillUpdateProps — action resolution");
            console.log("currentController.action→", this.actionService.currentController?.action);
            console.log("env.config.action       →", this.env.config?.action);
            console.groupEnd();
        });
    }

    // ── Robust fallback chain ───────────────────────────────────────────────
    // Try every known location across Odoo 16/17 until we get a name.

    _resolveAction() {
        return (
            this.env.config?.action ||                          // Odoo 17 primary
            this.actionService.currentController?.action ||    // Odoo 16 / fallback
            {}
        );
    }

    _resolveCurrentModel() {
        return (
            this._resolveAction().res_model ||
            this.props?.list?.resModel ||           // Odoo 17
            this.props?.list?.config?.resModel ||   // Odoo 16
            ""
        );
    }

    _resolveCurrentActionName() {
        // Try every known path — one of them will have the name
        // return (
        //     this.env.config?.action?.name ||
        //     this.env.config?.displayName ||
        //     this.actionService.currentController?.action?.name ||
        //     this.props?.action?.name ||
        //     ""
        // ).trim();
        return (
            this.props.list?.resModel
        ).trim();
    }

    // ── getters ─────────────────────────────────────────────────────────────

    get isApplicantView() {
        const name = this._resolveCurrentActionName();
        console.log("[Recruitment] isApplicantView — name:", name);
        return name === "hr.applicant";
    }

    get isJobView() {
        const name = this._resolveCurrentActionName();
        console.log("[Recruitment] isJobView — name:", name);
        return name === "hr.job";
    }

    get currentModel() {
        return this._resolveCurrentModel();
    }

    get currentActionName() {
        return this._resolveCurrentActionName();
    }

    // ── action handlers ──────────────────────────────────────────────────────

    async openCandidateWizard(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_recruitment_add_candidate",
            { target: "new", name: "Add Candidate" }
        );
    }

    async openJob(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_job_recruitment",
            { target: "current" }
        );
    }

    async openCandidate(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_applicant_recruitment",
            { target: "current" }
        );
    }

    async openDepartment(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_department_recruitment",
            { target: "current" }
        );
    }
}

CustomRecruitmentListRenderer.template =
    "hr_cleon_recruitment.CustomRecruitmentListRenderer";

export const CustomRecruitmentDashboardListView = {
    ...listView,
    Renderer: CustomRecruitmentListRenderer,
};

registry
    .category("views")
    .add("myrecruitment_dashboard_list", CustomRecruitmentDashboardListView);