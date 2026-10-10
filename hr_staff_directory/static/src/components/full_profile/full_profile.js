/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, onWillUpdateProps, useExternalListener, useRef, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

const DEFAULT_TAB_VISIBILITY = {
    org_chart: true,
    time_off: true,
    relationships: true,
    activity: true,
    calendar: true,
    assets: true,
    connect: true,
};

export class StaffDirectoryFullProfile extends Component {
    static template = "hr_staff_directory.StaffDirectoryFullProfile";
    static props = ["*"];

    colleagueTabs = [
        { key: 'org_chart', label: 'Org Chart', desc: 'Reporting line, peers & embedded org chart' },
        { key: 'time_off', label: 'Time Off', desc: 'Leave balances, requests & absence calendar' },
        { key: 'relationships', label: 'Relationships', desc: 'Relationship network & collaborator groups' },
        { key: 'activity', label: 'Activity', desc: 'Projects, role history & timeline feed' },
        { key: 'calendar', label: 'Calendar', desc: 'Availability, working hours & time zone' },
        { key: 'assets', label: 'Assets', desc: 'Assigned equipment & hardware' },
        { key: 'connect', label: 'Connect', desc: 'Contact methods & communication channels' },
    ];

    setup() {
        const now = new Date();
        this.state = useState({
            activeTab: this.props.initialTab || 'overview',
            expandedYears: {},
            orgSearchQuery: '',
            timeOffSubTab: 'balance',
            calYear: now.getFullYear(),
            calMonth: now.getMonth(),
            showAllCalEvents: false,
            showAvailMenu: false,
            availabilityOverride: null,
            openMeetingMenu: null,
            localTime: '',
            assetQuery: '',
            assetPage: 1,
            showVisibilityMenu: false,
            visibilityMenuStyle: { top: '0px', right: '0px' },
            tabVisibility: Object.assign({}, DEFAULT_TAB_VISIBILITY, this.props.profileTabVisibility || {}),
        });
        this.visibilityRef = useRef("visibilityMenu");
        this._ignoreNextVisibilityOutside = false;
        useExternalListener(window, "click", this._onWindowClick);
        useExternalListener(window, "keydown", this._onWindowKeydown);
        this.TIME_OFF_BAR_COLORS = ['#E91E8C', '#F59E0B', '#7C3AED', '#10B981'];
        this.messageService = useService("hr_staff_directory.message");
        this.mailModalService = useService("hr_staff_directory.mail_modal");
        this.orm = useService("orm");
        this.toast = useService("hr_staff_directory.toast");
        this.AVATAR_COLORS = [
            '#ec4899', '#8B5CF6', '#22C55E', '#3B82F6', 
            '#F59E0B', '#0EA5E9', '#EF4444', '#14B8A6'
        ];
        this.state.localTime = this._formatLocalTime();
        onWillStart(async () => {
            await this.loadTabVisibility();
        });
        onWillUpdateProps((nextProps) => {
            if (nextProps.profileTabVisibility) {
                Object.assign(this.state.tabVisibility, nextProps.profileTabVisibility);
                this._ensureActiveTabVisible();
            }
            if (nextProps.activeProfile && nextProps.activeProfile.id !== this.props.activeProfile?.id) {
                this.state.activeTab = nextProps.initialTab || 'overview';
                this._ensureActiveTabVisible();
                Promise.resolve().then(() => this.emitProfileAiContext());
            } else if (nextProps.initialTab && nextProps.initialTab !== this.props.initialTab) {
                this.state.activeTab = nextProps.initialTab;
                this._ensureActiveTabVisible();
            }
        });
        onMounted(() => {
            this._clockTimer = setInterval(() => {
                this.state.localTime = this._formatLocalTime();
            }, 1000);
            this.emitProfileAiContext();
        });
        onWillUnmount(() => {
            if (this._clockTimer) {
                clearInterval(this._clockTimer);
            }
        });
    }

    buildProfileAiContext() {
        const p = this.props.activeProfile || {};
        const tos = p.time_off_summary;
        let leave_summary = '';
        if (typeof tos === 'string') {
            leave_summary = tos;
        } else if (tos && typeof tos === 'object') {
            const pending = tos.pending_count ?? 0;
            const remaining = tos.public_holidays_remaining ?? tos.public_holidays_total ?? 0;
            leave_summary = `${pending} pending leave request(s); ~${remaining} public holiday(s) remaining`;
        }
        return {
            screen: 'staff_directory.profile',
            title: p.name || 'Employee Profile',
            employee_id: p.id,
            employee_name: p.name || '',
            department: p.department || '',
            job_title: p.job_title || '',
            lifecycle: p.lifecycle_state || '',
            leave_summary,
        };
    }

    emitProfileAiContext() {
        if (!this.props.activeProfile?.id) {
            return;
        }
        window.dispatchEvent(new CustomEvent('cleon-ai-context', {
            detail: this.buildProfileAiContext(),
        }));
    }

    openCleonAi(ask = '') {
        const detail = this.buildProfileAiContext();
        const first = (detail.employee_name || 'this person').split(' ')[0];
        const question = (ask || '').trim() || `Summarize ${first}'s profile`;
        detail.ask = question;
        detail.mode = 'fullscreen';
        window.dispatchEvent(new CustomEvent('cleon-ai-open', { detail }));
    }

    isTabVisible(key) {
        if (key === 'overview') {
            return true;
        }
        return this.state.tabVisibility[key] !== false;
    }

    _ensureActiveTabVisible() {
        if (!this.isTabVisible(this.state.activeTab)) {
            this.state.activeTab = 'overview';
        }
    }

    async loadTabVisibility() {
        let data = null;
        try {
            data = await this.orm.call('hr.employee', 'get_staff_directory_tab_visibility', []);
        } catch (e) {
            data = await this._loadTabVisibilityFallback();
        }
        if (data) {
            Object.assign(this.state.tabVisibility, data);
        } else if (this.props.profileTabVisibility) {
            Object.assign(this.state.tabVisibility, this.props.profileTabVisibility);
        }
        this._ensureActiveTabVisible();
    }

    async _loadTabVisibilityFallback() {
        try {
            const raw = await this.orm.call(
                'ir.config_parameter',
                'get_param',
                ['hr_staff_directory.profile_tab_visibility']
            );
            if (!raw) {
                return null;
            }
            const stored = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return stored && typeof stored === 'object' ? stored : null;
        } catch (e) {
            return null;
        }
    }

    async _persistTabVisibility(key, visible, payload) {
        try {
            return await this.orm.call(
                'hr.employee',
                'set_staff_directory_tab_visibility',
                [key, visible]
            );
        } catch (e) {
            await this.orm.call(
                'ir.config_parameter',
                'set_param',
                ['hr_staff_directory.profile_tab_visibility', JSON.stringify(payload)]
            );
            return payload;
        }
    }

    toggleVisibilityMenu(ev) {
        if (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        }
        const next = !this.state.showVisibilityMenu;
        this.state.showVisibilityMenu = next;
        if (next) {
            this._ignoreNextVisibilityOutside = true;
            this._positionVisibilityMenu();
        }
    }

    _positionVisibilityMenu() {
        const root = this.visibilityRef.el;
        const btn = root && root.querySelector('.sdir-fp-visibility-btn');
        const rect = (btn || root) && (btn || root).getBoundingClientRect();
        if (!rect) {
            return;
        }
        this.state.visibilityMenuStyle = {
            top: `${Math.round(rect.bottom + 8)}px`,
            right: `${Math.round(window.innerWidth - rect.right)}px`,
        };
    }

    _onWindowClick(ev) {
        if (this._ignoreNextVisibilityOutside) {
            this._ignoreNextVisibilityOutside = false;
            return;
        }
        if (!this.state.showVisibilityMenu) {
            return;
        }
        const root = this.visibilityRef.el;
        if (root && root.contains(ev.target)) {
            return;
        }
        this.state.showVisibilityMenu = false;
    }

    _onWindowKeydown(ev) {
        if (ev.key === 'Escape' && this.state.showVisibilityMenu) {
            this.state.showVisibilityMenu = false;
        }
    }

    async toggleColleagueTab(key, ev) {
        if (ev) {
            ev.stopPropagation();
        }
        if (!(key in DEFAULT_TAB_VISIBILITY)) {
            return;
        }
        const next = !this.isTabVisible(key);
        this.state.tabVisibility[key] = next;
        this._ensureActiveTabVisible();
        if (this.props.onTabVisibilityChange) {
            this.props.onTabVisibilityChange(Object.assign({}, this.state.tabVisibility));
        }
        try {
            const data = await this._persistTabVisibility(
                key,
                next,
                Object.assign({}, this.state.tabVisibility)
            );
            if (data) {
                Object.assign(this.state.tabVisibility, data);
                this._ensureActiveTabVisible();
                if (this.props.onTabVisibilityChange) {
                    this.props.onTabVisibilityChange(Object.assign({}, this.state.tabVisibility));
                }
            }
        } catch (e) {
            this.state.tabVisibility[key] = !next;
            this._ensureActiveTabVisible();
            if (this.props.onTabVisibilityChange) {
                this.props.onTabVisibilityChange(Object.assign({}, this.state.tabVisibility));
            }
            if (this.toast) {
                this.toast.show('error', 'Could not update tab visibility');
            }
        }
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

    _personProjects(person) {
        const projects = person && person.current_projects;
        if (Array.isArray(projects)) {
            return projects.map((item) => (item && item.title) || '').filter(Boolean);
        }
        if (typeof projects === 'string') {
            return projects.split(',').map((item) => item.trim()).filter(Boolean);
        }
        return [];
    }

    _personSkills(person) {
        const skills = person && person.skills;
        if (Array.isArray(skills)) {
            return skills.map((item) => String(item).trim()).filter(Boolean);
        }
        if (typeof skills === 'string') {
            return skills.split(',').map((item) => item.trim()).filter(Boolean);
        }
        return [];
    }

    relMeta(person) {
        const title = (person && person.job_title) || '';
        const dept = (person && person.department) || '';
        if (title && dept) {
            return `${title} · ${dept}`;
        }
        return title || dept || '';
    }

    get relationshipExcludeIds() {
        const ids = new Set([this.profile.id]);
        if (this.manager) {
            ids.add(this.manager.id);
        }
        for (const person of this.directReports) {
            ids.add(person.id);
        }
        for (const person of this.teamPeers) {
            ids.add(person.id);
        }
        return ids;
    }

    get crossFunctionalCollaborators() {
        const profile = this.profile;
        const ownDept = (profile.department || '').trim();
        const exclude = this.relationshipExcludeIds;
        const ownProjects = new Set(this._personProjects(profile));
        const ownSkills = new Set(this._personSkills(profile));
        const candidates = (this.props.people || []).filter((person) => {
            if (!person || exclude.has(person.id)) {
                return false;
            }
            const dept = (person.department || '').trim();
            return Boolean(dept && ownDept && dept !== ownDept);
        });

        const scored = candidates.map((person) => {
            let score = 0;
            if (profile.work_location && person.work_location === profile.work_location) {
                score += 2;
            }
            for (const project of this._personProjects(person)) {
                if (ownProjects.has(project)) {
                    score += 3;
                }
            }
            for (const skill of this._personSkills(person)) {
                if (ownSkills.has(skill)) {
                    score += 1;
                }
            }
            return { person, score };
        });

        scored.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return String(a.person.name || '').localeCompare(String(b.person.name || ''));
        });

        const picked = [];
        const seenDepts = new Set();
        for (const row of scored) {
            const dept = row.person.department;
            if (!seenDepts.has(dept)) {
                picked.push(row.person);
                seenDepts.add(dept);
            }
        }
        for (const row of scored) {
            if (picked.length >= 8) {
                break;
            }
            if (!picked.includes(row.person)) {
                picked.push(row.person);
            }
        }
        return picked.slice(0, 8);
    }

    get relationshipKpis() {
        const manager = this.manager ? 1 : 0;
        const reports = this.directReports.length;
        const peers = this.teamPeers.length;
        const collaborators = this.crossFunctionalCollaborators;
        const depts = new Set();
        if (this.profile.department) {
            depts.add(this.profile.department);
        }
        if (this.manager && this.manager.department) {
            depts.add(this.manager.department);
        }
        for (const person of [...this.directReports, ...this.teamPeers, ...collaborators]) {
            if (person.department) {
                depts.add(person.department);
            }
        }
        return [
            {
                key: 'network',
                label: 'Network Size',
                value: manager + reports + peers + collaborators.length,
                subtitle: 'Direct connections',
                tone: 'pink',
            },
            {
                key: 'reports',
                label: 'Direct Reports',
                value: reports,
                subtitle: 'Reporting to this person',
                tone: 'blue',
            },
            {
                key: 'coverage',
                label: 'Dept Coverage',
                value: depts.size,
                subtitle: 'Departments reached',
                tone: 'purple',
            },
            {
                key: 'cross',
                label: 'Cross-Functional',
                value: collaborators.length,
                subtitle: 'External collaborators',
                tone: 'green',
            },
        ];
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

    get calendarProfile() {
        return this.profile.calendar || {};
    }

    get calendarEvents() {
        return this.calendarProfile.events || [];
    }

    get visibleCalendarEvents() {
        if (this.state.showAllCalEvents) {
            return this.calendarEvents;
        }
        return this.calendarEvents.slice(0, 4);
    }

    get upcomingMeetingGroups() {
        const groups = [];
        const byDate = new Map();
        for (const event of this.visibleCalendarEvents) {
            const dateKey = event.date || '';
            if (!byDate.has(dateKey)) {
                byDate.set(dateKey, []);
            }
            byDate.get(dateKey).push({
                ...event,
                stack: this.meetingAttendeeStack(event),
                badgeClass: this.meetingCategoryClass(event.category),
            });
        }
        for (const [dateKey, items] of byDate.entries()) {
            groups.push({
                key: dateKey || 'undated',
                label: this.formatMeetingDayLabel(dateKey),
                items,
            });
        }
        return groups;
    }

    formatMeetingDayLabel(dateStr) {
        if (!dateStr) {
            return 'Upcoming';
        }
        const d = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(d.getTime())) {
            return dateStr;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(d);
        target.setHours(0, 0, 0, 0);
        const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
        const long = d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
        if (diff === 0) {
            return `Today • ${long}`;
        }
        if (diff === 1) {
            return `Tomorrow • ${long}`;
        }
        return long;
    }

    meetingAttendeeStack(event) {
        const attendees = event.attendees || [];
        const shown = attendees.slice(0, 3);
        const extra = Math.max(0, attendees.length - 3);
        return {
            shown: shown.map((person, index) => ({
                key: `${event.id}-${person.id || person.name || index}`,
                name: person.name,
                initial: this.initials(person.name).charAt(0) || '?',
                color: this.avatarColor(person.name),
                first: index === 0,
            })),
            extra,
        };
    }

    meetingCategoryClass(category) {
        const value = String(category || '').toLowerCase();
        if (value === 'team') {
            return 'team';
        }
        if (value === 'personal') {
            return 'personal';
        }
        return 'internal';
    }

    get availabilityStatus() {
        if (this.state.availabilityOverride) {
            return this.state.availabilityOverride;
        }
        const life = String(this.profile.lifecycle_state || '').toLowerCase().replace(/[^a-z]/g, '');
        if (life === 'onleave') {
            return 'On Leave';
        }
        return this.profile.availability || 'Available';
    }

    get availabilityTone() {
        const value = String(this.availabilityStatus || '').toLowerCase();
        if (value.includes('leave')) {
            return 'onleave';
        }
        if (value.includes('busy')) {
            return 'busy';
        }
        return 'available';
    }

    get availabilitySubtitle() {
        return this.profile.last_active || '';
    }

    get calendarWorkingHours() {
        return this.calendarProfile.working_hours || '—';
    }

    get calendarTimezoneLabel() {
        return this.calendarProfile.timezone_label || '—';
    }

    get calendarMonthLabel() {
        return new Date(this.state.calYear, this.state.calMonth, 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    }

    get calendarCells() {
        const year = this.state.calYear;
        const month = this.state.calMonth;
        const first = new Date(year, month, 1);
        const startPad = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const today = new Date();
        const cells = [];
        for (let i = startPad; i > 0; i--) {
            cells.push({
                key: `prev-${daysInPrev - i + 1}`,
                day: daysInPrev - i + 1,
                muted: true,
                today: false,
            });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            cells.push({
                key: `day-${day}`,
                day,
                muted: false,
                today: today.getFullYear() === year && today.getMonth() === month && today.getDate() === day,
            });
        }
        let nextDay = 1;
        while (cells.length % 7 !== 0) {
            cells.push({
                key: `next-${nextDay}`,
                day: nextDay,
                muted: true,
                today: false,
            });
            nextDay += 1;
        }
        return cells;
    }

    _formatLocalTime() {
        const options = { hour: '2-digit', minute: '2-digit', hour12: true };
        const tz = this.calendarProfile && this.calendarProfile.timezone;
        if (tz) {
            options.timeZone = tz;
        }
        try {
            return new Date().toLocaleTimeString('en-US', options);
        } catch (e) {
            return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
    }

    calPrevMonth() {
        if (this.state.calMonth === 0) {
            this.state.calMonth = 11;
            this.state.calYear -= 1;
        } else {
            this.state.calMonth -= 1;
        }
    }

    calNextMonth() {
        if (this.state.calMonth === 11) {
            this.state.calMonth = 0;
            this.state.calYear += 1;
        } else {
            this.state.calMonth += 1;
        }
    }

    calGoToday() {
        const now = new Date();
        this.state.calYear = now.getFullYear();
        this.state.calMonth = now.getMonth();
    }

    showComingSoon() {
        if (this.toast) {
            this.toast.show("info", "Coming soon");
        }
    }

    toggleAllCalEvents() {
        this.showComingSoon();
    }

    toggleAvailMenu() {
        this.showComingSoon();
    }

    async setAvailability(value) {
        this.state.showAvailMenu = false;
        this.state.availabilityOverride = value;
        try {
            await this.orm.write('hr.employee', [this.profile.id], { availability: value });
        } catch (e) {
            this.state.availabilityOverride = null;
            if (this.toast) {
                this.toast.show('error', 'Could not update availability');
            }
        }
    }

    onSendMeetingEmail() {
        this.mailModalService.show(this.profile);
    }

    onFindATime() {
        this.showComingSoon();
    }

    toggleMeetingMenu(eventId) {
        this.state.openMeetingMenu = this.state.openMeetingMenu === eventId ? null : eventId;
    }

    get assetProfile() {
        return this.profile.assets || {};
    }

    get allAssets() {
        return this.assetProfile.items || [];
    }

    get filteredAssets() {
        const query = (this.state.assetQuery || '').trim().toLowerCase();
        if (!query) {
            return this.allAssets;
        }
        return this.allAssets.filter((asset) => {
            const haystack = [
                asset.name,
                asset.category,
                asset.asset_id,
                asset.serial,
                asset.manufacturer,
                asset.status,
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }

    get assetPageSize() {
        return 4;
    }

    get assetPageCount() {
        return Math.max(1, Math.ceil(this.filteredAssets.length / this.assetPageSize));
    }

    get pagedAssets() {
        const page = Math.min(this.state.assetPage, this.assetPageCount);
        const start = (page - 1) * this.assetPageSize;
        return this.filteredAssets.slice(start, start + this.assetPageSize);
    }

    get assetRangeLabel() {
        const total = this.filteredAssets.length;
        if (!total) {
            return 'Showing 0 of 0 assets';
        }
        const page = Math.min(this.state.assetPage, this.assetPageCount);
        const start = (page - 1) * this.assetPageSize + 1;
        const end = Math.min(page * this.assetPageSize, total);
        return `Showing ${start} to ${end} of ${total} assets`;
    }

    get assetKpis() {
        const items = this.allAssets;
        const categories = new Set(items.map((item) => item.category).filter(Boolean));
        return [
            { key: 'total', label: 'Total Assets', value: items.length, tone: 'pink', icon: 'package' },
            { key: 'categories', label: 'Categories', value: categories.size, tone: 'blue', icon: 'briefcase' },
            { key: 'active', label: 'Active', value: items.filter((item) => item.status === 'Active').length, tone: 'green', icon: 'check' },
            { key: 'maintenance', label: 'Maintenance', value: items.filter((item) => item.status === 'Maintenance').length, tone: 'amber', icon: 'wrench' },
            { key: 'retired', label: 'Retired', value: items.filter((item) => item.status === 'Retired').length, tone: 'purple', icon: 'archive' },
        ];
    }

    get assetLastUpdated() {
        const updated = this.assetProfile.last_updated;
        const by = this.assetProfile.last_updated_by;
        if (updated && by) {
            return `Last updated: ${updated} · by ${by}`;
        }
        if (updated) {
            return `Last updated: ${updated}`;
        }
        return '';
    }

    assetStatusClass(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'maintenance') {
            return 'maintenance';
        }
        if (value === 'retired') {
            return 'retired';
        }
        return 'active';
    }

    onAssetSearchInput(ev) {
        this.state.assetQuery = ev.target.value;
        this.state.assetPage = 1;
    }

    assetPrevPage() {
        if (this.state.assetPage > 1) {
            this.state.assetPage -= 1;
        }
    }

    assetNextPage() {
        if (this.state.assetPage < this.assetPageCount) {
            this.state.assetPage += 1;
        }
    }

    get socialSlug() {
        return String(this.profile.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    get socialProfiles() {
        const stored = this.profile.social || {};
        const slug = this.socialSlug;
        return [
            {
                key: 'linkedin',
                label: 'LinkedIn',
                handle: stored.linkedin || (slug ? `linkedin.com/in/${slug}` : '—'),
                tone: 'linkedin',
            },
            {
                key: 'twitter',
                label: 'X (Twitter)',
                handle: stored.twitter || (slug ? `x.com/${slug}` : '—'),
                tone: 'x',
            },
            {
                key: 'instagram',
                label: 'Instagram',
                handle: stored.instagram || (slug ? `instagram.com/${slug}` : '—'),
                tone: 'instagram',
            },
        ];
    }

    get emergencyContact() {
        const relation = this.profile.sdir_emergency_relationship || '';
        return {
            name: this.profile.emergency_contact || '—',
            relation,
            phone: this.profile.emergency_phone || '—',
            email: this.profile.emergency_email || '—',
            address: this.profile.sdir_home_address || '—',
        };
    }

    socialHref(handle) {
        const value = String(handle || '').trim();
        if (!value || value === '—') {
            return '';
        }
        if (/^https?:\/\//i.test(value)) {
            return value;
        }
        return `https://${value}`;
    }

    openSocialProfile(handle) {
        const href = this.socialHref(handle);
        if (!href) {
            return;
        }
        window.open(href, '_blank', 'noopener,noreferrer');
    }

    async copyConnectValue(value) {
        const text = String(value || '').trim();
        if (!text || text === '—') {
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            if (this.toast) {
                this.toast.show('success', 'Copied');
            }
        } catch (e) {
            if (this.toast) {
                this.toast.show('error', 'Could not copy');
            }
        }
    }
}
