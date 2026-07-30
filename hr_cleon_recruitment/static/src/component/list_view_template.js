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
        this.action = this.env.services.action;
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
            console.log("_resolveActionName()    →", this._resolveCurrentModelName());
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

    _resolveCurrentModelName() {
        return (
            this.props.list?.resModel
        ).trim();
        // Try every known path — one of them will have the name
        // return (
        //     this.env.config?.action?.name ||
        //     this.env.config?.displayName ||
        //     this.actionService.currentController?.action?.name ||
        //     this.props?.action?.name ||
        //     ""
        // ).trim();
        
    }

    // ── getters ─────────────────────────────────────────────────────────────

    get isApplicantView() {
        const name = this._resolveCurrentModelName();
        console.log("[Recruitment] isApplicantView — name:", name);
        return name === "hr.applicant";
    }

    get isJobView() {
        const name = this._resolveCurrentModelName();
        console.log("[Recruitment] isJobView — name:", name);
        return name === "hr.job";
    }

    get isJobOffer() {
        const name = this._resolveCurrentModelName();
        console.log("[Recruitment] isJobOffer — name:", name);
        return name === "hr.offer";
    }

    get currentModel() {
        return this._resolveCurrentModel();
    }

    get currentActionName() {
        return this._resolveCurrentModelName();
    }

    // ── action handlers ──────────────────────────────────────────────────────

    async openCandidateWizard(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_recruitment_add_candidate",
            { target: "new", name: "Add Candidate" }
        );
    }
    async openJobWizard(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_recruitment_add_custom_job",
            { target: "new", name: "Add Job" }
        );
    }

    async openApplicantImportWizard(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cbt_portal_recruitment.action_wizard_hr_import_applicants",
            { target: "new", name: "Import Applicant" }
        );
    }

    // async detectDuplicates() {

    //     const action = await this.orm.call(
    //         "hr.applicant",
    //         "action_detect_duplicates",
    //         [[]]
    //     );

    //     this.actionService.doAction(action);
    // }

    async detectDuplicates() {
        const recordIds = await this.orm.call(
            'hr.applicant',
            'action_detect_duplicates',
            []
        );

        console.log(recordIds);
        // if system complains are map undefined
        //  : ensure to add views: [[false, 'list'], [false, 'form']]
        this.action.doAction({
            type: 'ir.actions.act_window',
            name: 'Detected Duplicate Applicants',
            res_model: 'hr.applicant',
            views: [[false, 'list'], [false, 'form']],   // <-- this was missing
            view_mode: 'list,form',
            domain: [['id', 'in', recordIds]],
            target: 'new',
        });
    }
    // async openJobWizard(ev) {
    //     ev.preventDefault();
    //     await this.actionService.doAction(
    //         "hr_cleon_recruitment.action_hr_add_job",
    //         { target: "new", name: "Add Job positions"}
    //     );
    // }

    async openOfferWizard(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_offer_wizard_recruitment",
            { target: "new", name: "Add Offer"}
        );
    }

    async openJob(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_job_recruitment",
            { target: "current" }
        );
    }

    async openRecruitmentRequest(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cbt_portal_recruitment.recruitment_request_action",
            { target: "current" }
        );
    }

    async openCBT(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_survey_cbt_tree_action",
            { target: "current" }
        );
    }

    async openRecruitmentStages(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_recruitment.hr_recruitment_stage_act",
            { target: "current" }
        );
    }

    async openTalentMobility(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_talent_mobility_server_action",
            { target: "current" }
        );
    }

    // async openRecruitmentStages(ev) {
    //     ev.preventDefault();
    //     await this.actionService.doAction(
    //         "hr_recruitment.hr_recruitment_stage_act",
    //         { target: "current" }
    //     );
    // }

    async openRecruitmentScoreSheet(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cbt_portal_recruitment.action_score_sheet_export",
            { target: "current" }
        );
    }

    async openRecruitmentDocumentType(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cbt_portal_recruitment.action_documentation_type",
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
    async openOffers(ev) {
        ev.preventDefault();
        await this.actionService.doAction(
            "hr_cleon_recruitment.action_hr_offer_recruitment",
            { target: "new" }
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