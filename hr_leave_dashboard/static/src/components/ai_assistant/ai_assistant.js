/** @odoo-module **/

import { Component, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class CleonAiAssistant extends Component {
    static template = "hr_leave_dashboard.CleonAiAssistant";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({ open: false, loading: false, context: null, summary: null, question: "", messages: [] });
        this.contextListener = (event) => {
            this.state.context = event.detail;
            if (this.state.open && event.detail?.screen === "leave_calendar") this.refreshSummary();
        };
        onMounted(() => window.addEventListener("cleon-ai-context", this.contextListener));
        onWillUnmount(() => window.removeEventListener("cleon-ai-context", this.contextListener));
    }
    async toggle() {
        this.state.open = !this.state.open;
        if (this.state.open && this.state.context?.screen === "leave_calendar") await this.refreshSummary();
    }
    async refreshSummary() {
        if (this.state.context?.screen !== "leave_calendar") return;
        this.state.loading = true;
        try {
            this.state.summary = await this.orm.call("hr.leave.ai.service", "get_calendar_assistant_state", [this.state.context]);
        } catch (error) {
            this.notification.add(error?.data?.message || error.message || "Unable to prepare the assistant context.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }
    async ask(suggestion = "") {
        const question = (suggestion || this.state.question).trim();
        if (!question || !this.state.context) return;
        this.state.messages.push({ role: "user", text: question });
        this.state.question = "";
        try {
            const result = await this.orm.call("hr.leave.ai.service", "ask_calendar_assistant", [question, this.state.context]);
            this.state.messages.push({ role: "assistant", text: result.message });
        } catch (error) {
            this.state.messages.push({ role: "assistant", text: error?.data?.message || error.message || "The assistant could not answer this question." });
        }
    }
    onQuestionKeydown(event) {
        if (event.key === "Enter") this.ask();
    }
    async copySummary() {
        const text = (this.state.summary?.bullets || []).map(item => `• ${item}`).join("\n");
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            this.notification.add("Calendar summary copied.", { type: "success" });
        } catch {
            this.notification.add("Your browser did not allow copying this summary.", { type: "warning" });
        }
    }
    emailSummary() {
        const body = encodeURIComponent((this.state.summary?.bullets || []).map(item => `• ${item}`).join("\n"));
        window.location.href = `mailto:?subject=${encodeURIComponent("Leave Calendar Summary")}&body=${body}`;
    }
}

registry.category("main_components").add("CleonAiAssistant", { Component: CleonAiAssistant });
