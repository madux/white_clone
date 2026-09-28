/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class StaffDirectoryHeatmap extends Component {
    static template = "hr_staff_directory.Heatmap";
    static props = {
        people: { type: Array },
        openProfile: { type: Function }
    };

    setup() {
        this.state = useState({
            heatmapActiveDepartment: null,
            heatmapActiveLocation: null,
        });
    }

    onHeatmapCellClick(department, location) {
        this.state.heatmapActiveDepartment = department;
        this.state.heatmapActiveLocation = location;
    }

    clearHeatmapFilter() {
        this.state.heatmapActiveDepartment = null;
        this.state.heatmapActiveLocation = null;
    }

    getHeatmapColor(value, max) {
        if (!value || value === 0) return '#FDF2F8';
        const minIntensity = 0.2;
        const intensity = minIntensity + ((value / max) * (1 - minIntensity));
        const r = Math.round(255 - (255 - 236) * intensity);
        const g = Math.round(255 - (255 - 72) * intensity);
        const b = Math.round(255 - (255 - 153) * intensity);
        return `rgb(${r}, ${g}, ${b})`;
    }

    get heatmapData() {
        const locations = new Set();
        const departments = new Set();
        const matrix = {};
        const colTotals = {};
        const rowTotals = {};
        let grandTotal = 0;
        let maxCount = 0;

        (this.props.people || []).forEach((p) => {
            const dept = (p.department || '').trim() || 'Unknown';
            const loc = (p.work_location || '').trim() || 'Unknown';
            locations.add(loc);
            departments.add(dept);
            if (!matrix[dept]) matrix[dept] = {};
            matrix[dept][loc] = (matrix[dept][loc] || 0) + 1;
            colTotals[loc] = (colTotals[loc] || 0) + 1;
            rowTotals[dept] = (rowTotals[dept] || 0) + 1;
            grandTotal++;
            if (matrix[dept][loc] > maxCount) {
                maxCount = matrix[dept][loc];
            }
        });

        const sortedLocations = Array.from(locations).sort();
        const sortedDepartments = Array.from(departments).sort();

        sortedDepartments.forEach((dept) => {
            sortedLocations.forEach((loc) => {
                if (!matrix[dept]) matrix[dept] = {};
                if (matrix[dept][loc] === undefined) matrix[dept][loc] = 0;
            });
        });

        sortedLocations.forEach((loc) => {
            if (colTotals[loc] === undefined) colTotals[loc] = 0;
        });

        return {
            locations: sortedLocations,
            departments: sortedDepartments,
            matrix,
            colTotals,
            rowTotals,
            grandTotal,
            maxCount
        };
    }

    get heatmapDrilldownData() {
        const department = this.state.heatmapActiveDepartment;
        const location = this.state.heatmapActiveLocation;
        if (!department || !location) return [];

        return (this.props.people || []).filter((p) => {
            const dept = (p.department || '').trim() || 'Unknown';
            const loc = (p.work_location || '').trim() || 'Unknown';
            return dept === department && loc === location;
        });
    }
}
