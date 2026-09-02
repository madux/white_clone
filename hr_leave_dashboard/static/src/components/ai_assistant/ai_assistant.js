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
            this.state.summary = null;
            this.state.messages = [];
            if (this.state.open && event.detail) this.refreshSummary();
        };
        this.detectContext = () => {
            const definitions = [
                [".o_cc_header", "leave_calendar", "Leave Calendar"],
                [".o_mlr_page", "leave_requests", "Leave Requests & Approvals"],
                [".cleon-btn-create-req", "leave_requests_admin", "Leave Requests — Admin"],
                [".o_lb_page", "leave_balances", "Leave Balance Management"],
                [".o_la_page", "leave_audit", "Leave Audit Log"],
                [".o_lr_page", "leave_reports", "Leave Reports"],
                [".o_leave_configuration", "leave_configuration", "Leave Configuration"],
                [".o_leave_unified_dashboard", "leave_dashboard", "Leave Dashboard"],
                [".o_ed_page", "employee_dashboard", "My Leave Dashboard"],
            ];
            const match = definitions.find(([selector]) => document.querySelector(selector));
            if (!match) {
                if (this.state.context) this.contextListener({ detail: null });
                return;
            }
            const [, screen, title] = match;
            if (this.state.context?.screen !== screen) {
                this.contextListener({ detail: { screen, title } });
            }
        };
        this.scheduleDetection = () => {
            cancelAnimationFrame(this.contextFrame);
            this.contextFrame = requestAnimationFrame(this.detectContext);
        };
        onMounted(() => {
            window.addEventListener("cleon-ai-context", this.contextListener);
            window.addEventListener("hashchange", this.scheduleDetection);
            this.observer = new MutationObserver(this.scheduleDetection);
            this.observer.observe(document.querySelector(".o_action_manager") || document.body, { childList: true, subtree: true });
            this.detectContext();
        });
        onWillUnmount(() => {
            window.removeEventListener("cleon-ai-context", this.contextListener);
            window.removeEventListener("hashchange", this.scheduleDetection);
            cancelAnimationFrame(this.contextFrame);
            this.observer?.disconnect();
        });
    }
    async toggle() {
        this.state.open = !this.state.open;
        if (this.state.open && this.state.context) await this.refreshSummary();
    }
    async refreshSummary() {
        if (!this.state.context) return;
        this.state.loading = true;
        try {
            this.state.summary = await this.orm.call("hr.leave.ai.service", "get_assistant_state", [this.state.context]);
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
            const result = await this.orm.call("hr.leave.ai.service", "ask_assistant", [question, this.state.context]);
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
            this.notification.add("Current screen summary copied.", { type: "success" });
        } catch {
            this.notification.add("Your browser did not allow copying this summary.", { type: "warning" });
        }
    }
    emailSummary() {
        const body = encodeURIComponent((this.state.summary?.bullets || []).map(item => `• ${item}`).join("\n"));
        window.location.href = `mailto:?subject=${encodeURIComponent(this.state.context?.title || "CleonHR Summary")}&body=${body}`;
    }
}

registry.category("main_components").add("CleonAiAssistant", { Component: CleonAiAssistant });
