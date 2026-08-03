/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Staff Directory — People Tab OWL client action.
 * Fetches per-employee data from /hr_staff_directory/people and renders
 * the full People Tab UI (tab bar, stat cards, toolbar, data table, footer).
 * No Chart.js is used in this view.
 */
export class StaffDirectoryDashboard extends Component {
    static template = "hr_staff_directory.StaffDirectoryDashboard";

    setup() {
        this.rpc = useService("rpc");
        this.rootRef = useRef("root");

        // ─── Design Tokens ──────────────────────────────────────────────────
        this.AVATAR_COLORS = [
            '#ec4899', // pink
            '#8B5CF6', // purple
            '#22C55E', // green
            '#3B82F6', // blue
            '#F59E0B', // amber
            '#0EA5E9', // sky
            '#EF4444', // red
            '#14B8A6', // teal
        ];

        // Department → CSS key mapping (lowercase first word)
        this.DEPT_KEY_MAP = {
            'design':          'design',
            'finance':         'finance',
            'engineering':     'engineering',
            'human resources': 'hr',
            'hr':              'hr',
            'people':          'hr',
            'marketing':       'marketing',
            'sales':           'sales',
            'operations':      'operations',
            'product':         'product',
        };

        // Lifecycle state → human label
        this.LIFECYCLE_LABELS = {
            active:     'Active',
            probation:  'Probation',
            on_leave:   'On Leave',
            exiting:    'Exiting',
            suspended:  'Suspended',
            terminated: 'Terminated',
            alumni:     'Alumni',
        };

        // ─── Reactive State ──────────────────────────────────────────────────
        this.state = useState({
            loading:     true,
            activeTab:   'people',   // 'people' | 'org' | 'network'
            activeView:  'list',     // 'list' | 'grid'
            adminMode:   true,       // true = Admin (all cols), false = ESS (Manager + Actions hidden)
            searchQuery: '',
            people:      [],
            stats: {
                total:              0,
                active:             0,
                on_leave:           0,
                retention_priority: 0,
                probation:          0,
            },
        });

        onWillStart(async () => {
            await this._loadData();
        });

        onMounted(() => {
            // nothing chart-related to set up
        });

        onWillUnmount(() => {
            // clean-up if ever needed
        });
    }

    // ─── Data Loading ────────────────────────────────────────────────────────

    async _loadData() {
        try {
            const d = await this.rpc('/hr_staff_directory/people');
            this.state.stats  = d.stats  || this.state.stats;
            this.state.people = d.people || [];
        } catch (e) {
            console.error('[SDIR] people data load failed', e);
        } finally {
            this.state.loading = false;
        }
    }

    // ─── Filtered people (fuzzy search) ──────────────────────────────────────

    filteredPeople() {
        const q = (this.state.searchQuery || '').toLowerCase().trim();
        if (!q) {
            return this.state.people;
        }
        return this.state.people.filter((p) => {
            return (
                (p.name          || '').toLowerCase().includes(q) ||
                (p.job_title     || '').toLowerCase().includes(q) ||
                (p.department    || '').toLowerCase().includes(q) ||
                (p.work_location || '').toLowerCase().includes(q) ||
                (p.emp_ref       || '').toLowerCase().includes(q)
            );
        });
    }

    // ─── Format Helpers ──────────────────────────────────────────────────────

    num(n) {
        return (n ?? 0).toLocaleString();
    }

    initials(name) {
        if (!name) { return '?'; }
        return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    }

    avatarColor(name) {
        if (!name) { return this.AVATAR_COLORS[0]; }
        const idx = name.charCodeAt(0) % this.AVATAR_COLORS.length;
        return this.AVATAR_COLORS[idx];
    }

    deptKey(dept) {
        if (!dept) { return 'default'; }
        const lower = dept.toLowerCase();
        for (const [k, v] of Object.entries(this.DEPT_KEY_MAP)) {
            if (lower.startsWith(k) || lower.includes(k)) {
                return v;
            }
        }
        // Fallback: hash to one of the named keys for stable coloring
        const keys = Object.values(this.DEPT_KEY_MAP);
        return keys[dept.charCodeAt(0) % keys.length];
    }

    lifecycleLabel(state) {
        return this.LIFECYCLE_LABELS[state] || 'Active';
    }

    // ─── Event Handlers ──────────────────────────────────────────────────────

    onSearch(ev) {
        this.state.searchQuery = ev.target.value;
    }

    toggleTab(tab) {
        this.state.activeTab = tab;
    }

    toggleView(view) {
        this.state.activeView = view;
    }

    toggleAdminMode(isAdmin) {
        this.state.adminMode = isAdmin;
    }
}

registry.category("actions").add("hr_staff_directory.dashboard", StaffDirectoryDashboard);
