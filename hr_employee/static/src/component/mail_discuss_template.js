/** @odoo-module **/

import { DiscussSidebar } from "@mail/core/web/discuss_sidebar";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(DiscussSidebar.prototype, {

    setup() {
        super.setup();
        this.actionService = useService("action");
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
    },

     
    
    async openEmployee(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_administration.action_view_employee_kanban_custom",
            {
                target: "new",
            }
        );
    },
    async openAnnouncement(ev) {
        ev.preventDefault();

        await this.env.services.action.doAction(
            "hr_employee.action_hr_core_announcement",
            {
                target: "new",
            }
        );
    },

    async openDepartment(ev) {
        ev.preventDefault();
        await this.env.services.action.doAction(
            "hr_cleon_recruitment.action_hr_department_recruitment",
            {
                target: "new",
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