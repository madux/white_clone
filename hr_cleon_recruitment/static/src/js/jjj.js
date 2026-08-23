/** @odoo-module **/

import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { FormController } from "@web/views/form/form_controller";
import { useService } from "@web/core/utils/hooks";

export class JobFormViewController extends FormController {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.userService   = useService("user");
        this.action = this.env.services.action;
        console.log("FORM VIEW CONTROLLER ACTIVATED")

    }

    _resolveAction() {
        return (
            this.env.config?.action ||                          // Odoo 17 primary
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
    }

    // ── getters ─────────────────────────────────────────────────────────────

}
JobFormViewController.template = "hr_cleon_recruitment.JobFormViewController";

export const recruitmentSidebarFormView = {
    ...formView,
    Controller: JobFormViewController,
};
registry.category("views").add("recruitment_sidebar_items", recruitmentSidebarFormView);
 