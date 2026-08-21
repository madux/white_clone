/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";

export class StaffDirectoryOrgAnalysis extends Component {
    static template = "hr_staff_directory.OrgAnalysis";
    static props = {
        people: { type: Array },
        closeAnalysis: { type: Function },
    };

    setup() {
        this.state = useState({
            kpi: {
                headcount: 0,
                departments: 0,
                teams: 0,
                spanOfControl: "0.0",
            },
        });

        onWillStart(() => {
            this.calculateKPIs(this.props.people);
        });

        onWillUpdateProps((nextProps) => {
            this.calculateKPIs(nextProps.people);
        });
    }

    calculateKPIs(people) {
        if (!people || people.length === 0) {
            this.state.kpi.headcount = 0;
            this.state.kpi.departments = 0;
            this.state.kpi.teams = 0;
            this.state.kpi.spanOfControl = "0.0";
            return;
        }

        const headcount = people.length;
        
        const depts = new Set();
        const managers = new Set();
        
        for (const p of people) {
            if (p.department) depts.add(p.department);
            // manager_id comes as [id, name] in Odoo, or a plain id if normalized.
            // Using truthy check. If it's an array, take the first element.
            if (p.manager_id) {
                const mgrId = Array.isArray(p.manager_id) ? p.manager_id[0] : p.manager_id;
                managers.add(mgrId);
            }
        }

        const departments = depts.size;
        const teams = managers.size;
        
        let spanOfControl = "0.0";
        if (teams > 0) {
            spanOfControl = (headcount / teams).toFixed(1);
        }

        this.state.kpi.headcount = headcount;
        this.state.kpi.departments = departments;
        this.state.kpi.teams = teams;
        this.state.kpi.spanOfControl = spanOfControl;
    }
}
