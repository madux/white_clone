/** @odoo-module **/

import { Component, useRef, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

// ═══════════════════════════════════════════════════════════════════════
//  PlanView OWL Component
//  Behaves like the Map view — it's a top-level view type registered in
//  the "views" registry, rendered by the action manager.
// ═══════════════════════════════════════════════════════════════════════

export class PlanView extends Component {
    static template = "plan_view_widget.PlanView";
    static props = {
        // Standard view props passed by the action manager
        arch: { type: Object, optional: true },
        fields: { type: Object, optional: true },
        domain: { type: Array, optional: true },
        context: { type: Object, optional: true },
        resModel: { type: String, optional: true },
        actionId: { type: [Number, String], optional: true },
        // Custom plan view props from <plan> arch
        src: { type: String, optional: true },
        "*": true,
    };

    setup() {
        this.action = useService("action");
        this.planIframe = useRef("planIframe");

        this.state = useState({
            isLoading: true,
            isFullscreen: false,
        });

        // Listen for postMessage events from the iframe
        this._onMessage = this._handleIframeMessage.bind(this);
        onMounted(() => window.addEventListener("message", this._onMessage));
        onWillUnmount(() => window.removeEventListener("message", this._onMessage));
    }

    // ── Build the iframe src URL ────────────────────────────────────────
    get iframeSrc() {
        // Allow a custom `src` attribute on the <plan> view arch,
        // otherwise fall back to the default local route.
        const base = this.props.src || "/plan_view/page";

        const params = new URLSearchParams();

        if (this.props.resModel) {
            params.set("model", this.props.resModel);
        }
        if (this.props.actionId) {
            params.set("action_id", this.props.actionId);
        }

        // Pass a serialised domain so the page can filter records
        const domain = this.props.domain || [];
        if (domain.length) {
            params.set("domain", JSON.stringify(domain));
        }

        // Merge any context keys prefixed with "plan_" into the URL
        const ctx = this.props.context || {};
        for (const [key, val] of Object.entries(ctx)) {
            if (key.startsWith("plan_")) {
                params.set(key, val);
            }
        }

        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
    }

    // ── Callbacks ───────────────────────────────────────────────────────

    onIframeLoad() {
        this.state.isLoading = false;
    }

    reload() {
        this.state.isLoading = true;
        const iframe = this.planIframe.el;
        if (iframe) {
            iframe.src = iframe.src; // force reload
        }
    }

    toggleFullscreen() {
        this.state.isFullscreen = !this.state.isFullscreen;
    }

    // ── postMessage bridge ──────────────────────────────────────────────
    // The embedded page can send messages to open Odoo records, trigger
    // actions, etc.  Extend the switch below to add more message types.
    _handleIframeMessage(event) {
        // Only trust messages from the same origin
        if (event.origin !== window.location.origin) return;

        const { type, model, id, action } = event.data || {};

        switch (type) {
            case "plan_view:open_record":
                if (model && id) {
                    this.action.doAction({
                        type: "ir.actions.act_window",
                        res_model: model,
                        res_id: id,
                        views: [[false, "form"]],
                        target: "current",
                    });
                }
                break;

            case "plan_view:do_action":
                if (action) {
                    this.action.doAction(action);
                }
                break;

            // Add more cases here as needed
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  View controller definition
//  This is what the action manager uses to mount PlanView.
// ═══════════════════════════════════════════════════════════════════════

export const planView = {
    // The type string must match the `view_type` in your ir.ui.view record
    type: "plan",
    display_name: "Plan",
    icon: "oi-map",          // Odoo 17 icon string
    multiRecord: true,       // true = like list/kanban, false = like form
    Component: PlanView,

    // Optional: parse the <plan> arch node into props for the component
    props(genericProps, view) {
        const { arch } = genericProps;
        // Read any custom attributes from <plan src="..." /> arch element
        const src = arch.attrs?.src || null;
        return {
            ...genericProps,
            src,
        };
    },
};

// Register as a first-class view type — same registry as "map", "list", etc.
registry.category("views").add("plan", planView);
