/** @odoo-module **/

import { Component, markup, onMounted, onWillStart, onWillUnmount, useRef, useState, useEffect } from "@odoo/owl";
import { loadBundle } from "@web/core/assets";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Staff Directory Dashboard — OWL client action (Pattern B).
 * Fetches all dashboard data from the single /hr_staff_directory/data JSON
 * route and renders the workforce analytics dashboard inside the backend SPA.
 */
export class StaffDirectoryDashboard extends Component {
    static template = "hr_staff_directory.StaffDirectoryDashboard";

    setup() {
        this.user = useService("user");
        this.rpc = useService("rpc");

        // ─── Design Tokens ──────────────────────────────────────────────────
        this.C = {
            pink:    '#ec4899',
            cobalt:  '#3D5AFE',
            emerald: '#00C48C',
            amber:   '#FF8F00',
            purple:  '#8B5CF6',
            border:  '#EDEEF2',
            text1:   '#1A1D2E',
            textM:   '#9AA0B2',
            pinkA15: 'rgba(236,72,153,.15)',
            pinkA30: 'rgba(236,72,153,.30)',
            pinkA0:  'rgba(236,72,153,0)',
        };

        this.state = useState({
            loading: true,
            overview: {},
            alerts: {},
            headcount: {},
            dept: [],
            empGender: {},
            activities: [],
            bdayAnniv: { birthdays: [], anniversaries: [] },
            compliance: [],
            training: {},
            workLoc: {},
            probContracts: { probation: [], renewals: [] },
            perfSkills: { performance: {}, skills: [] },
            diversity: {},
            kpiTrends: {
                total:  { cls: 'sdir-trend-flat', label: '—' },
                active: { cls: 'sdir-trend-flat', label: '—' },
            },
            pendingDesc: '',
            sidebarCollapsed: sessionStorage.getItem('sdirSidebarCollapsed') === '1',
        });

        this.rootRef = useRef('root');
        this.chartRefs = {
            headcount:   useRef('chartHeadcount'),
            dept:        useRef('chartDept'),
            empType:     useRef('chartEmpType'),
            gender:      useRef('chartGender'),
            training:    useRef('chartTraining'),
            workLoc:     useRef('chartWorkLoc'),
            performance: useRef('chartPerformance'),
        };
        this.charts = {};
        this._chartDefaultsBackup = null;

        onWillStart(async () => {
            await loadBundle('web.chartjs_lib');
            // Save originals before overriding — restored in onWillUnmount
            // to avoid permanently affecting charts in other Odoo modules.
            this._chartDefaultsBackup = {
                fontFamily: Chart.defaults.font.family,
                fontSize:   Chart.defaults.font.size,
                color:      Chart.defaults.color,
            };
            Chart.defaults.font.family = "'DM Sans', sans-serif";
            Chart.defaults.font.size = 11;
            Chart.defaults.color = '#9AA0B2';
            await this._loadData();
        });

        onMounted(() => {
            this._renderAllCharts();
        });

        onWillUnmount(() => {
            Object.values(this.charts).forEach((c) => c && c.destroy());
            this.charts = {};
            // Restore Chart.js globals so other Odoo modules are unaffected.
            if (this._chartDefaultsBackup) {
                Chart.defaults.font.family = this._chartDefaultsBackup.fontFamily;
                Chart.defaults.font.size   = this._chartDefaultsBackup.fontSize;
                Chart.defaults.color       = this._chartDefaultsBackup.color;
                this._chartDefaultsBackup  = null;
            }
        });

        // Animate progress bars (compliance + skills) after they appear.
        useEffect(() => {
            if (this.state.loading) {
                return;
            }
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const root = this.rootRef.el;
                if (!root) {
                    return;
                }
                root.querySelectorAll('.sdir-progress-fill').forEach((bar) => {
                    bar.style.width = (bar.dataset.target || '0') + '%';
                });
            }));
        }, () => [this.state.loading]);
    }

    // ─── Sidebar Collapse ─────────────────────────────────────────────────────

    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        sessionStorage.setItem('sdirSidebarCollapsed', this.state.sidebarCollapsed ? '1' : '0');
    }

    // ─── Data Loading ────────────────────────────────────────────────────────

    async _loadData() {
        try {
            const d = await this.rpc('/hr_staff_directory/data');
            this.state.overview       = d.overview || {};
            this.state.alerts         = d.alerts || {};
            this.state.headcount      = d.headcount_trend || {};
            this.state.dept           = d.dept_distribution || [];
            this.state.empGender      = d.employment_gender || {};
            this.state.activities     = d.activities || [];
            this.state.bdayAnniv      = d.birthdays_anniversaries || { birthdays: [], anniversaries: [] };
            this.state.compliance     = d.compliance || [];
            this.state.training       = d.training || {};
            this.state.workLoc        = d.work_location || {};
            this.state.probContracts  = d.probation_contracts || { probation: [], renewals: [] };
            this.state.perfSkills     = d.performance_skills || { performance: {}, skills: [] };
            this.state.diversity      = d.diversity || {};
            this.state.kpiTrends      = this._computeKpiTrends(this.state.overview);
            this.state.pendingDesc    = this._pendingDesc(this.state.overview);
        } catch (e) {
            console.error('[SDIR] dashboard data load failed', e);
        } finally {
            this.state.loading = false;
        }
    }

    _computeKpiTrends(o) {
        const change = o.total_change;
        let total;
        if (change > 0) {
            total = { cls: 'sdir-trend-up', label: `▲ ${change}% vs last month` };
        } else if (change < 0) {
            total = { cls: 'sdir-trend-dn', label: `▼ ${Math.abs(change)}% vs last month` };
        } else {
            total = { cls: 'sdir-trend-flat', label: '— No change' };
        }
        const active = o.on_leave
            ? { cls: 'sdir-trend-flat', label: `${this.num(o.on_leave)} on leave today` }
            : { cls: 'sdir-trend-up', label: 'All present today' };
        return { total, active };
    }

    _pendingDesc(o) {
        const n = o.pending_approvals || 0;
        if (!n) {
            return 'Leave requests awaiting review';
        }
        return `${this.num(n)} leave request${n > 1 ? 's' : ''} awaiting review`;
    }

    // ─── Format Helpers ──────────────────────────────────────────────────────

    num(n) {
        return (n ?? 0).toLocaleString();
    }

    initials(name) {
        if (!name) {
            return '?';
        }
        return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    }

    escHtml(str) {
        if (!str) {
            return '';
        }
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    timeAgo(iso) {
        if (!iso) {
            return '';
        }
        const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
        if (diff < 60)   { return `${diff}s ago`; }
        if (diff < 3600) { return `${Math.round(diff / 60)}m ago`; }
        if (diff < 86400) { return `${Math.round(diff / 3600)}h ago`; }
        return `${Math.round(diff / 86400)}d ago`;
    }

    avatarHTML(id, name, size = 34) {
        const colors = [this.C.pink, this.C.cobalt, this.C.emerald, this.C.amber, this.C.purple, '#0EA5E9', '#F59E0B'];
        const bg = colors[(name || '').charCodeAt(0) % colors.length];
        const fs = Math.round(size * 0.36);
        const imgSrc = id ? `/web/image/hr.employee/${id}/image_128` : null;
        if (imgSrc) {
            return `<div class="sdir-avatar" style="width:${size}px;height:${size}px;background:${bg};">
                        <img src="${imgSrc}" alt="${this.escHtml(name)}" loading="lazy"
                             onerror="this.parentElement.textContent='${this.initials(name)}';"
                             style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;">
                    </div>`;
        }
        return `<div class="sdir-avatar" style="width:${size}px;height:${size}px;background:${bg};color:#fff;font-size:${fs}px;">
                    ${this.initials(name)}
                </div>`;
    }

    // ─── Donut legends ───────────────────────────────────────────────────────

    etLabels()   { return ['Full Time', 'Part Time', 'Contract']; }
    etData() {
        const t = this.state.empGender.employment_type || {};
        return [t.employee || 0, t.student || 0, t.freelance || 0];
    }
    etColors()   { return [this.C.pink, this.C.amber, this.C.cobalt]; }
    etLegendHTML() { return markup(this._donutLegend(this.etLabels(), this.etData(), this.etColors())); }

    genderLabels() { return ['Male', 'Female', 'Other']; }
    genderData() {
        const g = this.state.empGender.gender || {};
        return [g.male || 0, g.female || 0, g.other || 0];
    }
    genderColors() { return [this.C.cobalt, this.C.pink, this.C.emerald]; }
    genderLegendHTML() { return markup(this._donutLegend(this.genderLabels(), this.genderData(), this.genderColors())); }

    workLocLabels() { return ['Office', 'Remote', 'Field']; }
    workLocData() {
        const w = this.state.workLoc;
        return [w.office || 0, w.remote || 0, w.field || 0];
    }
    workLocColors() { return [this.C.cobalt, this.C.emerald, this.C.amber]; }
    workLocLegendHTML() { return markup(this._donutLegend(this.workLocLabels(), this.workLocData(), this.workLocColors())); }

    _donutLegend(labels, data, colors) {
        const total = data.reduce((a, b) => a + b, 0) || 1;
        return labels.map((lbl, i) => {
            if (!data[i]) {
                return '';
            }
            const pctVal = Math.round(data[i] / total * 100);
            return `
                <div class="sdir-legend-row">
                    <span class="sdir-legend-dot-name">
                        <span class="sdir-dot" style="background:${colors[i]};"></span>
                        ${lbl}
                    </span>
                    <span class="sdir-legend-val">${this.num(data[i])} &nbsp;<span style="color:${this.C.textM};font-weight:400;">(${pctVal}%)</span></span>
                </div>`;
        }).join('');
    }

    // ─── List sections ───────────────────────────────────────────────────────

    activitiesHTML() {
        const items = this.state.activities;
        if (!items || !items.length) {
            return markup('<div class="sdir-empty">No recent activities</div>');
        }
        return markup(items.map((a) => `
            <div class="sdir-list-row">
                ${this.avatarHTML(a.author_id, a.author, 34)}
                <div class="sdir-list-body">
                    <div class="sdir-list-name">${this.escHtml(a.author)}</div>
                    <div class="sdir-list-sub">${this.escHtml(a.body)}</div>
                </div>
                <div class="sdir-list-right">
                    <span style="font-size:11px;color:var(--text-m);">${this.timeAgo(a.date)}</span>
                </div>
            </div>`).join(''));
    }

    birthdaysHTML() {
        const bdays = this.state.bdayAnniv.birthdays || [];
        if (!bdays.length) {
            return markup('<div class="sdir-empty">No upcoming birthdays</div>');
        }
        return markup(bdays.map((b) => {
            const daysLbl = b.days_until === 0 ? 'Today! 🎉' : `in ${b.days_until}d`;
            return `
                <div class="sdir-list-row">
                    ${this.avatarHTML(b.id, b.name, 34)}
                    <div class="sdir-list-body">
                        <div class="sdir-list-name">${this.escHtml(b.name)}</div>
                        <div class="sdir-list-sub">${this.escHtml(b.department)}</div>
                    </div>
                    <div class="sdir-list-right">
                        <span class="sdir-date-badge">${this.escHtml(b.date)}</span>
                        <div style="font-size:10.5px;color:var(--text-m);text-align:right;margin-top:2px;">${daysLbl}</div>
                    </div>
                </div>`;
        }).join(''));
    }

    anniversariesHTML() {
        const annivs = this.state.bdayAnniv.anniversaries || [];
        if (!annivs.length) {
            return markup('<div class="sdir-empty">No upcoming anniversaries</div>');
        }
        return markup(annivs.map((a) => `
            <div class="sdir-list-row">
                ${this.avatarHTML(a.id, a.name, 34)}
                <div class="sdir-list-body">
                    <div class="sdir-list-name">${this.escHtml(a.name)}</div>
                    <div class="sdir-list-sub">${this.escHtml(a.department)}</div>
                </div>
                <div class="sdir-list-right">
                    <span class="sdir-year-badge">${a.years} yr${a.years > 1 ? 's' : ''}</span>
                    <div style="font-size:10.5px;color:var(--text-m);text-align:right;margin-top:2px;">${this.escHtml(a.date)}</div>
                </div>
            </div>`).join(''));
    }

    complianceHTML() {
        const items = this.state.compliance;
        if (!items || !items.length) {
            return markup('<div class="sdir-empty">Loading…</div>');
        }
        return markup(items.map((item) => `
            <div class="sdir-comp-item">
                <div class="sdir-comp-hd">
                    <span class="sdir-comp-lbl">${this.escHtml(item.label)}</span>
                    <span class="sdir-comp-val">${this.num(item.count)} &nbsp;<span style="color:var(--text-m);">${item.value}%</span></span>
                </div>
                <div class="sdir-progress">
                    <div class="sdir-progress-fill" style="width:0%;background:${item.color};"
                         data-target="${item.value}"></div>
                </div>
            </div>`).join(''));
    }

    probationHTML() {
        const prob = this.state.probContracts.probation || [];
        if (!prob.length) {
            return markup('<div class="sdir-empty">No employees in probation</div>');
        }
        return markup(prob.map((p) => {
            const pillClass = p.status === 'at_risk' ? 'sdir-pill-pink' : 'sdir-pill-green';
            const pillText  = p.status === 'at_risk' ? 'At Risk' : 'On Track';
            return `
                <div class="sdir-item-row">
                    <div>
                        <div class="sdir-item-name">${this.escHtml(p.name)}</div>
                        <div class="sdir-item-sub">${this.escHtml(p.job_title || p.department)}</div>
                    </div>
                    <div class="sdir-item-right">
                        <span class="sdir-pill ${pillClass}">${pillText}</span>
                        <span style="font-size:11px;color:var(--text-m);">${p.days_left}d left</span>
                    </div>
                </div>`;
        }).join(''));
    }

    renewalsHTML() {
        const contracts = this.state.probContracts.renewals || [];
        if (!contracts.length) {
            return markup('<div class="sdir-empty">No contracts due for renewal</div>');
        }
        return markup(contracts.map((c) => {
            const statusMap = { urgent: 'sdir-pill-pink', expiring: 'sdir-pill-amber', soon: 'sdir-pill-blue' };
            const textMap   = { urgent: 'Urgent',    expiring: 'Expiring',   soon: 'Soon' };
            const pillClass = statusMap[c.status] || 'sdir-pill-blue';
            const pillText  = textMap[c.status] || 'Soon';
            return `
                <div class="sdir-item-row">
                    <div>
                        <div class="sdir-item-name">${this.escHtml(c.name)}</div>
                        <div class="sdir-item-sub">${this.escHtml(c.contract_type)} · ends ${this.escHtml(c.end_date)}</div>
                    </div>
                    <div class="sdir-item-right">
                        <span class="sdir-pill ${pillClass}">${pillText}</span>
                        <span style="font-size:11px;color:var(--text-m);">${c.days_left}d away</span>
                    </div>
                </div>`;
        }).join(''));
    }

    skillsHTML() {
        const skills = this.state.perfSkills.skills || [];
        if (!skills.length) {
            return markup('<div class="sdir-empty">No skills recorded</div>');
        }
        return markup(skills.map((s) => `
            <div class="sdir-skill">
                <div class="sdir-skill-hd">
                    <span class="sdir-skill-name">${this.escHtml(s.name)}</span>
                    <span class="sdir-skill-pct">${s.score}%</span>
                </div>
                <div class="sdir-progress">
                    <div class="sdir-progress-fill" style="width:0%;background:var(--pink);"
                         data-target="${s.score}"></div>
                </div>
            </div>`).join(''));
    }

    diversityHTML() {
        const d = this.state.diversity;
        if (!d) {
            return markup('');
        }
        const items = [
            {
                val:   d.female_pct + '%',
                label: 'Female Representation',
                bg:    'rgba(236,72,153,.12)',
                color: 'var(--pink)',
                icon:  `<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17" cy="9" r="2" stroke="currentColor" stroke-width="1.6"/><path d="M14 19c0-2.21 1.343-4 3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
            },
            {
                val:   d.avg_age || '—',
                label: 'Average Age',
                bg:    'rgba(61,90,254,.10)',
                color: 'var(--cobalt)',
                icon:  `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 14h1l1-3 1.5 5L14 13l1 1h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            },
            {
                val:   d.international || 0,
                label: 'International Staff',
                bg:    'rgba(0,196,140,.10)',
                color: 'var(--emerald)',
                icon:  `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 3c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9M3 12h18" stroke="currentColor" stroke-width="1.4"/></svg>`,
            },
            {
                val:   d.nationalities || 1,
                label: 'Nationalities',
                bg:    'rgba(255,143,0,.10)',
                color: 'var(--amber)',
                icon:  `<svg viewBox="0 0 24 24" fill="none"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
            },
            {
                val:   d.disabled || 0,
                label: 'Disability Inclusive',
                bg:    'rgba(139,92,246,.10)',
                color: 'var(--purple)',
                icon:  `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v5l3 3M9 14.5l-2 4.5M15 14.5l2 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="17" r="4" stroke="currentColor" stroke-width="1.8"/></svg>`,
            },
        ];
        return markup(items.map((i) => `
            <div class="sdir-div-item">
                <div class="sdir-div-icon" style="background:${i.bg};color:${i.color};">
                    ${i.icon}
                </div>
                <div class="sdir-div-val">${i.val}</div>
                <div class="sdir-div-label">${i.label}</div>
            </div>`).join(''));
    }

    perfScorecard() {
        return (this.state.perfSkills.performance.scorecard_pct ?? 50) + '%';
    }

    perfImprovement() {
        return (this.state.perfSkills.performance.improvement_pct ?? 8) + '%';
    }

    // ─── Charts ──────────────────────────────────────────────────────────────

    _renderAllCharts() {
        this._chartHeadcount();
        this._chartDept();
        this._chartDonut('empType', this.etLabels(), this.etData(), this.etColors());
        this._chartDonut('gender', this.genderLabels(), this.genderData(), this.genderColors());
        this._chartTraining();
        this._chartDonut('workLoc', this.workLocLabels(), this.workLocData(), this.workLocColors());
        this._chartPerformance();
    }

    _chartDonut(key, labels, data, colors) {
        const canvas = this.chartRefs[key]?.el;
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (this.charts[key]) {
            this.charts[key].destroy();
        }
        const total = data.reduce((a, b) => a + b, 0) || 1;
        this.charts[key] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 5 }],
            },
            options: {
                cutout: '72%',
                responsive: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1A1D2E',
                        padding: 10,
                        callbacks: { label: (i) => ` ${i.label}: ${i.raw} (${Math.round(i.raw / total * 100)}%)` },
                    },
                },
            },
        });
    }

    _chartHeadcount() {
        const canvas = this.chartRefs.headcount?.el;
        const d = this.state.headcount;
        if (!canvas || !d || !d.categories || !d.categories.length) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (this.charts.headcount) {
            this.charts.headcount.destroy();
        }
        this.charts.headcount = new Chart(ctx, {
            type: 'line',
            data: {
                labels: d.categories,
                datasets: [{
                    label: 'Headcount',
                    data: d.data,
                    borderColor: this.C.pink,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: this.C.pink,
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    backgroundColor: (c) => {
                        const { ctx: cctx, chartArea } = c.chart;
                        if (!chartArea) {
                            return this.C.pinkA15;
                        }
                        const grad = cctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        grad.addColorStop(0, this.C.pinkA30);
                        grad.addColorStop(1, this.C.pinkA0);
                        return grad;
                    },
                    tension: 0.4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1A1D2E',
                        padding: 10,
                        callbacks: { label: (i) => ` ${i.raw} employees` },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'DM Sans'", size: 11 }, color: this.C.textM },
                    },
                    y: {
                        grid: { color: this.C.border, drawBorder: false },
                        ticks: { font: { family: "'DM Sans'", size: 11 }, color: this.C.textM, stepSize: 1 },
                        beginAtZero: false,
                    },
                },
            },
        });
    }

    _chartDept() {
        const canvas = this.chartRefs.dept?.el;
        const d = this.state.dept;
        if (!canvas || !d || !d.length) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (this.charts.dept) {
            this.charts.dept.destroy();
        }
        const names  = d.map((x) => x.name);
        const counts = d.map((x) => x.count);
        const bgs    = d.map((_, i) => (i % 2 === 0 ? this.C.pink : this.C.purple));
        this.charts.dept = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: names,
                datasets: [{
                    data: counts,
                    backgroundColor: bgs,
                    borderRadius: 5,
                    borderSkipped: false,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1A1D2E',
                        padding: 10,
                        callbacks: { label: (i) => ` ${i.raw} employees` },
                    },
                },
                scales: {
                    x: {
                        grid: { color: this.C.border },
                        ticks: { font: { family: "'DM Sans'", size: 10 }, color: this.C.textM },
                        beginAtZero: true,
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { family: "'DM Sans'", size: 11 }, color: '#5A6172' },
                    },
                },
            },
        });
    }

    _chartTraining() {
        const canvas = this.chartRefs.training?.el;
        const d = this.state.training;
        if (!canvas || !d || !d.categories || !d.categories.length) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (this.charts.training) {
            this.charts.training.destroy();
        }
        this.charts.training = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: d.categories,
                datasets: [
                    { label: 'Completed',   data: d.completed,   backgroundColor: this.C.emerald, borderRadius: 3 },
                    { label: 'In Progress', data: d.in_progress,  backgroundColor: this.C.amber,   borderRadius: 3 },
                    { label: 'Planned',     data: d.planned,      backgroundColor: this.C.pink,    borderRadius: 3 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: "'DM Sans'", size: 11 },
                            boxWidth: 10,
                            padding: 10,
                        },
                    },
                    tooltip: { backgroundColor: '#1A1D2E', padding: 10 },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'DM Sans'", size: 10 }, color: this.C.textM, maxRotation: 30 },
                    },
                    y: {
                        grid: { color: this.C.border },
                        ticks: { font: { family: "'DM Sans'", size: 10 }, color: this.C.textM, stepSize: 1 },
                        beginAtZero: true,
                    },
                },
            },
        });
    }

    _chartPerformance() {
        const canvas = this.chartRefs.performance?.el;
        const perf = this.state.perfSkills.performance || {};
        if (!canvas || !perf.categories || !perf.categories.length) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (this.charts.performance) {
            this.charts.performance.destroy();
        }
        const barColors = [this.C.emerald, this.C.cobalt, this.C.purple, this.C.amber, this.C.pink];
        this.charts.performance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: perf.categories,
                datasets: [{
                    label: 'Avg Rating',
                    data: perf.scores,
                    backgroundColor: perf.categories.map((_, i) => barColors[i % barColors.length]),
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1A1D2E',
                        padding: 10,
                        callbacks: { label: (i) => ` ${i.raw} / 5.0` },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'DM Sans'", size: 10 }, color: this.C.textM, maxRotation: 30 },
                    },
                    y: {
                        grid: { color: this.C.border },
                        ticks: { font: { family: "'DM Sans'", size: 10 }, color: this.C.textM },
                        beginAtZero: true,
                        max: 5,
                    },
                },
            },
        });
    }
}

registry.category("actions").add("hr_staff_directory.dashboard", StaffDirectoryDashboard);
