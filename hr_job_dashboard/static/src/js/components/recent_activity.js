/** @odoo-module **/

import { Component } from "@odoo/owl";

// activities: [{ id, icon, colorClass, title, timeLabel }]
export class RecentActivity extends Component {
    static template = "hr_job_dashboard.RecentActivity";
    static props = {
        activities: { type: Array },
    };
}
