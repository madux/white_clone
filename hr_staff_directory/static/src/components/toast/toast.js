/** @odoo-module **/

import { Component, reactive } from "@odoo/owl";
import { registry } from "@web/core/registry";

// ─── Toast Component ──────────────────────────────────────────────────────────
// Registered as a main component by the service below, so exactly one toast
// container is mounted at the webclient root for the whole session — the same
// pattern Odoo core uses for its notification service. The reactive state
// object is passed as a prop, so any service-state change re-renders it.
export class StaffDirectoryToast extends Component {
    static template = "hr_staff_directory.Toast";
    static props = { state: { type: Object } };

    get state() {
        return this.props.state;
    }
}

// ─── Toast Service ────────────────────────────────────────────────────────────
// Module-wide singleton so ANY component can raise the shared slide-up toast
// without prop-drilling:
//     this.toast = useService("hr_staff_directory.toast");
//     this.toast.show("warning", "Give the segment a name");
export const sdirToastService = {
    start(env) {
        const state = reactive({ isVisible: false, type: "success", message: "" });
        let hideTimer = null;
        registry.category("main_components").add(
            "SDIRToastContainer",
            { Component: StaffDirectoryToast, props: { state } },
            { sequence: 100 }
        );
        return {
            state,
            show(type, message, duration = 5000) {
                state.type = type;
                state.message = message;
                state.isVisible = true;
                if (hideTimer) {
                    clearTimeout(hideTimer);
                }
                hideTimer = setTimeout(() => {
                    state.isVisible = false;
                }, duration);
            },
        };
    },
};

registry.category("services").add("hr_staff_directory.toast", sdirToastService);
