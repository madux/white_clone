
/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { onMounted, onWillUnmount, useState } from "@odoo/owl";

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);

        this.aiLoadingState = useState({
            loading: false,
        });

        this._aiOverlay = null;

        onWillUnmount(() => {
            this._removeAILoadingOverlay();
        });
    },

    async beforeExecuteActionButton(clickParams) {
        const isAIButton =
            clickParams.name === "action_generate_with_ai";

        if (isAIButton) {
            this.aiLoadingState.loading = true;
            this._showAILoadingOverlay();
        }

        try {
            return await super.beforeExecuteActionButton(
                ...arguments
            );
        } catch (error) {
            if (isAIButton) {
                this._removeAILoadingOverlay();
                this.aiLoadingState.loading = false;
            }
            throw error;
        }
    },

    async afterExecuteActionButton(clickParams) {
        try {
            return await super.afterExecuteActionButton(
                ...arguments
            );
        } finally {
            if (
                clickParams.name === "action_generate_with_ai"
            ) {
                this._removeAILoadingOverlay();
                this.aiLoadingState.loading = false;
            }
        }
    },

    _showAILoadingOverlay() {
        this._removeAILoadingOverlay();

        const overlay = document.createElement("div");
        overlay.className = "o_ai_fullscreen_overlay";

        overlay.innerHTML = `
            <div class="o_ai_loading_content">
                <div class="o_ai_large_spinner"></div>
                <div class="o_ai_loading_title">
                    Generating salary...
                </div>
                <div class="o_ai_loading_message">
                    Please wait while AI processes your request.
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._aiOverlay = overlay;
    },

    _removeAILoadingOverlay() {
        if (this._aiOverlay) {
            this._aiOverlay.remove();
            this._aiOverlay = null;
        }

        // Also clean up if the view changed while loading.
        document
            .querySelectorAll(".o_ai_fullscreen_overlay")
            .forEach((element) => element.remove());
    },
});
