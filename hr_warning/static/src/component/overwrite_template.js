/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListController } from "@web/views/list/list_controller";
import { useService } from "@web/core/utils/hooks";
import { onWillStart } from "@odoo/owl";

patch(ListController.prototype, {

    setup() {
        super.setup(...arguments);
        this._actionService = useService("action");

        onWillStart(async () => {
            this._createButtonLabel = this._computeCreateLabel();
        });
    },

    /**
     * Derives the "Create X" label from the current action.
     *
     * Rules:
     *  - If the action name contains a dot  →  fall back to "New Record"
     *  - Otherwise                          →  "Create <action name>"
     */
    _computeCreateLabel() {
        // currentController is available after setup; fall back to action stored on env
        const action =
            this._actionService.currentController?.action ||
            this.env.config?.action ||
            {};

        const name = (action.name || "").trim();

        if (name.includes(":")) {
            return `Create ${name.replace(':', '')}`
        }

        return "New Record";
    },

    /** Expose label so the template can reference it */
    get createButtonLabel() {
        return this._createButtonLabel || "New Record";
    },
});