/** @odoo-module **/

import { Component, reactive, useRef, markup, onPatched } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { session } from "@web/session";

export class StaffDirectoryMessage extends Component {
    static template = "hr_staff_directory.Message";
    static props = { state: { type: Object } };

    setup() {
        this.orm = useService("orm");
        this.toast = useService("hr_staff_directory.toast");
        this.msgBodyRef = useRef("msgBody");
        this.msgInputRef = useRef("msgInput");

        onPatched(() => {
            if (this.state.isVisible && this.msgInputRef.el && document.activeElement !== this.msgInputRef.el) {
                this.msgInputRef.el.focus();
            }
        });
    }

    get state() {
        return this.props.state;
    }

    close() {
        this.state.isVisible = false;
        this.state.messageBody = "";
    }
    
    onKeydown(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            this.sendMessage();
        }
    }

    async sendMessage() {
        if (!this.state.profile || !this.state.messageBody) return;
        
        if (!this.state.profile.partner_id) {
            if (this.toast) {
                this.toast.show("warning", "This employee has no linked user or contact account.");
            }
            return;
        }
        
        try {
            const channelInfo = await this.orm.call("discuss.channel", "channel_get", [
                [this.state.profile.partner_id]
            ]);

            await this.orm.call("discuss.channel", "message_post", [channelInfo.id], {
                body: this.state.messageBody,
                message_type: 'comment',
                subtype_xmlid: 'mail.mt_comment',
            });

            if (this.toast) {
                this.toast.show("success", "Message sent successfully!");
            }
            this.state.messageBody = ""; 
            
            if (this.env.services["hr_staff_directory.message"]) {
                await this.env.services["hr_staff_directory.message"].loadMessagesForProfile(this.state.profile);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            if (this.toast) {
                this.toast.show("error", "Failed to send message.");
            }
        }
    }
}

function formatTime(dateStr) {
    if (!dateStr) return "";
    const dateObj = new Date(dateStr.replace(' ', 'T') + 'Z');
    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

export const sdirMessageService = {
    start(env) {
        const state = reactive({ 
            isVisible: false,
            profile: null,
            messageBody: "",
            messages: []
        });
        
        registry.category("main_components").add(
            "SDIRMessageContainer",
            { Component: StaffDirectoryMessage, props: { state } },
            { sequence: 101 }
        );
        
        const service = {
            state,
            async loadMessagesForProfile(profile) {
                if (!profile.partner_id) return;
                try {
                    const channelInfo = await env.services.orm.call("discuss.channel", "channel_get", [[profile.partner_id]]);
                    const msgs = await env.services.orm.searchRead(
                        "mail.message",
                        [["model", "=", "discuss.channel"], ["res_id", "=", channelInfo.id]],
                        ["id", "body", "author_id", "date"],
                        { limit: 50, order: "date DESC" }
                    );
                    state.messages = msgs.map(msg => {
                        const isMine = msg.author_id && msg.author_id[0] === session.partner_id;
                        let initials = "?";
                        if (msg.author_id && msg.author_id[1]) {
                            const parts = msg.author_id[1].split(' ');
                            initials = parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
                        }
                        
                        const timeStr = formatTime(msg.date);
                        
                        let safeBody = msg.body || "";
                        if (safeBody.startsWith("<p>") && safeBody.endsWith("</p>")) {
                            safeBody = safeBody.substring(3, safeBody.length - 4);
                        }
                        
                        return { 
                            id: msg.id, 
                            body: markup(safeBody), 
                            isMine, 
                            time: timeStr, 
                            authorInitials: initials 
                        };
                    }).reverse();
                    
                    setTimeout(() => {
                        const bodyEl = document.querySelector('.sdir-msg-body');
                        if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
                    }, 50);
                } catch (e) {
                    console.error("Failed to load messages:", e);
                }
            },
            async show(profile) {
                state.profile = profile;
                state.isVisible = true;
                state.messages = [];
                await this.loadMessagesForProfile(profile);
            },
            hide() {
                state.isVisible = false;
                state.messageBody = "";
            }
        };
        return service;
    },
};

registry.category("services").add("hr_staff_directory.message", sdirMessageService);
