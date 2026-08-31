/** @odoo-module **/
import { ChatWindow } from "@mail/core/common/chat_window";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";

patch(ChatWindow.prototype, {
    setup() {
        super.setup(...arguments);
        this.sdirState = useState({ isFullScreen: false });
    },
    toggleFullScreen() {
        this.sdirState.isFullScreen = !this.sdirState.isFullScreen;
    }
});
