/** @odoo-module **/

import { Component, reactive } from "@odoo/owl";
import { registry } from "@web/core/registry";

export class StaffDirectoryMessage extends Component {
    static template = "hr_staff_directory.Message";
    static props = { state: { type: Object } };

    get state() {
        return this.props.state;
    }

    close() {
        this.state.isVisible = false;
    }
}

export const sdirMessageService = {
    start(env) {
        const state = reactive({ 
            isVisible: false,
            profile: null
        });
        
        registry.category("main_components").add(
            "SDIRMessageContainer",
            { Component: StaffDirectoryMessage, props: { state } },
            { sequence: 101 }
        );
        
        return {
            state,
            show(profile) {
                state.profile = profile;
                state.isVisible = true;
            },
            hide() {
                state.isVisible = false;
            }
        };
    },
};

registry.category("services").add("hr_staff_directory.message", sdirMessageService);
