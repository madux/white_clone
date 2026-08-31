/** @odoo-module **/

import { Component, reactive } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class StaffDirectoryMailModal extends Component {
    static template = "hr_staff_directory.MailModal";
    static props = { state: { type: Object } };

    setup() {
        this.orm = useService("orm");
    }

    get state() {
        return this.props.state;
    }

    close() {
        this.state.isVisible = false;
        this.state.subject = "";
        this.state.body = "";
    }
    
    toggleMinimize() {
        this.state.isMinimized = !this.state.isMinimized;
    }

    async sendMessage() {
        if (!this.state.profile) return;
        
        if (!this.state.subject || !this.state.body) {
            if (this.env.services["hr_staff_directory.toast"]) {
                this.env.services["hr_staff_directory.toast"].show("warning", "Subject and body are required.");
            }
            return;
        }

        if (!this.state.profile.partner_id) {
            if (this.env.services["hr_staff_directory.toast"]) {
                this.env.services["hr_staff_directory.toast"].show("error", "Employee has no contact record attached.");
            }
            return;
        }

        try {
            // Post an email message directly to the hr.employee chatter
            // Passing partner_ids forces Odoo to actually dispatch the email to them
            await this.orm.call("hr.employee", "message_post", [this.state.profile.id], {
                subject: this.state.subject,
                body: this.state.body,
                message_type: 'email',
                subtype_xmlid: 'mail.mt_comment',
                partner_ids: [this.state.profile.partner_id]
            });

            if (this.env.services["hr_staff_directory.toast"]) {
                this.env.services["hr_staff_directory.toast"].show("success", "Email queued for delivery!");
            }
            this.close();
        } catch (error) {
            console.error("Failed to send email:", error);
            if (this.env.services["hr_staff_directory.toast"]) {
                this.env.services["hr_staff_directory.toast"].show("error", "Failed to send email.");
            }
        }
    }
}

export const sdirMailModalService = {
    dependencies: ["mail.chat_window"],
    start(env, { "mail.chat_window": chatWindowService }) {
        const state = reactive({ 
            isVisible: false,
            isMinimized: false,
            profile: null,
            subject: "",
            body: ""
        });
        
        registry.category("main_components").add(
            "SDIRMailModalContainer",
            { Component: StaffDirectoryMailModal, props: { state } },
            { sequence: 102 }
        );
        
        return {
            state,
            async show(profile) {
                const visibleWindows = [...chatWindowService.visible];
                for (const cw of visibleWindows) {
                    await chatWindowService.close(cw);
                }
                state.profile = profile;
                state.isVisible = true;
            },
            hide() {
                state.isVisible = false;
                state.isMinimized = false;
                state.subject = "";
                state.body = "";
            }
        };
    },
};

registry.category("services").add("hr_staff_directory.mail_modal", sdirMailModalService);
