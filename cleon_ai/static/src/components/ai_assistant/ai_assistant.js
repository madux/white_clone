/** @odoo-module **/

import { Component, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { formatAssistantMarkdown } from "@cleon_ai/js/markdown";

export class CleonAiAssistant extends Component {
    static template = "cleon_ai.CleonAiAssistant";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({
            open: false,
            loading: false,
            context: null,
            summary: null,
            question: "",
            messages: [],
            messageFeedback: {},   // index → true/false
        });

        this.setContext = (context) => {
            const prev = JSON.stringify(this.state.context || null);
            const next = JSON.stringify(context || null);
            if (prev === next) return;

            this.state.context = context || null;
            this.state.summary = null;
            this.state.messages = [];
            this.state.messageFeedback = {};
            if (this.state.open && context) {
                this.refreshSummary();
            }
        };

        this.contextListener = (event) => {
            this.setContext(event?.detail || null);
        };

        this.openListener = async (event) => {
            const detail = event?.detail || null;
            if (detail && typeof detail === "object" && detail.mode === "fullscreen") {
                return;
            }
            let question = "";
            if (detail && typeof detail === "object") {
                const context = { ...detail };
                question = context.ask ? String(context.ask).trim() : "";
                delete context.ask;
                this.setContext(context);
            } else if (detail) {
                this.setContext(detail);
            }
            this.state.open = true;
            if (this.state.context) {
                await this.refreshSummary();
            }
            if (question) {
                this.state.question = question;
                await this.ask();
            }
        };

        this.onNavigationChange = () => {
            // When navigating between Odoo routes/actions, reset context unless the new page announces itself
            this.setContext(null);
        };

        onMounted(() => {
            window.addEventListener("cleon-ai-context", this.contextListener);
            window.addEventListener("cleon-ai-open", this.openListener);
            window.addEventListener("hashchange", this.onNavigationChange);
        });

        onWillUnmount(() => {
            window.removeEventListener("cleon-ai-context", this.contextListener);
            window.removeEventListener("cleon-ai-open", this.openListener);
            window.removeEventListener("hashchange", this.onNavigationChange);
        });
    }

    async toggle() {
        this.state.open = !this.state.open;
        if (this.state.open && this.state.context) {
            await this.refreshSummary();
        }
    }

    openFullscreen() {
        const detail = Object.assign({}, this.state.context || {});
        const draft = (this.state.question || "").trim();
        detail.mode = "fullscreen";
        if (draft) {
            detail.draft = draft;
        }
        this.state.open = false;
        this.state.question = "";
        window.dispatchEvent(new CustomEvent("cleon-ai-open", { detail }));
    }

    async refreshSummary() {
        if (!this.state.context) {
            this.state.summary = null;
            return;
        }
        this.state.loading = true;
        try {
            this.state.summary = await this.orm.call(
                "cleon.ai.gateway",
                "get_assistant_state",
                [this.state.context || {}]
            );
        } catch (error) {
            this.notification.add(
                error?.data?.message || error.message || "Unable to prepare the assistant context.",
                { type: "danger" }
            );
        } finally {
            this.state.loading = false;
        }
    }

    async ask(suggestion = "") {
        const question = (suggestion || this.state.question).trim();
        if (!question) return;

        this.state.messages.push({ role: "user", text: question });
        this.state.question = "";

        try {
            const result = await this.orm.call(
                "cleon.ai.gateway",
                "ask_assistant",
                [question, this.state.context || {}]
            );
            const text = result.message || "No answer returned.";
            const hrFallback = !result.answered && result.provider && !result.provider.configured;
            this.state.messages.push({
                role: "assistant",
                text: hrFallback
                    ? "I'm not able to answer that right now. For help, please contact HR directly."
                    : text,
                hr_fallback: hrFallback,
                link: result.link || null,
                interaction_id: result.interaction_id || null,
            });
        } catch (error) {
            this.state.messages.push({
                role: "assistant",
                text: error?.data?.message || error.message || "The assistant could not answer this question.",
            });
        }
    }

    formatMessage(text) {
        return formatAssistantMarkdown(text);
    }

    onQuestionKeydown(event) {
        if (event.key === "Enter") {
            this.ask();
        }
    }

    async rateMessage(index, helpful) {
        const message = this.state.messages[index];
        if (!message?.interaction_id) {
            this.notification.add("This response has no stored interaction to rate.", { type: "warning" });
            return;
        }
        try {
            await this.orm.call("cleon.ai.gateway", "record_interaction_feedback", [message.interaction_id, helpful]);
        } catch (error) {
            this.notification.add(error?.data?.message || error.message || "Unable to save feedback.", { type: "danger" });
            return;
        }
        this.state.messageFeedback[index] = helpful;
        this.notification.add(helpful ? "Thank you — marked as helpful." : "Thank you — feedback noted.", { type: "success" });
    }

    async copySummary() {
        const text = (this.state.summary?.bullets || []).map((item) => `• ${item}`).join("\n");
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            this.notification.add("Current screen summary copied.", { type: "success" });
        } catch {
            this.notification.add("Your browser did not allow copying this summary.", { type: "warning" });
        }
    }

    emailSummary() {
        const body = encodeURIComponent(
            (this.state.summary?.bullets || []).map((item) => `• ${item}`).join("\n")
        );
        window.location.href = `mailto:?subject=${encodeURIComponent(this.state.context?.title || "CleonAI Summary")}&body=${body}`;
    }
}

registry.category("main_components").add("CleonAiAssistant", { Component: CleonAiAssistant });
