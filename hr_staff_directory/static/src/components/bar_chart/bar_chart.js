/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class StaffDirectoryBarChart extends Component {
    static template = "hr_staff_directory.BarChart";
    static props = {
        people: { type: Array }
    };

    setup() {
        this.state = useState({
            barActiveSkill: null
        });
    }

    onBarSkillClick(skill) {
        if (this.state.barActiveSkill === skill) {
            this.state.barActiveSkill = null;
        } else {
            this.state.barActiveSkill = skill;
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
        const skillTotals = {}; // skill -> total count
        const matrix = {};      // skill -> { location -> count }
        
        const people = this.props.people;
        people.forEach(p => {
            const pSkillsStr = p.skills || '';
            const pSkills = pSkillsStr.split(',').map(s => s.trim()).filter(Boolean);
            const pLoc = p.work_location || 'Unknown';
            locationsSet.add(pLoc);
            
            pSkills.forEach(skill => {
                if (!matrix[skill]) matrix[skill] = {};
                matrix[skill][pLoc] = (matrix[skill][pLoc] || 0) + 1;
                skillTotals[skill] = (skillTotals[skill] || 0) + 1;
            });
        });

        const locations = Array.from(locationsSet).sort();
        
        // Sort skills by total descending
        const sortedSkills = Object.keys(skillTotals).sort((a, b) => skillTotals[b] - skillTotals[a]);
        
        // Top 30
        const top30 = sortedSkills.slice(0, 30);
        
        const maxTotal = top30.length > 0 ? skillTotals[top30[0]] : 1;
        
        const rows = top30.map(skill => {
            // build segments
            const segments = locations.map((loc, idx) => {
                const count = matrix[skill][loc] || 0;
                return {
                    location: loc,
                    count: count,
                    color: this.getLocationColor(idx),
                    widthPercent: (count / maxTotal) * 100
                };
            }).filter(s => s.count > 0);
            
            return {
                skill: skill,
                total: skillTotals[skill],
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
