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
            heatmapActiveSkill: null,
            heatmapActiveLocation: null,
        });
    }

    onHeatmapCellClick(skill, location) {
        this.state.heatmapActiveSkill = skill;
        this.state.heatmapActiveLocation = location;
    }

    clearHeatmapFilter() {
        this.state.heatmapActiveSkill = null;
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
        const skills = new Set();
        const matrix = {}; 
        const colTotals = {};
        const rowTotals = {};
        let grandTotal = 0;
        let maxCount = 0;

        const people = this.props.people;
        people.forEach(p => {
            const pSkillsStr = p.skills || '';
            const pSkills = pSkillsStr.split(',').map(s => s.trim()).filter(Boolean);
            const pLoc = p.work_location || 'Unknown';
            locations.add(pLoc);
            
            pSkills.forEach(skill => {
                skills.add(skill);
                if (!matrix[skill]) matrix[skill] = {};
                matrix[skill][pLoc] = (matrix[skill][pLoc] || 0) + 1;
                
                colTotals[pLoc] = (colTotals[pLoc] || 0) + 1;
                rowTotals[skill] = (rowTotals[skill] || 0) + 1;
                grandTotal++;
                
                if (matrix[skill][pLoc] > maxCount) {
                    maxCount = matrix[skill][pLoc];
                }
            });
        });

        const sortedLocations = Array.from(locations).sort();
        const sortedSkills = Array.from(skills).sort();

        sortedSkills.forEach(skill => {
            sortedLocations.forEach(loc => {
                if (!matrix[skill]) matrix[skill] = {};
                if (matrix[skill][loc] === undefined) matrix[skill][loc] = 0;
            });
        });

        sortedLocations.forEach(loc => {
            if (colTotals[loc] === undefined) colTotals[loc] = 0;
        });

        return {
            locations: sortedLocations,
            skills: sortedSkills,
            matrix,
            colTotals,
            rowTotals,
            grandTotal,
            maxCount
        };
    }

    get heatmapDrilldownData() {
        const skill = this.state.heatmapActiveSkill;
        const location = this.state.heatmapActiveLocation;
        if (!skill || !location) return [];

        return this.props.people.filter(p => {
            const pSkills = (p.skills || '').split(',').map(s => s.trim());
            const pLoc = p.work_location || 'Unknown';
            return pSkills.includes(skill) && pLoc === location;
        });
    }
}
