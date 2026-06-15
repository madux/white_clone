/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

patch(FormController.prototype, {

    async afterExecuteActionButton(clickParams, result) {

        await super.afterExecuteActionButton(...arguments);

        const buttonName = clickParams.name;

        if (
            buttonName === 'button_next_step' ||
            buttonName === 'button_previous_step'
        ) {

            await this.model.root.load();

            this.render(true);
        }

        return result;
    },

});