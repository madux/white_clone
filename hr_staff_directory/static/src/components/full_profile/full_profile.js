/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class StaffDirectoryFullProfile extends Component {
    static template = "hr_staff_directory.StaffDirectoryFullProfile";
    static props = ["*"];

    setup() {
        this.state = useState({
            activeTab: 'overview',
            expandedYears: {},
            orgSearchQuery: '',
            timeOffSubTab: 'balance',
        });
        this.TIME_OFF_BAR_COLORS = ['#E91E8C', '#F59E0B', '#7C3AED', '#10B981'];
        this.messageService = useService("hr_staff_directory.message");
        this.mailModalService = useService("hr_staff_directory.mail_modal");
        this.AVATAR_COLORS = [
            '#ec4899', '#8B5CF6', '#22C55E', '#3B82F6', 
            '#F59E0B', '#0EA5E9', '#EF4444', '#14B8A6'
        ];
    }

    avatarColor(name) {
        if (!name) return this.AVATAR_COLORS[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % this.AVATAR_COLORS.length;
        return this.AVATAR_COLORS[index];
    }

    initials(name) {
        if (!name) return "";
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    truncate(text, max = 20) {
        const value = String(text || '').trim();
        if (value.length <= max) return value;
        return value.slice(0, max - 1) + '…';
    }

    get profile() {
        return this.props.activeProfile || {};
    }

    get firstName() {
        return String(this.profile.name || '').trim().split(' ')[0] || 'This employee';
    }

    get manager() {
        return this.props.activeProfileManager || null;
    }

    get directReports() {
        return this.props.activeProfileDirectReports || [];
    }

    get teamPeers() {
        const profile = this.profile;
        const people = this.props.people || [];
        if (!profile.manager_id) {
            return [];
        }
        return people.filter((person) => (
            person.manager_id === profile.manager_id && person.id !== profile.id
        ));
    }

    get filteredDirectReports() {
        const query = (this.state.orgSearchQuery || '').trim().toLowerCase();
        if (!query) {
            return this.directReports;
        }
        return this.directReports.filter((person) => {
            const haystack = [
                person.name,
                person.job_title,
                person.department,
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }

    get orgChildrenLineWidth() {
        const count = this.filteredDirectReports.length;
        if (count <= 1) {
            return 0;
        }
        return (count - 1) * 172;
    }

    get orgRoleHistory() {
        const profile = this.profile;
        const items = [];
        for (const group of profile.activity_timeline || []) {
            for (const event of group.events || []) {
                if (['hire', 'promotion', 'transfer'].includes(event.type)) {
                    items.push({
                        key: `${event.type}-${event.raw_date || event.date_str || event.title}`,
                        date: event.date_str || event.raw_date || '',
                        title: event.title,
                        desc: event.desc || '',
                    });
                }
            }
        }
        if (!items.length && (profile.start_date || profile.job_title)) {
            items.push({
                key: 'joined',
                date: profile.start_date || '',
                title: 'Joined organisation',
                desc: profile.job_title || '',
            });
        }
        return items;
    }

    onOrgSearchInput(ev) {
        this.state.orgSearchQuery = ev.target.value;
    }

    formatLeaveDays(days) {
        const value = Number(days);
        if (!Number.isFinite(value)) {
            return '0';
        }
        return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
    }

    _matchLeaveType(balances, keywords) {
        return (balances || []).find((item) => {
            const name = String(item.type || '').toLowerCase();
            return keywords.some((keyword) => name.includes(keyword));
        }) || null;
    }

    get timeOffBalances() {
        return this.profile.time_off_balances || [];
    }

    get timeOffSummary() {
        return this.profile.time_off_summary || {};
    }

    get timeOffKpis() {
        const balances = this.timeOffBalances;
        const summary = this.timeOffSummary;
        const annual = this._matchLeaveType(balances, ['annual', 'vacation', 'pto', 'paid time off', 'legal leave']);
        const sick = this._matchLeaveType(balances, ['sick']);
        return [
            {
                key: 'annual',
                label: 'Annual Balance',
                value: `${this.formatLeaveDays(annual ? annual.remaining : 0)}d`,
                subtitle: `${this.formatLeaveDays(annual ? annual.taken : 0)} used`,
                color: '#E91E8C',
            },
            {
                key: 'sick',
                label: 'Sick Leave',
                value: `${this.formatLeaveDays(sick ? sick.remaining : 0)}d`,
                subtitle: `${this.formatLeaveDays(sick ? sick.taken : 0)} used`,
                color: '#F59E0B',
            },
            {
                key: 'holidays',
                label: 'Public Holidays',
                value: `${this.formatLeaveDays(summary.public_holidays_total || 0)}d`,
                subtitle: `${this.formatLeaveDays(summary.public_holidays_remaining || 0)} remaining`,
                color: '#10B981',
            },
            {
                key: 'pending',
                label: 'Pending Requests',
                value: this.formatLeaveDays(summary.pending_count || 0),
                subtitle: 'awaiting approval',
                color: '#7C3AED',
            },
        ];
    }

    get timeOffBalanceRows() {
        return this.timeOffBalances.map((item, index) => {
            const allowance = Number(item.allowance) || 0;
            const taken = Number(item.taken) || 0;
            const remaining = Number(item.remaining) || 0;
            const pct = allowance > 0 ? Math.min(100, Math.max(0, (taken / allowance) * 100)) : 0;
            return {
                key: item.type || index,
                type: item.type,
                usedLabel: `${this.formatLeaveDays(taken)} used of ${this.formatLeaveDays(allowance)} days`,
                remainingLabel: `${this.formatLeaveDays(remaining)} remaining`,
                width: `${pct}%`,
                color: this.TIME_OFF_BAR_COLORS[index % this.TIME_OFF_BAR_COLORS.length],
            };
        });
    }

    get leaveHistory() {
        return this.profile.leave_history || [];
    }

    get upcomingLeaves() {
        return this.profile.upcoming_leaves || [];
    }

    setTimeOffSubTab(tab) {
        this.state.timeOffSubTab = tab;
    }

    onOrgNodeClick(person) {
        if (!person || !person.id || person.id === this.profile.id) {
            return;
        }
        if (this.props.openFullProfileById) {
            this.props.openFullProfileById(person.id);
        }
    }
}
