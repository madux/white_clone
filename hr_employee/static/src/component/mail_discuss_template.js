/** @odoo-module **/

import { DiscussSidebar } from "@mail/core/web/discuss_sidebar";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(DiscussSidebar.prototype, {

    setup() {
        super.setup();

        this.action = useService("action");
    },
    
    async openMessage(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "mail.action_discuss",
            {
                target: "current",
            }
        );
    }

    // async openMessage() {
    //     console.log("Message discussion clicked")
    //     await this.action.doAction({
    //         type: "ir.actions.act_window",
    //         name: "Employees",
    //         res_model: "discuss.channel",
    //         view_mode: "form",
    //         target: "current",
    //     });
    // },

});