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
        if (!this.state.profiles || this.state.profiles.length === 0) return;
        
        if (!this.state.subject || !this.state.body) {
            if (this.env.services["hr_staff_directory.toast"]) {
                this.env.services["hr_staff_directory.toast"].show("warning", "Subject and body are required.");
            }
            return;
        }

        try {
            let sentCount = 0;
            let errorCount = 0;
            
            for (const profile of this.state.profiles) {
                if (!profile.partner_id) {
                    errorCount++;
                    continue;
                }
                try {
                    await this.orm.call("hr.employee", "message_post", [profile.id], {
                        subject: this.state.subject,
                        body: this.state.body,
                        message_type: 'email',
                        subtype_xmlid: 'mail.mt_comment',
                        partner_ids: [profile.partner_id]
                    });
                    sentCount++;
                } catch (e) {
                    console.error("Failed to send email to", profile.name, e);
                    errorCount++;
                }
            }

            if (this.env.services["hr_staff_directory.toast"]) {
                if (sentCount > 0 && errorCount === 0) {
                    this.env.services["hr_staff_directory.toast"].show("success", sentCount === 1 ? "Email queued for delivery!" : `Queued ${sentCount} emails for delivery!`);
                } else if (sentCount > 0 && errorCount > 0) {
                    this.env.services["hr_staff_directory.toast"].show("warning", `Sent ${sentCount} emails, but ${errorCount} failed.`);
                } else {
                    this.env.services["hr_staff_directory.toast"].show("error", "Failed to send emails.");
                }
            }
            this.close();
        } catch (error) {
            console.error("Failed to process bulk email:", error);
            if (this.env.services["hr_staff_directory.toast"]) {
                this.env.services["hr_staff_directory.toast"].show("error", "An unexpected error occurred.");
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
            profiles: [],
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
            async showBulk(profiles) {
                const visibleWindows = [...chatWindowService.visible];
                for (const cw of visibleWindows) {
                    await chatWindowService.close(cw);
                }
                state.profiles = profiles;
                state.isVisible = true;
            },
            async show(profile) {
                this.showBulk([profile]);
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
