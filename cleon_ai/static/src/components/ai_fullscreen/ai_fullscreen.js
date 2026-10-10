/** @odoo-module **/

import { Component, onMounted, onPatched, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { formatAssistantMarkdown } from "@cleon_ai/js/markdown";
import {
    CLEON_CATEGORIES,
    CLEON_SUGGESTIONS,
    CLEON_TOPICS,
    cleonIcon,
} from "@cleon_ai/js/fullscreen_catalog";

const AVATAR = "/cleon_ai/static/src/img/cleon_avatar.png";

export class CleonAiFullscreen extends Component {
    static template = "cleon_ai.CleonAiFullscreen";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.categories = CLEON_CATEGORIES;
        this.topics = CLEON_TOPICS;
        this.avatar = AVATAR;
        this.threadRef = useRef("thread");
        this.composerRef = useRef("composer");
        this._messageCount = 0;
        this.state = useState({
            open: false,
            sidebarCollapsed: false,
            search: "",
            conversations: [],
            conversationId: null,
            context: null,
            summary: null,
            category: "all",
            suggestionsExpanded: false,
            messages: [],
            question: "",
            sending: false,
            promptsOpen: false,
            messageFeedback: {},
        });

        this.contextListener = (event) => {
            const detail = event && event.detail;
            if (!detail || typeof detail !== "object") {
                return;
            }
            const context = Object.assign({}, detail);
            delete context.ask;
            delete context.mode;
            delete context.draft;
            this.state.context = context;
        };

        this.openListener = async (event) => {
            const detail = event && event.detail;
            if (!detail || typeof detail !== "object" || detail.mode !== "fullscreen") {
                return;
            }
            const context = Object.assign({}, detail);
            const question = context.ask ? String(context.ask).trim() : "";
            const draft = context.draft ? String(context.draft).trim() : "";
            delete context.ask;
            delete context.mode;
            delete context.draft;
            this.state.context = context;
            this.state.open = true;
            this.state.conversationId = null;
            this.state.messages = [];
            this.state.question = question ? "" : draft;
            this.state.category = "all";
            this.state.suggestionsExpanded = false;
            this.state.promptsOpen = false;
            this.state.messageFeedback = {};
            this.state.summary = null;
            this._lockScroll(true);
            const jobs = [this.loadConversations()];
            if (context.screen) {
                jobs.push(this.refreshSummary());
            }
            if (question) {
                jobs.push(this.ask(question));
            }
            await Promise.all(jobs);
        };

        this.onKeydown = (event) => {
            if (!this.state.open || event.key !== "Escape") {
                return;
            }
            if (this.state.promptsOpen) {
                this.state.promptsOpen = false;
                return;
            }
            this.close();
        };

        this.onNavigationChange = () => {
            if (this.state.open) {
                this.close();
            }
        };

        onPatched(() => {
            if (this._messageCount === this.state.messages.length) {
                return;
            }
            this._messageCount = this.state.messages.length;
            const el = this.threadRef.el;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        });

        onMounted(() => {
            window.addEventListener("cleon-ai-context", this.contextListener);
            window.addEventListener("cleon-ai-open", this.openListener);
            window.addEventListener("keydown", this.onKeydown);
            window.addEventListener("hashchange", this.onNavigationChange);
        });

        onWillUnmount(() => {
            window.removeEventListener("cleon-ai-context", this.contextListener);
            window.removeEventListener("cleon-ai-open", this.openListener);
            window.removeEventListener("keydown", this.onKeydown);
            window.removeEventListener("hashchange", this.onNavigationChange);
            this._lockScroll(false);
        });
    }

    _lockScroll(locked) {
        document.body.style.overflow = locked ? "hidden" : "";
        document.body.classList.toggle("o_cfs_open", !!locked);
    }

    close() {
        this.state.open = false;
        this.state.promptsOpen = false;
        this._lockScroll(false);
    }

    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    }

    icon(name, size, color) {
        return cleonIcon(name, size, color);
    }

    formatMessage(text) {
        return formatAssistantMarkdown(text);
    }

    get connectedLabel() {
        const context = this.state.context || {};
        const kpis = context.kpis || {};
        let total = null;
        if (typeof kpis.total === "number") {
            total = kpis.total;
        } else if (typeof context.segment_count === "number") {
            total = context.segment_count;
        }
        if (total === null) {
            return "Online";
        }
        return "Online · " + total + " employee records connected";
    }

    get composerPlaceholder() {
        const screen = (this.state.context && this.state.context.screen) || "";
        if (screen.indexOf("staff_directory") === 0) {
            return "Show me employees ";
        }
        return "Ask anything…";
    }

    get canSend() {
        return !this.state.sending && !!(this.state.question || "").trim();
    }

    get filteredConversations() {
        const query = (this.state.search || "").trim().toLowerCase();
        if (!query) {
            return this.state.conversations;
        }
        return this.state.conversations.filter((row) => {
            const title = (row.title || "").toLowerCase();
            const preview = (row.preview || "").toLowerCase();
            return title.indexOf(query) !== -1 || preview.indexOf(query) !== -1;
        });
    }

    _suggestionPool() {
        const fromScreen = ((this.state.summary && this.state.summary.suggestions) || []).map((text, index) => ({
            id: "screen-" + index,
            text: text,
            icon: "sparkles",
            color: "#E91E8C",
            category: "all",
        }));
        if (this.state.category === "all") {
            return fromScreen.concat(CLEON_SUGGESTIONS);
        }
        return CLEON_SUGGESTIONS.filter((card) => card.category === this.state.category);
    }

    get visibleSuggestions() {
        const cards = this._suggestionPool();
        if (this.state.suggestionsExpanded) {
            return cards;
        }
        return cards.slice(0, 9);
    }

    get hasMoreSuggestions() {
        return this._suggestionPool().length > 9;
    }

    get quickPrompts() {
        return this._suggestionPool().slice(0, 4);
    }

    formatWhen(value) {
        if (!value) {
            return "";
        }
        const date = new Date(String(value).replace(" ", "T") + "Z");
        if (Number.isNaN(date.getTime())) {
            return "";
        }
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    conversationMark(conv) {
        const text = ((conv.title || "") + " " + (conv.preview || "")).toLowerCase();
        if (text.indexOf("leave") !== -1 || text.indexOf("attrition") !== -1) {
            return { name: "chart", color: "#3B82F6" };
        }
        if (text.indexOf("divers") !== -1 || text.indexOf("gender") !== -1) {
            return { name: "users", color: "#8B5CF6" };
        }
        if (text.indexOf("department") !== -1 || text.indexOf("org") !== -1) {
            return { name: "building", color: "#0EA5E9" };
        }
        if (text.indexOf("career") !== -1 || text.indexOf("productivity") !== -1) {
            return { name: "coffee", color: "#F59E0B" };
        }
        return { name: "chart", color: "#3B82F6" };
    }

    setCategory(categoryId) {
        this.state.category = categoryId;
        this.state.suggestionsExpanded = false;
    }

    toggleMoreSuggestions() {
        this.state.suggestionsExpanded = !this.state.suggestionsExpanded;
    }

    useTopic(topic) {
        this.state.question = topic.prompt;
        this.state.promptsOpen = false;
    }

    togglePrompts() {
        this.state.promptsOpen = !this.state.promptsOpen;
    }

    insertContextPrompt() {
        const title = (this.state.context && this.state.context.title) || "the current workspace";
        if (!(this.state.question || "").trim()) {
            this.state.question = "Using " + title + ", ";
        }
        this.state.promptsOpen = false;
    }

    newConversation() {
        this.state.conversationId = null;
        this.state.messages = [];
        this.state.question = "";
        this.state.promptsOpen = false;
        this.state.messageFeedback = {};
        const el = this.composerRef.el;
        if (el) {
            el.style.height = "auto";
        }
    }

    onSearchInput(ev) {
        this.state.search = ev.target.value || "";
    }

    onQuestionInput(ev) {
        const el = ev.target;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 140) + "px";
    }

    onQuestionKeydown(ev) {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            this.ask();
        }
    }

    async loadConversations() {
        try {
            this.state.conversations = await this.orm.call("cleon.ai.gateway", "list_conversations", []);
        } catch (error) {
            this.notification.add(
                (error && error.data && error.data.message) || error.message || "Unable to load conversations.",
                { type: "danger" }
            );
        }
    }

    async refreshSummary() {
        if (!this.state.context || !this.state.context.screen) {
            this.state.summary = null;
            return;
        }
        try {
            this.state.summary = await this.orm.call(
                "cleon.ai.gateway",
                "get_assistant_state",
                [this.state.context]
            );
        } catch (_error) {
            this.state.summary = null;
        }
    }

    async openConversation(conversationId) {
        if (this.state.sending || (conversationId === this.state.conversationId && this.state.messages.length)) {
            return;
        }
        this.state.promptsOpen = false;
        try {
            const thread = await this.orm.call("cleon.ai.gateway", "get_conversation", [conversationId]);
            this.state.conversationId = thread.id;
            this.state.messages = thread.messages || [];
            this.state.messageFeedback = {};
        } catch (error) {
            this.notification.add(
                (error && error.data && error.data.message) || error.message || "Unable to open that conversation.",
                { type: "danger" }
            );
        }
    }

    async deleteConversation(conv, ev) {
        ev.stopPropagation();
        ev.preventDefault();
        try {
            await this.orm.call("cleon.ai.gateway", "delete_conversation", [conv.id]);
            if (this.state.conversationId === conv.id) {
                this.newConversation();
            }
            await this.loadConversations();
        } catch (error) {
            this.notification.add(
                (error && error.data && error.data.message) || error.message || "Unable to delete that conversation.",
                { type: "danger" }
            );
        }
    }

    async ask(suggestion) {
        const question = String(suggestion || this.state.question || "").trim();
        if (!question || this.state.sending) {
            return;
        }
        this.state.messages.push({ role: "user", text: question.slice(0, 4000) });
        this.state.question = "";
        this.state.promptsOpen = false;
        this.state.sending = true;
        const el = this.composerRef.el;
        if (el) {
            el.style.height = "auto";
        }
        const context = Object.assign({}, this.state.context || {});
        delete context.mode;
        delete context.ask;
        if (this.state.conversationId) {
            context.conversation_id = this.state.conversationId;
        }
        try {
            const result = await this.orm.call(
                "cleon.ai.gateway",
                "ask_assistant",
                [question.slice(0, 4000), context]
            );
            if (result && result.conversation_id) {
                this.state.conversationId = result.conversation_id;
            }
            const text = (result && result.message) || "No answer returned.";
            const provider = result && result.provider;
            const hrFallback = result && !result.answered && provider && !provider.configured;
            this.state.messages.push({
                role: "assistant",
                text: hrFallback
                    ? "I'm not able to answer that right now. For help, please contact HR directly."
                    : text,
                interaction_id: result && result.interaction_id,
            });
            await this.loadConversations();
        } catch (error) {
            this.state.messages.push({
                role: "assistant",
                text: (error && error.data && error.data.message) || error.message || "The assistant could not answer this question.",
            });
        } finally {
            this.state.sending = false;
        }
    }

    async rateMessage(interactionId, helpful) {
        if (!interactionId) {
            return;
        }
        try {
            await this.orm.call("cleon.ai.gateway", "record_interaction_feedback", [interactionId, helpful]);
        } catch (error) {
            this.notification.add(
                (error && error.data && error.data.message) || error.message || "Unable to save feedback.",
                { type: "danger" }
            );
            return;
        }
        this.state.messageFeedback[interactionId] = helpful;
    }
}

registry.category("main_components").add("CleonAiFullscreen", { Component: CleonAiFullscreen });
