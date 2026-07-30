/** @odoo-module **/

import { Component } from "@odoo/owl";

export class CleonAIPanel extends Component {
    static template = "hr_job_dashboard.CleonAIPanel";
    static props = {
        candidateCount: Number,
        interviewCount: Number,
        shortlistSize: { type: Number, optional: true },
        onAction: { type: Function, optional: true },
    };
    static defaultProps = {
        shortlistSize: 8,
    };

    onActionClick(actionKey) {
        this.props.onAction && this.props.onAction(actionKey);
    }
}
