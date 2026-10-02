/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class SmartDateRecommendationsModal extends Component {
    static template = "hr_leave_dashboard.SmartDateRecommendationsModal";
    static props = {
        close: Function,
        onSelect: Function,
        initialTypeId: { type: [Number, String], optional: true },
        initialDuration: { type: Number, optional: true },
        types: { type: Array, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        const defaultType = this.props.initialTypeId
            ? String(this.props.initialTypeId)
            : (this.props.types && this.props.types[0] ? String(this.props.types[0].id) : "");

        this.state = useState({
            leave_type_id: defaultType,
            duration: this.props.initialDuration || 5,
            prioritize_holidays: true,
            prioritize_coverage: true,
            loading: true,
            suggestions: [],
            note: "",
            error: "",
        });

        onWillStart(() => this.fetchSuggestions());
    }

    async fetchSuggestions() {
        this.state.loading = true;
        this.state.error = "";
        try {
            const res = await this.orm.call(
                "hr.leave.ai.service",
                "suggest_leave_dates",
                [],
                {
                    leave_type_id: Number(this.state.leave_type_id) || false,
                    duration: Number(this.state.duration) || 5,
                    prioritize_holidays: Boolean(this.state.prioritize_holidays),
                    prioritize_coverage: Boolean(this.state.prioritize_coverage),
                }
            );
            if (res.ok) {
                this.state.suggestions = res.suggestions || [];
                this.state.note = res.note || "";
            } else {
                this.state.error = res.error || "Failed to calculate date recommendations.";
            }
        } catch (err) {
            this.state.error = err?.data?.message || err?.message || "Failed to load date recommendations.";
        } finally {
            this.state.loading = false;
        }
    }

    onSelectSuggestion(item) {
        if (this.props.onSelect) {
            this.props.onSelect(item);
        }
        this.props.close();
    }
}
