/** @odoo-module **/

import { Component } from "@odoo/owl";

// members: [{ id, name, role, initials, color, online }]
export class HiringTeam extends Component {
    static template = "hr_job_dashboard.HiringTeam";
    static props = {
        members: { type: Array },
    };
}
