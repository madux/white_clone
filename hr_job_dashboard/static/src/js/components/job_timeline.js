/** @odoo-module **/

import { Component } from "@odoo/owl";

export class JobTimeline extends Component {
    static template = "hr_job_dashboard.JobTimeline";
    static props = {
        postedDaysAgo: Number,
        totalCandidates: Number,
        daysToClose: Number,
    };

    get postedLabel() {
        return this.props.postedDaysAgo === 0
            ? "Today"
            : `${this.props.postedDaysAgo} day${this.props.postedDaysAgo === 1 ? "" : "s"} ago`;
    }

    get candidatesLabel() {
        return `${this.props.totalCandidates} total candidate${this.props.totalCandidates === 1 ? "" : "s"}`;
    }

    get closeLabel() {
        return `${this.props.daysToClose} day${this.props.daysToClose === 1 ? "" : "s"} from now`;
    }
}
