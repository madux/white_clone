/** @odoo-module **/
import { registry } from "@web/core/registry";
export const sdirMessageService = {
    dependencies: ["mail.thread", "hr_staff_directory.toast", "mail.chat_window", "hr_staff_directory.mail_modal", "discuss.rtc"],
    start(env, { "mail.thread": mailThread, "hr_staff_directory.toast": toast, "mail.chat_window": chatWindowService, "hr_staff_directory.mail_modal": mailModalService, "discuss.rtc": rtc }) {
        return {
                        async showBulk(profiles) {
                const partnerIds = profiles.map(p => p.partner_id).filter(id => id);
                if (partnerIds.length === 0) {
                    toast.show("warning", "No selected employees have linked contact accounts.");
                    return;
                }
                
                const visibleWindows = [...chatWindowService.visible];
                for (const cw of visibleWindows) {
                    await chatWindowService.close(cw);
                }
                mailModalService.hide();
                
                if (partnerIds.length === 1) {
                    mailThread.openChat({ partnerId: partnerIds[0] });
                } else {
                    if (env.services["discuss.core.common"]) {
                        env.services["discuss.core.common"].createGroupChat({ partners_to: partnerIds });
                    } else {
                        toast.show("error", "Group chat service is not available.");
                    }
                }
            },
            async show(profile, options = {}) {
                if (profile && profile.partner_id) {
                    // Close all currently visible chat windows to ensure only one is open
                    const visibleWindows = [...chatWindowService.visible];
                    for (const cw of visibleWindows) {
                        await chatWindowService.close(cw);
                    }
                    
                    mailModalService.hide();
                    
                    if (options.startVideoCall) {
                        const thread = await mailThread.getChat({ partnerId: profile.partner_id });
                        if (thread) {
                            mailThread.open(thread);
                            rtc.toggleCall(thread, { video: true });
                        } else {
                            toast.show("error", "Failed to start chat.");
                        }
                    } else {
                        mailThread.openChat({ partnerId: profile.partner_id });
                    }
                } else {
                    toast.show("warning", "This employee has no linked contact account.");
                }
            }
        };
    },
};
registry.category("services").add("hr_staff_directory.message", sdirMessageService);
