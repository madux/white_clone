/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUpdateProps, onWillUnmount, useState, useRef, useExternalListener } from "@odoo/owl";
import { loadJS } from "@web/core/assets";

export class StaffDirectoryOrgAnalysis extends Component {
    static template = "hr_staff_directory.OrgAnalysis";
    static props = {
        people: { type: Array },
        closeAnalysis: { type: Function },
    };

    setup() {
        this.deptChartRef = useRef("deptChart");
        this.gradeChartRef = useRef("gradeChart");
        this.typeChartRef = useRef("typeChart");
        this.modeChartRef = useRef("modeChart");
        this.spanChartRef = useRef("spanChart");

        this.charts = {
            dept: null,
            grade: null,
            type: null,
            mode: null,
            span: null,
        };

        this.state = useState({
            kpi: {
                headcount: 0,
                departments: 0,
                teams: 0,
                spanOfControl: "0.0",
            },
            locationData: [], // { name, count, pct, color, cx, cy }
            gradeData: [],
            typeData: [],
            modeData: [],
            isDateDropdownOpen: false,
            selectedDateRange: "Jan 1 – Dec 31, 2026"
        });

        useExternalListener(window, "click", this.onWindowClick);

        // Fixed location coordinates for the world map SVG (400x200 viewBox)
        this.LOC_COORDS = {
            'Remote — Global': { cx: 200, cy: 100 },
            'HQ New York': { cx: 117.7, cy: 56.1 },
            'Abuja Regional Office': { cx: 208, cy: 101.2 },
            'San Francisco Office': { cx: 64, cy: 60.2 },
            'London Office': { cx: 207.7, cy: 67.4 },
            'Singapore Office': { cx: 310, cy: 97.1 }
        };

        this.COLORS = [
            '#E91E8C', '#8B9CF0', '#4ECDC4', '#F7D560', 
            '#F4A460', '#6C7FD4', '#E7736A', '#9B7CD4', 
            '#4A90E2', '#87C9EB', '#B8C4D0'
        ];

        onWillStart(async () => {
            if (!window.Chart) {
                await loadJS("/web/static/lib/Chart/Chart.js");
            }
            this.processData(this.props.people);
        });

        onMounted(() => {
            window.requestAnimationFrame(() => {
                this.renderCharts();
            });
        });

        onWillUpdateProps((nextProps) => {
            this.processData(nextProps.people);
            this.updateCharts();
        });

        onWillUnmount(() => {
            Object.values(this.charts).forEach(c => {
                if (c) c.destroy();
            });
        });
    }

    onWindowClick(ev) {
        if (this.state.isDateDropdownOpen && !ev.target.closest('.sdir-oa-date-container')) {
            this.state.isDateDropdownOpen = false;
        }
    }

    toggleDateDropdown() {
        this.state.isDateDropdownOpen = !this.state.isDateDropdownOpen;
    }

    selectDateRange(range) {
        this.state.selectedDateRange = range;
        this.state.isDateDropdownOpen = false;
    }

    processData(people) {
        if (!people) people = [];
        const headcount = people.length;
        
        const depts = new Set();
        const managers = new Set();
        
        const deptCount = {};
        const gradeCount = {};
        const locCount = {};
        const typeCount = {};
        const modeCount = {};
        const spanCountMap = {}; // manager_id -> count

        for (const p of people) {
            // KPI Data
            if (p.department) depts.add(p.department);
            if (p.manager_id) {
                const mgrId = Array.isArray(p.manager_id) ? p.manager_id[0] : p.manager_id;
                managers.add(mgrId);
                spanCountMap[mgrId] = (spanCountMap[mgrId] || 0) + 1;
            }

            // Chart Data
            const d = p.department || 'Unknown';
            deptCount[d] = (deptCount[d] || 0) + 1;

            const g = p.grade || 'Other';
            gradeCount[g] = (gradeCount[g] || 0) + 1;

            const l = p.work_location || 'Remote — Global';
            locCount[l] = (locCount[l] || 0) + 1;

            const t = p.employee_type || (p.contract_id ? 'Permanent Full-Time' : 'Contract');
            typeCount[t] = (typeCount[t] || 0) + 1;

            const m = p.work_mode || 'Hybrid';
            modeCount[m] = (modeCount[m] || 0) + 1;
        }

        const teams = managers.size;
        this.state.kpi.headcount = headcount;
        this.state.kpi.departments = depts.size;
        this.state.kpi.teams = teams;
        this.state.kpi.spanOfControl = teams > 0 ? (headcount / teams).toFixed(1) : "0.0";

        // Span Buckets
        const spanBuckets = { '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '20+': 0 };
        Object.values(spanCountMap).forEach(count => {
            if (count <= 5) spanBuckets['1-5']++;
            else if (count <= 10) spanBuckets['6-10']++;
            else if (count <= 15) spanBuckets['11-15']++;
            else if (count <= 20) spanBuckets['16-20']++;
            else spanBuckets['20+']++;
        });

        // Format for Chart.js updates
        this.chartData = {
            dept: this.formatBarData(deptCount),
            grade: this.formatPieData(gradeCount),
            type: this.formatPieData(typeCount),
            mode: this.formatPieData(modeCount),
            span: {
                labels: Object.keys(spanBuckets),
                data: Object.values(spanBuckets)
            }
        };

        // Format for Vue state (Custom Legends / SVG)
        this.state.locationData = this.formatLocationData(locCount, headcount);
        this.state.gradeData = this.formatLegendData(gradeCount, headcount);
        this.state.typeData = this.formatLegendData(typeCount, headcount);
        this.state.modeData = this.formatLegendData(modeCount, headcount);
    }

    formatBarData(counts) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(i => i[0]),
            data: sorted.map(i => i[1])
        };
    }

    formatPieData(counts) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(i => i[0]),
            data: sorted.map(i => i[1]),
            colors: sorted.map((_, i) => this.COLORS[i % this.COLORS.length])
        };
    }

    formatLegendData(counts, total) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.map((i, idx) => ({
            name: i[0],
            count: i[1],
            pct: total > 0 ? Math.round((i[1] / total) * 100) : 0,
            color: this.COLORS[idx % this.COLORS.length]
        }));
    }

    formatLocationData(counts, total) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const otherCount = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
        const top = sorted.slice(0, 4).map((i, idx) => {
            const coords = this.LOC_COORDS[i[0]] || { cx: 200 + Math.random()*50, cy: 100 + Math.random()*50 };
            return {
                name: i[0],
                count: i[1],
                pct: total > 0 ? Math.round((i[1] / total) * 100) : 0,
                color: this.COLORS[idx % this.COLORS.length],
                cx: coords.cx,
                cy: coords.cy
            };
        });

        if (otherCount > 0) {
            top.push({
                name: `${sorted.length - 4} other locations`,
                count: otherCount,
                pct: total > 0 ? Math.round((otherCount / total) * 100) : 0,
                color: '#D1D5DB', // gray
                isOther: true
            });
        }
        return top;
    }

    renderCharts() {
        if (!window.Chart) return;

        // Common legend option for Chart.js v3/v4
        const noLegendObj = { display: false };

        // 1. Dept Chart (Horizontal Bar)
        if (this.deptChartRef.el) {
            this.charts.dept = new window.Chart(this.deptChartRef.el, {
                type: 'bar',
                data: {
                    labels: this.chartData.dept.labels,
                    datasets: [{
                        data: this.chartData.dept.data,
                        backgroundColor: '#8B9CF0',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: noLegendObj },
                    scales: {
                        x: { grid: { display: false }, beginAtZero: true },
                        y: { grid: { display: false } }
                    }
                }
            });
        }

        // 2. Grade Chart (Doughnut)
        if (this.gradeChartRef.el) {
            this.charts.grade = new window.Chart(this.gradeChartRef.el, {
                type: 'doughnut',
                data: {
                    labels: this.chartData.grade.labels,
                    datasets: [{
                        data: this.chartData.grade.data,
                        backgroundColor: this.chartData.grade.colors,
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: noLegendObj }, cutout: '75%' }
            });
        }

        // 3. Type Chart (Doughnut)
        if (this.typeChartRef.el) {
            this.charts.type = new window.Chart(this.typeChartRef.el, {
                type: 'doughnut',
                data: {
                    labels: this.chartData.type.labels,
                    datasets: [{
                        data: this.chartData.type.data,
                        backgroundColor: this.chartData.type.colors,
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: noLegendObj }, cutout: '75%' }
            });
        }

        // 4. Mode Chart (Doughnut)
        if (this.modeChartRef.el) {
            this.charts.mode = new window.Chart(this.modeChartRef.el, {
                type: 'doughnut',
                data: {
                    labels: this.chartData.mode.labels,
                    datasets: [{
                        data: this.chartData.mode.data,
                        backgroundColor: this.chartData.mode.colors,
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: noLegendObj }, cutout: '75%' }
            });
        }

        // 5. Span Chart (Vertical Bar)
        if (this.spanChartRef.el) {
            this.charts.span = new window.Chart(this.spanChartRef.el, {
                type: 'bar',
                data: {
                    labels: this.chartData.span.labels,
                    datasets: [{
                        data: this.chartData.span.data,
                        backgroundColor: '#A0AADF',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: noLegendObj },
                    scales: {
                        x: { grid: { display: false } },
                        y: { grid: { display: true, borderDash: [5, 5] }, beginAtZero: true }
                    }
                }
            });
        }
    }

    updateCharts() {
        if (!window.Chart) return;
        
        if (this.charts.dept) {
            this.charts.dept.data.labels = this.chartData.dept.labels;
            this.charts.dept.data.datasets[0].data = this.chartData.dept.data;
            this.charts.dept.update();
        }
        if (this.charts.grade) {
            this.charts.grade.data.labels = this.chartData.grade.labels;
            this.charts.grade.data.datasets[0].data = this.chartData.grade.data;
            this.charts.grade.data.datasets[0].backgroundColor = this.chartData.grade.colors;
            this.charts.grade.update();
        }
        if (this.charts.type) {
            this.charts.type.data.labels = this.chartData.type.labels;
            this.charts.type.data.datasets[0].data = this.chartData.type.data;
            this.charts.type.data.datasets[0].backgroundColor = this.chartData.type.colors;
            this.charts.type.update();
        }
        if (this.charts.mode) {
            this.charts.mode.data.labels = this.chartData.mode.labels;
            this.charts.mode.data.datasets[0].data = this.chartData.mode.data;
            this.charts.mode.data.datasets[0].backgroundColor = this.chartData.mode.colors;
            this.charts.mode.update();
        }
        if (this.charts.span) {
            this.charts.span.data.labels = this.chartData.span.labels;
            this.charts.span.data.datasets[0].data = this.chartData.span.data;
            this.charts.span.update();
        }
    }
}
