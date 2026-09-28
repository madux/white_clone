/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class StaffDirectoryBarChart extends Component {
    static template = "hr_staff_directory.BarChart";
    static props = {
        people: { type: Array }
    };

    setup() {
        this.state = useState({
            barActiveDepartment: null
        });
    }

    onBarDepartmentClick(department) {
        if (this.state.barActiveDepartment === department) {
            this.state.barActiveDepartment = null;
        } else {
            this.state.barActiveDepartment = department;
        }
    }

    getLocationColor(index) {
        const colors = [
            '#D946EF', // pink/magenta
            '#8B5CF6', // blue-violet
            '#10B981', // teal/green
            '#F59E0B', // orange/amber
            '#3B82F6', // blue
            '#EF4444', // red/crimson
            '#A855F7', // purple
            '#14B8A6', // teal
            '#F97316', // orange
            '#6366F1'  // indigo fallback
        ];
        return colors[index % colors.length];
    }

    get barChartData() {
        const locationsSet = new Set();
        const deptTotals = {};
        const matrix = {};

        (this.props.people || []).forEach((p) => {
            const dept = (p.department || '').trim() || 'Unknown';
            const loc = (p.work_location || '').trim() || 'Unknown';
            locationsSet.add(loc);
            if (!matrix[dept]) matrix[dept] = {};
            matrix[dept][loc] = (matrix[dept][loc] || 0) + 1;
            deptTotals[dept] = (deptTotals[dept] || 0) + 1;
        });

        const locations = Array.from(locationsSet).sort();
        const sortedDepts = Object.keys(deptTotals).sort((a, b) => deptTotals[b] - deptTotals[a]);
        const rowsSource = sortedDepts.slice(0, 30);
        const maxTotal = rowsSource.length > 0 ? deptTotals[rowsSource[0]] : 1;

        const rows = rowsSource.map((dept) => {
            const segments = locations.map((loc, idx) => {
                const count = matrix[dept][loc] || 0;
                return {
                    location: loc,
                    count: count,
                    color: this.getLocationColor(idx),
                    widthPercent: (count / maxTotal) * 100
                };
            }).filter((s) => s.count > 0);

            return {
                department: dept,
                total: deptTotals[dept],
                segments: segments
            };
        });

        return {
            locations: locations.map((loc, idx) => ({ name: loc, color: this.getLocationColor(idx) })),
            rows: rows,
            maxTotal: maxTotal
        };
    }
}
