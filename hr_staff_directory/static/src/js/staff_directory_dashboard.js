/** @odoo-module **/

import { Component, onMounted, onPatched, onWillStart, onWillUnmount, useRef, useState, useExternalListener } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { StaffDirectoryProfilePanel } from "./../components/profile_panel/profile_panel";
import { StaffDirectoryPeopleList } from "./../components/people_list/people_list";
import { StaffDirectoryHeatmap } from "./../components/heatmap/heatmap";
import { StaffDirectoryBarChart } from "./../components/bar_chart/bar_chart";
import { StaffDirectoryOrgChart } from "./../components/org_chart/org_chart";
import { StaffDirectoryGeographicMap } from "./../components/geographic_map/geographic_map";
import { StaffDirectoryRelationshipGraph } from "./../components/relationship_graph/relationship_graph";
import { StaffDirectoryFullProfile } from "./../components/full_profile/full_profile";
import { StaffDirectoryOrgAnalysis } from "./../components/org_analysis/org_analysis";

// ─── Real-Time Sync: Singleton Subscription ───────────────────────────────────
// bus_service.subscribe() has no unsubscribe in Odoo 17, so subscribing on every
// mount would leak listeners and trigger N reloads per notification. Instead we
// subscribe ONCE per page and dispatch to whichever dashboard instance is live.
const SDIR_CHANNEL = "hr_staff_directory";
const SDIR_EVENT = "hr_staff_directory_update";
const SDIR_RELOAD_DEBOUNCE_MS = 50;
let sdirSubscribed = false;
let activeSdirHandler = null;

/**
 * Staff Directory — People Tab OWL client action.
 * Fetches per-employee data from /hr_staff_directory/people and renders
 * the full People Tab UI (tab bar, stat cards, toolbar, data table, footer).
 * No Chart.js is used in this view.
 * 
 * - [x] Update `staff_directory_dashboard.js` to add `selectedPeople` state and selection methods.
 * - [/] Update `staff_directory_dashboard.xml` to add the Selection Bar and bind checkboxes.
 */
export class StaffDirectoryDashboard extends Component {
    static template = "hr_staff_directory.StaffDirectoryDashboard";
    static props = ["*"];
    static components = { StaffDirectoryFullProfile, StaffDirectoryProfilePanel, StaffDirectoryPeopleList, StaffDirectoryHeatmap, StaffDirectoryBarChart, StaffDirectoryOrgChart, StaffDirectoryGeographicMap, StaffDirectoryRelationshipGraph, StaffDirectoryOrgAnalysis };

    setup() {
        this.rpc = useService("rpc");
        this.toast = useService("hr_staff_directory.toast");
        this.busService = this.env.services.bus_service;
        this.rootRef = useRef("root");
        this.jumpInput = useRef("jumpInput");
        this.smartSearchSaveInput = useRef("smartSearchSaveInput");
        useExternalListener(window, "click", this.onWindowClick.bind(this));
        this._boundOnKeyDown = this.onKeyDown.bind(this);
        this._boundOnClick = this._onClickOutside.bind(this);

        // Re-size the page-window input after every render so its width hugs the text.
        onPatched(() => {
            this._autosizeJumpInput(this.jumpInput.el);
            if (this._focusSmartSearchSaveInput && this.smartSearchSaveInput.el) {
                this.smartSearchSaveInput.el.focus();
                this._focusSmartSearchSaveInput = false;
            }
        });

        // ─── Debounced Load Data for Real-Time Updates ───────────────────────
        this.debouncedLoadData = this._debounce(this._loadData.bind(this), SDIR_RELOAD_DEBOUNCE_MS);
        this._loadSeq = 0;

        // ─── Real-Time Sync ──────────────────────────────────────────────────
        // Register this instance as the live receiver of bus notifications.
        this._boundOnDirectoryUpdate = this.onDirectoryUpdate.bind(this);
        activeSdirHandler = this._boundOnDirectoryUpdate;
        this._onBusReconnect = () => this._loadData();
        this._fallbackPollInterval = null;

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

        // ─── Column Definitions ─────────────────────────────────────────────
        this.ALL_COLUMNS = [
            { id: 'name', label: 'Name' },
            { id: 'role', label: 'Role' },
            { id: 'department', label: 'Department' },
            { id: 'lifecycle', label: 'Lifecycle State' },
            { id: 'work_mode', label: 'Work Mode' },
            { id: 'location', label: 'Location' },
            { id: 'manager', label: 'Manager' },
            { id: 'tenure', label: 'Tenure' },
            { id: 'grade', label: 'Grade' },
            { id: 'employment_type', label: 'Employment Type' },
            { id: 'retention_priority', label: 'Retention Priority' },
            { id: 'performance_score', label: 'Performance Score' },
            { id: 'start_date', label: 'Start Date' },
            { id: 'employee_id', label: 'Employee ID' },
            { id: 'email', label: 'Email' },
            { id: 'phone', label: 'Phone' },
            { id: 'reports_to', label: 'Reports To' },
            { id: 'direct_reports', label: 'Direct Reports' },
            { id: 'languages', label: 'Languages' },
            { id: 'availability', label: 'Availability' },
            { id: 'flight_risk', label: 'Flight Risk' },
            { id: 'last_active', label: 'Last Active' }
        ];

        // ─── Reactive State ──────────────────────────────────────────────────
        const savedCols = localStorage.getItem('sdir_active_columns');
        const initialCols = savedCols ? JSON.parse(savedCols) : ['name', 'role', 'department', 'lifecycle', 'work_mode', 'location', 'manager', 'tenure'];

        const savedRecent = localStorage.getItem('sdir_recent_profiles');
        const initialRecent = savedRecent ? JSON.parse(savedRecent) : [];

        this.state = useState({
            loading:     true,
            selectedPeople: [],
            activeTab:   'people',   // 'people' | 'org' | 'network'
            adminMode:   true,       // true = Admin (all cols), false = ESS (Manager + Actions hidden)
            searchQuery: '',
            
            // Org chart state
            isOrgChartVisible: true,
            orgSidebarOpen: false, // Smart Search closed by default
            smartSearchQuery: '',
            smartSearchFocused: false,
            // Local Smart Search picks — do NOT touch org activeFilters.
            // Next: these drive a dedicated main-view replacement.
            smartSearchSelected: {},
            smartSearchPinnedIds: [],
            smartSearchTab: 'analytics', // overview | teams | calendar | analytics
            smartSearchView: 'org', // org | bar | heatmap | geo | graph
            teamsSearchQuery: '',
            teamsDeptFilter: '',
            teamsHealthFilter: '',
            teamsViewMode: 'list', // list | grid
            teamsDetailId: null,
            teamsDetailTab: 'overview', // overview | members | projects | calendar
            teamsDetailCalPage: 1,
            teamsMeetingExpandedId: null,
            teamsScheduledMeetings: {}, // { [teamId]: Meeting[] }
            showCompareTeamsModal: false,
            compareTeamIds: [],
            showScheduleMeetingModal: false,
            scheduleMeeting: {
                title: '',
                date: '',
                time: '10:00',
                duration: '60',
                location: 'Conference Room A',
                notes: '',
                selectedIds: [],
            },
            calYear: new Date().getFullYear(),
            calMonth: new Date().getMonth(), // 0-indexed
            calViewMode: 'month', // month | week | list
            cleonAiOpen: true,
            cleonAiTab: 'summary',
            // Smart Search saved filter sets (local; applied back into smartSearchSelected)
            orgSavedFilters: [],
            smartSearchSaving: false,
            smartSearchSaveName: '',
            appliedSmartSearchFilter: null, // { id, name } when a saved set is applied
            showOrgViewDropdown: false,
            showOrgFilterDropdown: false,
            activeOrgView: 'org',
            showFilterModal: false,
            activeFilters: {
                department: [],
                grade: [],
                location: [],
                gender: [],
                performance: [],
                employment_type: [],
                lifecycle: [],
                manager: [],
                flight_risk: [],
                availability: [],
                work_mode: [],
                tenure: [],
                skills: [],
                languages: [],
                reporting_depth: [],
                start_date_from: '',
                start_date_to: ''
            },
            expandedFilters: {
                department: true,
                grade: true,
                location: true,
                gender: true,
                performance: true,
                employment_type: true,
                lifecycle: true,
                manager: true,
                flight_risk: true,
                availability: true,
                start_date: true,
                work_mode: true,
                tenure: true,
                skills: true,
                languages: true,
                reporting_depth: true
            },
            showProfileModal: false,
            showFullProfile: false,
            showTeamPersonDrawer: false,
            activeProfile: null,
            messageBox: {
                isVisible: false,
                isMinimized: false,
                // 'people' → send to recipientIds; 'segment' → server recomputes segment members
                mode: 'people',
                recipientIds: [],
                segmentId: null,
                toName: '',
                toEmail: '',
                subject: '',
                body: '',
                sending: false
            },
            hasMessageError: false,
            recentlyViewedProfiles: initialRecent,
            people:      [],
            departments: [],
            segments:    [],
            stats: {
                total:              0,
                active:             0,
                on_leave:           0,
                retention_priority: 0,
                probation:          0,
            },
            adminMode: true,
            showOrgAnalysis: false,
        });

        onWillStart(async () => {
            await this._loadData();
            // Connect to bus for real-time updates
            this.busService.addChannel(SDIR_CHANNEL);
            if (!sdirSubscribed) {
                // Subscribe exactly once; dispatch to the live instance.
                this.busService.subscribe(SDIR_EVENT, (payload) => {
                    if (activeSdirHandler) activeSdirHandler(payload);
                });
                sdirSubscribed = true;
            }
            // Refresh after a websocket reconnection to catch any missed updates.
            this.busService.addEventListener("reconnect", this._onBusReconnect);
            // Low-frequency fallback poll so the view never goes stale even if
            // the bus connection is unavailable for a long time.
            this._fallbackPollInterval = window.setInterval(() => {
                if (!this.state.loading) this._loadData();
            }, 60000);
        });

        onMounted(() => {
            document.addEventListener("keydown", this._boundOnKeyDown);
            document.addEventListener("click", this._boundOnClick);
            // onPatched does not run on the initial mount (OWL MountFiber skips
            // patched hooks), so size the input here for the first paint.
            this._autosizeJumpInput(this.jumpInput.el);
        });

        onWillUnmount(() => {
            document.removeEventListener("keydown", this._boundOnKeyDown);
            document.removeEventListener("click", this._boundOnClick);
            // Stop receiving notifications for this instance.
            if (activeSdirHandler === this._boundOnDirectoryUpdate) {
                activeSdirHandler = null;
            }
            this.busService.removeEventListener("reconnect", this._onBusReconnect);
            if (this.debouncedLoadData && this.debouncedLoadData.cancel) {
                // Cancel any pending reload so it can't fire on a destroyed component.
                this.debouncedLoadData.cancel();
            }
            if (this._fallbackPollInterval) {
                window.clearInterval(this._fallbackPollInterval);
                this._fallbackPollInterval = null;
            }
            this.busService.deleteChannel(SDIR_CHANNEL);
        });
    }

    _onClickOutside(ev) {
        // If filter modal is open and the click is outside the wrapper, close it
        if (this.state.showFilterModal) {
            const wrapper = document.querySelector('.sdir-filter-wrapper');
            if (wrapper && !wrapper.contains(ev.target)) {
                this.state.showFilterModal = false;
            }
        }
    }

    resetFilters() {}

    // ─── Real-Time Handlers ──────────────────────────────────────────────────
    onDirectoryUpdate(payload) {
        // Silently reload data to reflect backend changes
        this.debouncedLoadData();
    }

    _debounce(func, wait) {
        let timeout;
        const debounced = function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                func.apply(this, args);
            }, wait);
        };
        debounced.cancel = () => {
            clearTimeout(timeout);
            timeout = null;
        };
        return debounced;
    }

    // ─── Data Loading ────────────────────────────────────────────────────────

    async _loadData() {
        const requestSeq = ++this._loadSeq;
        this.state.loading = true;
        try {
            const d = await this.rpc('/hr_staff_directory/people');
            // Ignore stale responses that raced with a newer reload.
            if (requestSeq !== this._loadSeq) return;
            this.state.stats  = d.stats  || this.state.stats;
            this.state.departments = d.departments || [];
            this.state.segments = d.segments || [];
            this.state.orgSavedFilters = d.smart_search_filters || [];
            this._applyPeopleData(d.people || []);
            await this._migrateLocalSmartSearchFiltersIfNeeded();
        } catch (e) {
            console.error('[SDIR] people data load failed', e);
        } finally {
            if (requestSeq === this._loadSeq) {
                this.state.loading = false;
            }
        }
    }

    _applyPeopleData(people) {
        const existingIds = new Set(people.map(p => p.id));

        // Re-map the open profile to the fresh record so an open modal updates live.
        if (this.state.activeProfile && this.state.activeProfile.id) {
            const fresh = people.find(p => p.id === this.state.activeProfile.id);
            this.state.activeProfile = fresh || null;
        }

        // Prune selections and recent profiles to ids that still exist.
        this.state.selectedPeople = this.state.selectedPeople.filter(id => existingIds.has(id));
        this.state.recentlyViewedProfiles = (this.state.recentlyViewedProfiles || [])
            .filter(p => existingIds.has(p.id));

        this.state.people = people;
    }

    // ─── Pagination Computed Properties ─────────────────────────────────

    get currentPage() {
        return Math.floor(this.state.currentOffset / this.state.pageSize) + 1;
    }


    getTotalPages() {
        return Math.ceil(this.filteredPeople().length / this.state.pageSize) || 1;
    }

    get pageWindowText() {
        const total = this.filteredPeople().length;
        if (total === 0) return '0';
        const safeOffset = Math.min(Math.max(0, this.state.currentOffset), Math.max(0, total - this.state.pageSize));
        const start = safeOffset + 1;
        const end = Math.min(safeOffset + this.state.pageSize, total);
        return `${start}-${end}`;
    }

    get pageTotal() {
        return this.filteredPeople().length;
    }

    visiblePages() {
        const total = this.getTotalPages();
        const current = this.currentPage;
        let pages = [];
        if (total <= 7) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            if (current <= 4) {
                pages = [1, 2, 3, 4, 5, '...', total];
            } else if (current >= total - 3) {
                pages = [1, '...', total - 4, total - 3, total - 2, total - 1, total];
            } else {
                pages = [1, '...', current - 1, current, current + 1, '...', total];
            }
        }
        return pages;
    }

    // ─── Org Chart Computed Properties ───────────────────────────────────

    toggleOrgSidebar() {
        this.state.orgSidebarOpen = !this.state.orgSidebarOpen;
        if (!this.state.orgSidebarOpen) {
            this.state.smartSearchQuery = '';
            this.state.smartSearchFocused = false;
        }
    }

    /** Categories surfaced in Smart Search typeahead (Figma set). */
    get smartSearchCategoryDefs() {
        return [
            { id: 'department', label: 'Department' },
            { id: 'location', label: 'Location' },
            { id: 'grade', label: 'Grade Level' },
            { id: 'manager', label: 'Team' },
            { id: 'lifecycle', label: 'Status' },
        ];
    }

    get smartSearchQueryTrimmed() {
        return (this.state.smartSearchQuery || '').trim().toLowerCase();
    }

    get smartSearchMatchedCategories() {
        const q = this.smartSearchQueryTrimmed;
        if (!q) return [];
        return this.smartSearchCategoryDefs.filter((c) =>
            c.label.toLowerCase().includes(q)
        );
    }

    get smartSearchValueGroups() {
        const q = this.smartSearchQueryTrimmed;
        if (!q) return [];
        const allowed = new Set(this.smartSearchCategoryDefs.map((c) => c.id));
        const labelById = Object.fromEntries(
            this.smartSearchCategoryDefs.map((c) => [c.id, c.label.toUpperCase()])
        );
        const groups = [];
        for (const col of this.filterDefinitions) {
            for (const def of col) {
                if (!allowed.has(def.id) || !def.options || def.isDate) continue;
                const options = def.options.filter((o) =>
                    String(o).toLowerCase().includes(q)
                );
                if (options.length) {
                    groups.push({
                        id: def.id,
                        label: labelById[def.id] || def.label,
                        options,
                    });
                }
            }
        }
        return groups;
    }

    get showSmartSearchDropdown() {
        return !!this.smartSearchQueryTrimmed;
    }

    get smartSearchHasMatches() {
        return (
            this.smartSearchMatchedCategories.length > 0 ||
            this.smartSearchValueGroups.length > 0
        );
    }

    get smartSearchNoMatchLabel() {
        const raw = (this.state.smartSearchQuery || '').trim();
        return `No matches for "${raw}"`;
    }

    onSmartSearchInput(ev) {
        this.state.smartSearchQuery = ev.target.value;
    }

    onSmartSearchFocus() {
        this.state.smartSearchFocused = true;
    }

    onSmartSearchBlur() {
        // Delay so mousedown on a dropdown row still registers before close.
        setTimeout(() => {
            this.state.smartSearchFocused = false;
        }, 150);
    }

    onSmartSearchCategoryClick(category) {
        this._pinSmartSearchCategory(category.id);
        this.state.smartSearchQuery = '';
        this.state.smartSearchFocused = false;
    }

    _pinSmartSearchCategory(categoryId) {
        if (!this.state.smartSearchPinnedIds.includes(categoryId)) {
            this.state.smartSearchPinnedIds = [...this.state.smartSearchPinnedIds, categoryId];
        }
        if (!this.state.smartSearchSelected[categoryId]) {
            this.state.smartSearchSelected = {
                ...this.state.smartSearchSelected,
                [categoryId]: [],
            };
        }
    }

    unpinSmartSearchCategory(categoryId) {
        this.state.smartSearchPinnedIds = this.state.smartSearchPinnedIds.filter(
            (id) => id !== categoryId
        );
        const selected = { ...this.state.smartSearchSelected };
        delete selected[categoryId];
        this.state.smartSearchSelected = selected;
        this._clearAppliedSmartSearchFilter();
    }

    _getSmartSearchOptionsFor(categoryId) {
        for (const col of this.filterDefinitions) {
            for (const def of col) {
                if (def.id === categoryId && def.options) {
                    return def.options;
                }
            }
        }
        return [];
    }

    get smartSearchPinnedPanels() {
        return this.state.smartSearchPinnedIds.map((id) => {
            const def = this.smartSearchCategoryDefs.find((c) => c.id === id);
            const selected = this.state.smartSearchSelected[id] || [];
            return {
                id,
                label: def ? def.label : id,
                options: this._getSmartSearchOptionsFor(id),
                selected,
                count: selected.length,
            };
        });
    }

    get smartSearchTotalSelectedCount() {
        return Object.values(this.state.smartSearchSelected).reduce(
            (sum, arr) => sum + (arr ? arr.length : 0),
            0
        );
    }

    get showSmartSearchResults() {
        return this.smartSearchTotalSelectedCount > 0;
    }

    get smartSearchFilterChips() {
        const chips = [];
        for (const [categoryId, values] of Object.entries(this.state.smartSearchSelected)) {
            for (const value of values || []) {
                chips.push({ categoryId, value });
            }
        }
        return chips;
    }

    get smartSearchActiveCategoryLabels() {
        const labels = [];
        const seen = new Set();
        for (const [categoryId, values] of Object.entries(this.state.smartSearchSelected)) {
            if (!values || !values.length || seen.has(categoryId)) continue;
            seen.add(categoryId);
            const def = this.smartSearchCategoryDefs.find((c) => c.id === categoryId);
            labels.push(def ? def.label : categoryId);
        }
        return labels;
    }

    get showSmartSearchCollapsedSummary() {
        return !this.state.orgSidebarOpen && this.smartSearchTotalSelectedCount > 0;
    }

    get smartSearchCollapsedSummaryLabel() {
        if (this.state.appliedSmartSearchFilter?.name) {
            return this.state.appliedSmartSearchFilter.name;
        }
        return this.smartSearchActiveCategoryLabels.join(', ');
    }

    onTabBarSettings() {
        this.toggleAdminMode(!this.state.adminMode);
    }

    onTabBarSmartSearch() {
        if (this.state.activeTab !== 'org') {
            this.state.activeTab = 'org';
            this.state.orgSidebarOpen = true;
            return;
        }
        this.toggleOrgSidebar();
    }

    _clearAppliedSmartSearchFilter() {
        this.state.appliedSmartSearchFilter = null;
    }

    _personMatchesSmartSearchValue(person, categoryId, selectedValues) {
        const normSelected = selectedValues.map((v) =>
            String(v).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        );
        let pVal = person[categoryId];
        if (categoryId === 'lifecycle') pVal = person.lifecycle_state;
        if (categoryId === 'location') pVal = person.work_location;
        if (categoryId === 'grade') pVal = person.grade || person.band;
        if (categoryId === 'manager') pVal = person.manager_name;
        if (pVal === undefined || pVal === null || pVal === '') return false;
        const normPVal = String(pVal).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return normSelected.includes(normPVal);
    }

    get smartSearchPeople() {
        let result = this.state.people || [];
        for (const [categoryId, selectedValues] of Object.entries(this.state.smartSearchSelected)) {
            if (!selectedValues || !selectedValues.length) continue;
            result = result.filter((p) =>
                this._personMatchesSmartSearchValue(p, categoryId, selectedValues)
            );
        }
        return result;
    }

    get smartSearchKpis() {
        const people = this.smartSearchPeople;
        const totalAll = (this.state.people || []).length;
        const total = people.length;
        const today = new Date();
        const days30 = 30 * 24 * 60 * 60 * 1000;
        let onLeave = 0;
        let active = 0;
        let newHires = 0;
        let remote = 0;
        const depts = new Set();
        for (const p of people) {
            const life = (p.lifecycle_state || 'active').toLowerCase().replace(/[^a-z]/g, '');
            if (life === 'onleave') onLeave++;
            else if (life === 'active' || life === 'probation') active++;
            if (p.department) depts.add(p.department);
            const mode = String(p.work_mode || '').toLowerCase();
            if (mode.includes('remote')) remote++;
            if (p.create_date || p.start_date) {
                const d = new Date(p.create_date || p.start_date);
                if (!Number.isNaN(d.getTime()) && today - d <= days30) newHires++;
            }
        }
        return {
            total,
            totalAll,
            active,
            onLeave,
            newHires,
            openPos: Math.max(0, Math.round(total * 0.06)),
            depts: depts.size,
            remote,
            activePct: total ? Math.round((active / total) * 100) : 0,
        };
    }

    get smartSearchDeptHighlight() {
        const counts = {};
        for (const p of this.smartSearchPeople) {
            const d = p.department || 'Other';
            counts[d] = (counts[d] || 0) + 1;
        }
        let top = null;
        let topN = 0;
        for (const [name, n] of Object.entries(counts)) {
            if (n > topN) {
                top = name;
                topN = n;
            }
        }
        return top ? { name: top, count: topN } : null;
    }

    get smartSearchDeptBars() {
        const people = this.smartSearchPeople;
        const total = people.length || 1;
        const counts = {};
        for (const p of people) {
            const d = p.department || 'Other';
            counts[d] = (counts[d] || 0) + 1;
        }
        const colors = ['#6366F1', '#8B5CF6', '#D6006E', '#0EA5E9', '#10B981', '#F59E0B'];
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count], i) => ({
                name,
                shortName: name.length > 14 ? name.slice(0, 13) + '…' : name,
                count,
                pct: Math.round((count / total) * 100),
                color: colors[i % colors.length],
            }));
    }

    _formatWeeksAgo(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return '';
        const weeks = Math.max(0, Math.floor((Date.now() - d.getTime()) / (7 * 24 * 60 * 60 * 1000)));
        if (weeks < 1) return 'this week';
        return `${weeks}w ago`;
    }

    get smartSearchRecentJoins() {
        const colors = ['#E91E8C', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
        return [...this.smartSearchPeople]
            .filter((p) => p.create_date || p.start_date)
            .sort((a, b) => {
                const da = new Date(a.create_date || a.start_date);
                const db = new Date(b.create_date || b.start_date);
                return db - da;
            })
            .slice(0, 5)
            .map((p, i) => ({
                id: p.id,
                name: p.name || 'Employee',
                department: p.department || '—',
                ago: this._formatWeeksAgo(p.create_date || p.start_date),
                color: colors[i % colors.length],
            }));
    }

    get smartSearchOverviewCeo() {
        const pool = this.state.people || [];
        const ceo = pool.find(
            (p) =>
                (p.job_title || '').toLowerCase().includes('chief executive') ||
                (p.job_title || '').toLowerCase() === 'ceo'
        );
        if (ceo) {
            return {
                initials: this.initials(ceo.name),
                title: ceo.job_title || 'Chief Executive Officer',
                subtitle: 'CEO',
            };
        }
        // Fallback: top of filtered set by direct reports
        const people = this.smartSearchPeople;
        if (!people.length) return null;
        const sorted = [...people].sort(
            (a, b) => (b.direct_reports || 0) - (a.direct_reports || 0)
        );
        const top = sorted[0];
        return {
            initials: this.initials(top.name),
            title: top.job_title || top.name,
            subtitle: top.department || 'Lead',
        };
    }

    get smartSearchWorkforceArc() {
        const k = this.smartSearchKpis;
        if (!k.total || !k.active) return '';
        const pct = Math.min(1, k.active / k.total);
        if (pct >= 0.999) {
            return 'M 65 60 L 65 12 A 48 48 0 1 1 64.99999999999999 12 Z';
        }
        const angle = pct * 360;
        const r = 48;
        const cx = 65;
        const cy = 60;
        const rad = ((angle - 90) * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        const large = angle > 180 ? 1 : 0;
        return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
    }

    get smartSearchCalendarEvents() {
        // Placeholder org events — swap for live leave/joining/etc. later
        const y = this.state.calYear;
        const m = this.state.calMonth; // 0-indexed
        // Seed relative to viewed month so demo events always appear
        const iso = (day) => {
            const d = String(day).padStart(2, '0');
            const mo = String(m + 1).padStart(2, '0');
            return `${y}-${mo}-${d}`;
        };
        const TYPE = {
            event: { type: 'Event', color: '#8B5CF6' },
            training: { type: 'Training', color: '#F97316' },
            joining: { type: 'Joining', color: '#E91E8C' },
            birthday: { type: 'Birthday', color: '#F59E0B' },
            anniversary: { type: 'Anniversary', color: '#3B82F6' },
            leave: { type: 'Leave', color: '#EF4444' },
            holiday: { type: 'Holiday', color: '#10B981' },
        };
        return [
            { id: 'e1', title: 'Q3 Planning Meeting', date: iso(5), ...TYPE.event },
            { id: 'e2', title: 'Product Review', date: iso(8), ...TYPE.training },
            { id: 'e3', title: 'Team All-Hands', date: iso(12), ...TYPE.event },
            { id: 'e4', title: 'Leadership Training', date: iso(15), ...TYPE.training },
            { id: 'e5', title: 'Engineering Offsite', date: iso(20), ...TYPE.event },
            { id: 'e6', title: 'Compliance Training', date: iso(22), ...TYPE.training },
        ];
    }

    get smartSearchUpcomingEvents() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fmt = (iso) => {
            const d = new Date(iso + 'T12:00:00');
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
            return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
        };
        return this.smartSearchCalendarEvents
            .filter((e) => new Date(e.date + 'T12:00:00') >= today)
            .slice(0, 6)
            .map((e) => ({
                ...e,
                meta: `${e.type} · ${fmt(e.date).replace(/^\w+ /, '')}`,
                sideDate: fmt(e.date),
                tone: e.type === 'Training' ? 'orange' : 'purple',
            }));
    }

    get smartSearchCalMonthLabel() {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ];
        return `${months[this.state.calMonth]} ${this.state.calYear}`;
    }

    get smartSearchCalLegend() {
        return [
            { label: 'Joining', color: '#E91E8C' },
            { label: 'Birthday', color: '#F59E0B' },
            { label: 'Anniversary', color: '#3B82F6' },
            { label: 'Leave', color: '#EF4444' },
            { label: 'Holiday', color: '#10B981' },
            { label: 'Event', color: '#8B5CF6' },
            { label: 'Training', color: '#F97316' },
        ];
    }

    get smartSearchCalSummary() {
        const events = this.smartSearchCalendarEvents;
        const eventN = events.filter((e) => e.type === 'Event').length;
        const trainN = events.filter((e) => e.type === 'Training').length;
        return {
            rows: [
                { label: 'Events', color: '#8B5CF6', count: eventN },
                { label: 'Trainings', color: '#F97316', count: trainN },
            ],
            total: events.length,
        };
    }

    get smartSearchCalDays() {
        const y = this.state.calYear;
        const m = this.state.calMonth;
        const first = new Date(y, m, 1);
        const startPad = first.getDay(); // 0 = Sun
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        const byDate = {};
        for (const ev of this.smartSearchCalendarEvents) {
            if (!byDate[ev.date]) byDate[ev.date] = [];
            byDate[ev.date].push(ev);
        }
        const cells = [];
        const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - startPad + 1;
            const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const dateKey = inMonth
                ? `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                : '';
            const isToday = inMonth && `${y}-${m}-${dayNum}` === todayKey;
            cells.push({
                key: `${y}-${m}-${i}`,
                day: inMonth ? dayNum : '',
                inMonth,
                isToday,
                isSatCol: i % 7 === 6,
                isLastRow: i >= totalCells - 7,
                events: inMonth ? (byDate[dateKey] || []) : [],
            });
        }
        return cells;
    }

    get smartSearchCalWeekDays() {
        const today = new Date();
        const focus =
            today.getFullYear() === this.state.calYear && today.getMonth() === this.state.calMonth
                ? today.getDate()
                : 1;
        const all = this.smartSearchCalDays;
        const cellIdx = all.findIndex((c) => c.inMonth && c.day === focus);
        const weekStart = Math.floor(Math.max(0, cellIdx) / 7) * 7;
        return all.slice(weekStart, weekStart + 7);
    }

    get smartSearchCalListEvents() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return [...this.smartSearchCalendarEvents]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => {
                const d = new Date(e.date + 'T12:00:00');
                return {
                    ...e,
                    sideDate: `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`,
                };
            });
    }

    calGoToday() {
        const n = new Date();
        this.state.calYear = n.getFullYear();
        this.state.calMonth = n.getMonth();
    }

    calPrev() {
        if (this.state.calMonth === 0) {
            this.state.calMonth = 11;
            this.state.calYear -= 1;
        } else {
            this.state.calMonth -= 1;
        }
    }

    calNext() {
        if (this.state.calMonth === 11) {
            this.state.calMonth = 0;
            this.state.calYear += 1;
        } else {
            this.state.calMonth += 1;
        }
    }

    setCalViewMode(mode) {
        this.state.calViewMode = mode;
    }

    get smartSearchInsightText() {
        const top = this.smartSearchDeptHighlight;
        const k = this.smartSearchKpis;
        if (!top || !k.total) {
            return 'Apply filters to surface workforce insights.';
        }
        const pct = Math.round((top.count / k.total) * 100);
        return `${top.name} has the highest headcount with ${top.count} employees (${pct}%)`;
    }

    get smartSearchSummaryText() {
        const chips = this.smartSearchFilterChips.map((c) => c.value);
        const k = this.smartSearchKpis;
        const filterLabel = chips.length
            ? `Department: ${chips.join(', ')}`
            : 'current filters';
        // Prefer department wording when only department is selected
        const onlyDept = Object.keys(this.state.smartSearchSelected).every(
            (id) => id === 'department' || !(this.state.smartSearchSelected[id] || []).length
        );
        const by = onlyDept
            ? `Department: ${chips.join(', ')}`
            : chips.join(', ');
        return `Showing ${k.total} employees filtered by ${by}. The workforce is ${k.activePct}% active.`;
    }

    setSmartSearchTab(tab) {
        this.state.smartSearchTab = tab;
        if (tab !== 'teams') {
            this.state.teamsDetailId = null;
            this.state.teamsDetailTab = 'overview';
        }
    }

    get smartSearchTabLabel() {
        const labels = {
            overview: 'Overview',
            teams: 'Teams',
            calendar: 'Calendar',
            analytics: 'Analytics',
        };
        return labels[this.state.smartSearchTab] || this.state.smartSearchTab;
    }

    _teamHealthFromScore(score) {
        if (score >= 80) return { label: 'Healthy', color: '#10B981' };
        if (score >= 60) return { label: 'Moderate', color: '#F59E0B' };
        if (score >= 40) return { label: 'At Risk', color: '#F97316' };
        return { label: 'Critical', color: '#EF4444' };
    }

    _teamYearsFromPerson(p) {
        if (p.start_date || p.create_date) {
            const d = new Date(p.start_date || p.create_date);
            if (!Number.isNaN(d.getTime())) {
                return Math.max(0, (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            }
        }
        const t = String(p.tenure || '');
        const m = t.match(/([\d.]+)\s*y/i);
        if (m) return parseFloat(m[1]);
        return 0;
    }

    _teamHealthScore(members) {
        if (!members.length) return 20;
        let active = 0;
        let progSum = 0;
        let progN = 0;
        for (const p of members) {
            const life = (p.lifecycle_state || 'active').toLowerCase().replace(/[^a-z]/g, '');
            if (life === 'active' || life === 'probation') active++;
            const s = Number(p.progress_score);
            if (!Number.isNaN(s) && s > 0) {
                progSum += s;
                progN++;
            }
        }
        const activePct = (active / members.length) * 100;
        const avgProg = progN ? progSum / progN : activePct;
        return Math.max(0, Math.min(100, Math.round(activePct * 0.55 + avgProg * 0.45)));
    }

    get smartSearchTeamsAll() {
        const people = this.smartSearchPeople;
        const allPeople = this.state.people || [];
        const byId = {};
        for (const p of allPeople) byId[p.id] = p;

        const groups = {};
        for (const p of people) {
            const mid = p.manager_id;
            if (!mid) continue;
            if (!groups[mid]) groups[mid] = [];
            groups[mid].push(p);
        }

        // Managers in the filter with no filtered reports still appear (empty / critical)
        for (const p of people) {
            if ((p.direct_reports || 0) > 0 && !groups[p.id]) {
                groups[p.id] = [];
            }
        }

        const colors = ['#D6006E', '#6366F1', '#F59E0B', '#10B981', '#8B5CF6', '#0EA5E9', '#E91E8C', '#14B8A6'];
        const CIRC = 2 * Math.PI * 12;
        const CARD_CIRC = 2 * Math.PI * 22;
        const teams = [];

        const classifyMode = (p) => {
            const m = String(p.work_mode || p.work_mode_raw || '').toLowerCase();
            if (m.includes('remote')) return 'remote';
            if (m.includes('hybrid')) return 'hybrid';
            if (m.includes('office') || m.includes('onsite') || m.includes('on-site') || m.includes('site')) {
                return 'office';
            }
            return 'office';
        };

        const gradeLabel = (p) => {
            const g = (p.grade || '').trim();
            if (g) return g;
            const title = (p.job_title || '').toLowerCase();
            if (title.includes('manager') || title.includes('director') || title.includes('head of')) {
                return 'Manager';
            }
            if (title.includes('lead') || title.includes('principal')) return 'Team Lead';
            return 'Individual Contributor';
        };

        for (const [leadIdStr, members] of Object.entries(groups)) {
            const leadId = Number(leadIdStr);
            const lead = byId[leadId];
            const leadName = lead?.name || members[0]?.manager_name || 'Unknown Lead';

            const deptCounts = {};
            for (const m of members) {
                const d = m.department || '';
                if (!d) continue;
                deptCounts[d] = (deptCounts[d] || 0) + 1;
            }
            let department = '—';
            let topN = 0;
            for (const [d, n] of Object.entries(deptCounts)) {
                if (n > topN) {
                    department = d;
                    topN = n;
                }
            }
            if (department === '—' && lead?.department) department = lead.department;

            let name;
            const title = (lead?.job_title || '').trim();
            if (title && !/^(manager|team lead|lead|employee)$/i.test(title)) {
                name = title.replace(/\s+(Manager|Lead|Head)$/i, '').trim() || title;
            } else if (department !== '—') {
                name = `${department} Team`;
            } else {
                name = `${leadName.split(/\s+/)[0]}'s Team`;
            }

            const score = this._teamHealthScore(members);
            const health = this._teamHealthFromScore(score);
            let yearsSum = 0;
            for (const m of members) yearsSum += this._teamYearsFromPerson(m);
            const avgYears = members.length ? yearsSum / members.length : 0;
            const color = colors[teams.length % colors.length];

            // Avatar stack: up to 5 initials + overflow chip
            const avatars = members.slice(0, 5).map((m, i) => ({
                initials: this.initials(m.name),
                z: 5 - i,
                first: i === 0,
            }));
            const avatarExtra = Math.max(0, members.length - 5);

            // Work mode bars
            const modeCounts = { office: 0, hybrid: 0, remote: 0 };
            for (const m of members) modeCounts[classifyMode(m)]++;
            const modeTotal = members.length || 1;
            const workModes = [
                { key: 'office', label: 'Office', count: modeCounts.office, color: '#3B82F6' },
                { key: 'hybrid', label: 'Hybrid', count: modeCounts.hybrid, color: '#C2185B' },
                { key: 'remote', label: 'Remote', count: modeCounts.remote, color: '#10B981' },
            ].map((row) => ({
                ...row,
                pct: members.length ? Math.round((row.count / modeTotal) * 100) : 0,
            }));

            // Grades (top 4)
            const gradeMap = {};
            for (const m of members) {
                const g = gradeLabel(m);
                gradeMap[g] = (gradeMap[g] || 0) + 1;
            }
            const grades = Object.entries(gradeMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([label, count]) => ({ label, count }));

            const memberWord = members.length === 1 ? 'member' : 'members';
            const avgTenure = `${avgYears.toFixed(1)}y`;
            const code = `TM-${String(Math.abs(leadId) % 1000).padStart(3, '0')}`;
            const leadTitle = lead?.job_title || 'Team Lead';
            const leadInitials = this.initials(leadName);

            let projectHits = 0;
            for (const m of members) {
                const cp = m.current_projects;
                if (Array.isArray(cp)) projectHits += cp.length;
                else if (cp) projectHits += 1;
            }
            const activeProjects = members.length
                ? Math.max(1, Math.min(3, projectHits || Math.ceil(members.length / 3)))
                : 0;
            const projectsTabCount = members.length ? Math.max(activeProjects, 3) : 0;

            const deptLabel = department !== '—' ? department : 'Unassigned';
            const description =
                department !== '—'
                    ? `Builds and maintains capabilities within ${department}. Owns delivery cadence, standards, and collaboration for ${name}.`
                    : `Cross-functional team led by ${leadName}. Focuses on delivery, standards, and collaboration across product lines.`;

            teams.push({
                id: leadId,
                code,
                name,
                department,
                deptLabel,
                lead: leadName,
                leadId,
                leadTitle,
                leadInitials,
                members: members.length,
                score,
                health: health.label,
                healthColor: health.color,
                status: score >= 40 ? 'Active' : 'At Risk',
                dashOffset: CIRC * (1 - score / 100),
                circumference: CIRC,
                cardDashOffset: CARD_CIRC * (1 - score / 100),
                cardCircumference: CARD_CIRC,
                avgTenure,
                subtitle: `${members.length} ${memberWord} · Lead: ${leadName} · avg ${avgTenure} tenure`,
                metaLine: `${deptLabel} · Lead: ${leadName}`,
                description,
                activeProjects,
                projectsTabCount,
                color,
                memberIds: members.map((m) => m.id),
                avatars,
                avatarExtra,
                workModes,
                grades,
            });
        }

        teams.sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
        return teams;
    }

    get smartSearchTeamDepartments() {
        const set = new Set();
        for (const t of this.smartSearchTeamsAll) {
            if (t.department && t.department !== '—') set.add(t.department);
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }

    get smartSearchTeams() {
        const q = (this.state.teamsSearchQuery || '').trim().toLowerCase();
        const dept = this.state.teamsDeptFilter || '';
        const health = this.state.teamsHealthFilter || '';
        return this.smartSearchTeamsAll.filter((t) => {
            if (dept && t.department !== dept) return false;
            if (health && t.health !== health) return false;
            if (!q) return true;
            return (
                t.name.toLowerCase().includes(q) ||
                t.lead.toLowerCase().includes(q) ||
                (t.department || '').toLowerCase().includes(q)
            );
        });
    }

    onTeamsSearchInput(ev) {
        this.state.teamsSearchQuery = ev.target.value;
    }

    onTeamsDeptFilter(ev) {
        this.state.teamsDeptFilter = ev.target.value;
    }

    onTeamsHealthFilter(ev) {
        this.state.teamsHealthFilter = ev.target.value;
    }

    setTeamsViewMode(mode) {
        this.state.teamsViewMode = mode;
    }

    onCompareTeams() {
        const teams = this.smartSearchTeams;
        if (!teams.length) {
            this.toast.show('warning', 'No teams available to compare');
            return;
        }
        // Prefill with the two largest teams (or one if only one exists)
        this.state.compareTeamIds = teams.slice(0, 2).map((t) => t.id);
        this.state.showCompareTeamsModal = true;
    }

    closeCompareTeamsModal() {
        this.state.showCompareTeamsModal = false;
    }

    isCompareTeamSelected(teamId) {
        return (this.state.compareTeamIds || []).includes(teamId);
    }

    toggleCompareTeam(teamId) {
        const ids = [...(this.state.compareTeamIds || [])];
        const idx = ids.indexOf(teamId);
        if (idx >= 0) {
            if (ids.length <= 1) {
                this.toast.show('warning', 'Keep at least one team selected');
                return;
            }
            ids.splice(idx, 1);
        } else {
            if (ids.length >= 4) {
                this.toast.show('warning', 'Compare up to 4 teams at a time');
                return;
            }
            ids.push(teamId);
        }
        this.state.compareTeamIds = ids;
    }

    _teamFlightRiskCount(team) {
        if (!team) return 0;
        const byId = {};
        for (const p of this.state.people || []) byId[p.id] = p;
        let n = 0;
        for (const id of team.memberIds || []) {
            const fr = String(byId[id]?.flight_risk || '').toLowerCase();
            if (!fr || fr === 'low' || fr === 'none' || fr === '0' || fr === 'false') continue;
            n += 1;
        }
        return n;
    }

    _teamModePct(team, key) {
        const row = (team?.workModes || []).find((w) => w.key === key);
        return row ? `${row.pct}%` : '0%';
    }

    get compareTeamsSelected() {
        const idSet = new Set(this.state.compareTeamIds || []);
        // Preserve pill selection order
        const byId = {};
        for (const t of this.smartSearchTeamsAll) byId[t.id] = t;
        return (this.state.compareTeamIds || []).map((id) => byId[id]).filter(Boolean);
    }

    get compareTeamsMetricRows() {
        const teams = this.compareTeamsSelected;
        if (!teams.length) return [];
        const cell = (fn) => teams.map((t) => fn(t));
        return [
            { label: 'Headcount', values: cell((t) => t.members) },
            { label: 'Avg Tenure', values: cell((t) => t.avgTenure) },
            { label: 'Team Health', values: cell((t) => t.health) },
            { label: 'Office %', values: cell((t) => this._teamModePct(t, 'office')) },
            { label: 'Hybrid %', values: cell((t) => this._teamModePct(t, 'hybrid')) },
            { label: 'Remote %', values: cell((t) => this._teamModePct(t, 'remote')) },
            { label: 'Flight Risk', values: cell((t) => this._teamFlightRiskCount(t)) },
        ];
    }

    get selectedTeamDetail() {
        if (!this.state.teamsDetailId) return null;
        return this.smartSearchTeamsAll.find((t) => t.id === this.state.teamsDetailId) || null;
    }

    onViewTeam(team) {
        if (!team) return;
        this.state.teamsDetailId = team.id;
        this.state.teamsDetailTab = 'overview';
        this.state.teamsDetailCalPage = 1;
    }

    closeTeamDetail() {
        this.state.teamsDetailId = null;
        this.state.teamsDetailTab = 'overview';
        this.state.teamsDetailCalPage = 1;
        this.state.teamsMeetingExpandedId = null;
        this.closeTeamPersonDrawer();
        this.closeScheduleMeetingModal();
    }

    setTeamsDetailTab(tab) {
        this.state.teamsDetailTab = tab;
        if (tab === 'calendar') this.state.teamsDetailCalPage = 1;
    }

    onTeamLeadClick(team) {
        if (team?.leadId) this.openTeamPersonDrawer(team.leadId);
    }

    get selectedTeamMembers() {
        const team = this.selectedTeamDetail;
        if (!team) return [];
        const byId = {};
        for (const p of this.state.people || []) byId[p.id] = p;

        const rows = [];
        const seen = new Set();

        const pushPerson = (p, isLead) => {
            if (!p || seen.has(p.id)) return;
            seen.add(p.id);
            const life = (p.lifecycle_state || 'active').toLowerCase().replace(/[^a-z]/g, '');
            const lifeLabel = this.lifecycleLabel(p.lifecycle_state || 'Active');
            const modeRaw = String(p.work_mode || p.work_mode_raw || 'Hybrid');
            const mode = modeRaw.charAt(0).toUpperCase() + modeRaw.slice(1).toLowerCase();
            let grade = (p.grade || '').trim();
            if (!grade) {
                const title = (p.job_title || '').toLowerCase();
                if (title.includes('manager') || title.includes('director')) grade = 'L6';
                else if (title.includes('lead') || title.includes('senior')) grade = 'L3';
                else grade = 'L3';
            }
            rows.push({
                id: p.id,
                name: p.name || 'Employee',
                initials: this.initials(p.name),
                title: p.job_title || 'Employee',
                isLead,
                grade,
                status: lifeLabel,
                statusOk: life === 'active' || life === 'probation' || !life,
                workMode: mode.includes('remote') ? 'Remote' : mode.includes('office') || mode.includes('site') ? 'Office' : 'Hybrid',
            });
        };

        // Lead first (even if not in memberIds)
        if (team.leadId) pushPerson(byId[team.leadId], true);
        for (const id of team.memberIds || []) {
            pushPerson(byId[id], id === team.leadId);
        }
        return rows;
    }

    get selectedTeamProjects() {
        const team = this.selectedTeamDetail;
        if (!team) return [];
        const byId = {};
        for (const p of this.state.people || []) byId[p.id] = p;

        const map = new Map();
        const add = (title, leadName, status) => {
            const key = title.toLowerCase();
            if (map.has(key)) return;
            const st = status || 'Active';
            const norm = String(st).toLowerCase();
            let group = 'Active';
            let color = '#059669';
            let bg = '#D1FAE5';
            if (norm.includes('review') || norm.includes('archive')) {
                group = 'Review';
                color = '#D97706';
                bg = '#FEF3C7';
            } else if (norm.includes('plan') || norm.includes('draft')) {
                group = 'Planning';
                color = '#E91E8C';
                bg = '#FCE7F3';
            }
            map.set(key, { title, lead: leadName || team.lead, status: group, color, bg });
        };

        for (const id of [team.leadId, ...(team.memberIds || [])]) {
            const p = byId[id];
            if (!p) continue;
            const list = p.current_projects;
            if (Array.isArray(list)) {
                for (const proj of list) {
                    if (proj?.title) add(proj.title, p.name, proj.status);
                }
            }
        }

        // Placeholder demo projects when none linked (matches Figma)
        if (!map.size && team.members > 0) {
            add('Platform v3 Rebuild', team.lead, 'Active');
            const second = this.selectedTeamMembers.find((m) => !m.isLead);
            add('ERP Integration', second?.name || team.lead, 'Review');
            add('DevOps Modernisation', team.lead, 'Planning');
        }

        return [...map.values()];
    }

    get selectedTeamProjectGroups() {
        const order = ['Active', 'Review', 'Planning'];
        const groups = {};
        for (const p of this.selectedTeamProjects) {
            if (!groups[p.status]) groups[p.status] = [];
            groups[p.status].push(p);
        }
        return order
            .filter((k) => groups[k]?.length)
            .map((status) => {
                const items = groups[status];
                const color = items[0].color;
                const bg = items[0].bg;
                const n = items.length;
                return {
                    status,
                    color,
                    bg,
                    countLabel: `${n} project${n === 1 ? '' : 's'}`,
                    items,
                };
            });
    }

    get selectedTeamMeetingPeople() {
        return this.selectedTeamMembers.slice(0, 3).map((m, i) => ({
            initials: m.initials,
            first: i === 0,
            z: 4 - i,
        }));
    }

    _startOfDay(value) {
        const d = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    }

    _isoOffsetFromToday(offsetDays) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + offsetDays);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    _formatTime12(hhmm) {
        const [hRaw, mRaw] = String(hhmm || '10:00').split(':');
        const h = Number(hRaw);
        const m = Number(mRaw) || 0;
        if (Number.isNaN(h)) return hhmm || '';
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    _formatMeetingTimeRange(time, durationMin) {
        const [hRaw, mRaw] = String(time || '10:00').split(':');
        const h = Number(hRaw);
        const m = Number(mRaw) || 0;
        const start = new Date();
        start.setHours(Number.isNaN(h) ? 10 : h, m, 0, 0);
        const end = new Date(start.getTime() + (parseInt(durationMin, 10) || 60) * 60000);
        const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${fmt(start)} – ${fmt(end)}`;
    }

    _meetingDateBucket(dateStr) {
        const d = this._startOfDay(dateStr);
        const today = this._startOfDay(new Date());
        if (!d || !today) return null;
        const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (diffDays < 0) return null;
        if (diffDays === 0) return { key: 'today', label: 'Today', order: 0 };
        if (diffDays === 1) return { key: 'tomorrow', label: 'Tomorrow', order: 1 };
        if (diffDays < 7) {
            const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return { key: `day-${dateStr}`, label, order: 10 + diffDays };
        }
        if (diffDays < 14) return { key: 'next', label: 'Next Week', order: 20 };
        return { key: 'later', label: 'Later', order: 30 };
    }

    _attendeesFromIds(ids) {
        const byId = {};
        for (const m of this.selectedTeamMembers) byId[m.id] = m;
        return (ids || [])
            .map((id) => byId[id])
            .filter(Boolean)
            .map((m) => ({
                id: m.id,
                name: m.name,
                initials: m.initials,
                title: m.title,
            }));
    }

    _buildMeetingCard(raw) {
        let attendees = this._attendeesFromIds(raw.attendeeIds);
        if (!attendees.length) {
            attendees = this.selectedTeamMembers.map((m) => ({
                id: m.id,
                name: m.name,
                initials: m.initials,
                title: m.title,
            }));
        }
        const people = attendees.slice(0, 3).map((a, i) => ({
            initials: a.initials,
            first: i === 0,
            z: 4 - i,
        }));
        const organizer = raw.organizerName || this.selectedTeamDetail?.lead || attendees[0]?.name || '';
        return {
            id: raw.id,
            title: raw.title,
            meta: `${this._formatMeetingTimeRange(raw.time, raw.duration)} · ${organizer}`,
            people,
            attendees,
            location: raw.location || '—',
            notes: raw.notes || '',
            date: raw.date,
            time: raw.time,
        };
    }

    get selectedTeamMeetingsUpcoming() {
        const team = this.selectedTeamDetail;
        if (!team) return [];
        const lead = team.lead;
        const attendeeIds = this.selectedTeamMembers.map((m) => m.id);
        const demos = [
            {
                id: `demo-${team.id}-u1`,
                title: 'Daily Standup',
                date: this._isoOffsetFromToday(0),
                time: '09:30',
                duration: 15,
                location: 'Zoom',
                attendeeIds,
                organizerName: lead,
            },
            {
                id: `demo-${team.id}-u2`,
                title: 'Sprint Planning',
                date: this._isoOffsetFromToday(1),
                time: '10:00',
                duration: 120,
                location: 'Conference Room A',
                attendeeIds,
                organizerName: lead,
            },
            {
                id: `demo-${team.id}-u3`,
                title: 'Architecture Review',
                date: this._isoOffsetFromToday(3),
                time: '14:00',
                duration: 60,
                location: 'Conference Room B',
                attendeeIds,
                organizerName: lead,
            },
            {
                id: `demo-${team.id}-u4`,
                title: 'Demo Day',
                date: this._isoOffsetFromToday(8),
                time: '15:00',
                duration: 60,
                location: 'Main Hall',
                attendeeIds,
                organizerName: lead,
            },
        ];
        const custom = this.state.teamsScheduledMeetings[team.id] || [];
        // User-created meetings first so they surface at the top of their bucket
        const all = [...custom, ...demos];
        const buckets = new Map();
        for (const raw of all) {
            const bucket = this._meetingDateBucket(raw.date);
            if (!bucket) continue;
            if (!buckets.has(bucket.key)) {
                buckets.set(bucket.key, { key: bucket.key, label: bucket.label, order: bucket.order, items: [] });
            }
            buckets.get(bucket.key).items.push(this._buildMeetingCard(raw));
        }
        for (const b of buckets.values()) {
            b.items.sort((a, bItem) => String(a.time || '').localeCompare(String(bItem.time || '')));
        }
        return [...buckets.values()].sort((a, b) => a.order - b.order);
    }

    get selectedTeamMeetingsRecentAll() {
        const team = this.selectedTeamDetail;
        if (!team) return [];
        const lead = team.lead;
        const people = this.selectedTeamMeetingPeople;
        return [
            { id: 'r1', title: 'Daily Standup', meta: `9:30 AM – 9:45 AM · ${lead}`, people },
            { id: 'r2', title: 'Sprint Retrospective', meta: `3:00 PM – 4:00 PM · ${lead}`, people },
            { id: 'r3', title: 'Daily Standup', meta: `9:30 AM – 9:45 AM · ${lead}`, people },
            { id: 'r4', title: 'Backlog Grooming', meta: `11:00 AM – 12:00 PM · ${lead}`, people },
            { id: 'r5', title: 'Design Sync', meta: `1:00 PM – 1:30 PM · ${lead}`, people },
            { id: 'r6', title: 'Release Checklist', meta: `4:00 PM – 4:30 PM · ${lead}`, people },
        ];
    }

    get selectedTeamMeetingsRecentPageCount() {
        return Math.max(1, Math.ceil(this.selectedTeamMeetingsRecentAll.length / 3));
    }

    get selectedTeamMeetingsRecent() {
        const page = Math.min(this.state.teamsDetailCalPage, this.selectedTeamMeetingsRecentPageCount);
        const start = (page - 1) * 3;
        return this.selectedTeamMeetingsRecentAll.slice(start, start + 3);
    }

    get selectedTeamMeetingsScheduledLabel() {
        const team = this.selectedTeamDetail;
        if (!team) return '';
        const n = this.selectedTeamMeetingsUpcoming.reduce((s, g) => s + g.items.length, 0);
        return `${team.name} · ${n} scheduled`;
    }

    teamsDetailCalPrev() {
        if (this.state.teamsDetailCalPage > 1) this.state.teamsDetailCalPage -= 1;
    }

    teamsDetailCalNext() {
        if (this.state.teamsDetailCalPage < this.selectedTeamMeetingsRecentPageCount) {
            this.state.teamsDetailCalPage += 1;
        }
    }

    toggleTeamsMeetingExpand(meetingId) {
        this.state.teamsMeetingExpandedId =
            this.state.teamsMeetingExpandedId === meetingId ? null : meetingId;
    }

    isTeamsMeetingExpanded(meetingId) {
        return this.state.teamsMeetingExpandedId === meetingId;
    }

    onScheduleTeamMeeting() {
        const team = this.selectedTeamDetail;
        if (!team) return;
        const members = this.selectedTeamMembers;
        this.state.scheduleMeeting = {
            title: `${team.name} Team Meeting`,
            date: '',
            time: '10:00',
            duration: '60',
            location: 'Conference Room A',
            notes: '',
            selectedIds: members.map((m) => m.id),
        };
        this.state.showScheduleMeetingModal = true;
    }

    closeScheduleMeetingModal() {
        this.state.showScheduleMeetingModal = false;
    }

    get scheduleMeetingAttendeeTotal() {
        return this.selectedTeamMembers.length;
    }

    get scheduleMeetingSelectedCount() {
        return (this.state.scheduleMeeting.selectedIds || []).length;
    }

    get scheduleMeetingSubtitle() {
        const team = this.selectedTeamDetail;
        if (!team) return '';
        return `${team.name} · ${this.scheduleMeetingSelectedCount} of ${this.scheduleMeetingAttendeeTotal} attendees selected`;
    }

    get scheduleMeetingAttendeesLabel() {
        return `Attendees (${this.scheduleMeetingSelectedCount} / ${this.scheduleMeetingAttendeeTotal})`;
    }

    isScheduleAttendeeSelected(id) {
        return (this.state.scheduleMeeting.selectedIds || []).includes(id);
    }

    toggleScheduleAttendee(id) {
        const ids = [...(this.state.scheduleMeeting.selectedIds || [])];
        const idx = ids.indexOf(id);
        if (idx >= 0) ids.splice(idx, 1);
        else ids.push(id);
        this.state.scheduleMeeting.selectedIds = ids;
    }

    selectAllScheduleAttendees() {
        this.state.scheduleMeeting.selectedIds = this.selectedTeamMembers.map((m) => m.id);
    }

    clearScheduleAttendees() {
        this.state.scheduleMeeting.selectedIds = [];
    }

    submitScheduleMeeting() {
        const team = this.selectedTeamDetail;
        const form = this.state.scheduleMeeting;
        const title = (form.title || '').trim();
        if (!team) return;
        if (!title) {
            this.toast.show('warning', 'Enter a meeting title');
            return;
        }
        if (!form.date) {
            this.toast.show('warning', 'Pick a meeting date');
            return;
        }
        if (!(form.selectedIds || []).length) {
            this.toast.show('warning', 'Select at least one attendee');
            return;
        }
        if (!this._meetingDateBucket(form.date)) {
            this.toast.show('warning', 'Pick today or a future date');
            return;
        }
        const dur = parseInt(form.duration, 10) || 60;
        const meeting = {
            id: `mtg-${Date.now()}`,
            title,
            date: form.date,
            time: form.time || '10:00',
            duration: dur,
            location: (form.location || '').trim() || '—',
            notes: (form.notes || '').trim(),
            attendeeIds: [...form.selectedIds],
            organizerName: team.lead || '',
        };
        const existing = this.state.teamsScheduledMeetings[team.id] || [];
        this.state.teamsScheduledMeetings = {
            ...this.state.teamsScheduledMeetings,
            [team.id]: [meeting, ...existing],
        };
        this.state.teamsMeetingExpandedId = meeting.id;
        this.toast.show('success', `"${title}" scheduled · ${form.date} at ${form.time || '10:00'} (${dur} min)`);
        this.closeScheduleMeetingModal();
    }

    onExportTeamDetail() {
        if (this.selectedTeamDetail) this.onExportTeam(this.selectedTeamDetail);
    }

    onExportTeam(team) {
        const people = (this.state.people || []).filter((p) =>
            (team.memberIds || []).includes(p.id)
        );
        const rows = [
            ['Name', 'Job Title', 'Department', 'Email', 'Lifecycle'],
            ...people.map((p) => [
                p.name || '',
                p.job_title || '',
                p.department || '',
                p.work_email || '',
                p.lifecycle_state || '',
            ]),
        ];
        const csv = rows
            .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(team.name || 'team').replace(/[^\w\-]+/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    setSmartSearchView(view) {
        this.state.smartSearchView = view;
    }

    onSmartSearchViewSelect(ev) {
        this.state.smartSearchView = ev.target.value;
    }

    setCleonAiTab(tab) {
        this.state.cleonAiTab = tab;
    }

    toggleCleonAi() {
        this.state.cleonAiOpen = !this.state.cleonAiOpen;
    }

    resetSmartSearchFilters() {
        const cleared = {};
        for (const id of this.state.smartSearchPinnedIds) {
            cleared[id] = [];
        }
        this.state.smartSearchSelected = cleared;
        this._clearAppliedSmartSearchFilter();
    }

    isSmartSearchOptionChecked(categoryId, optionValue) {
        const arr = this.state.smartSearchSelected[categoryId] || [];
        return arr.includes(optionValue);
    }

    toggleSmartSearchOption(categoryId, optionValue) {
        // Local only — does not filter the org chart. Next step replaces main view.
        this._pinSmartSearchCategory(categoryId);
        const selected = { ...this.state.smartSearchSelected };
        const current = [...(selected[categoryId] || [])];
        const idx = current.indexOf(optionValue);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(optionValue);
        }
        selected[categoryId] = current;
        this.state.smartSearchSelected = selected;
        this._clearAppliedSmartSearchFilter();
    }

    onSaveSmartSearchFilters() {
        if (!this.smartSearchTotalSelectedCount) {
            this.toast.show('warning', 'Select at least one filter to save');
            return;
        }
        this.state.smartSearchSaving = true;
        this.state.smartSearchSaveName = '';
        this._focusSmartSearchSaveInput = true;
    }

    cancelSmartSearchSave() {
        this.state.smartSearchSaving = false;
        this.state.smartSearchSaveName = '';
    }

    onSmartSearchSaveKeydown(ev) {
        if (ev.key === 'Escape') {
            ev.preventDefault();
            this.cancelSmartSearchSave();
            return;
        }
        if (ev.key === 'Enter') {
            ev.preventDefault();
            this.confirmSmartSearchSave();
        }
    }

    _cloneSmartSearchFilters(source) {
        const filters = {};
        for (const [k, v] of Object.entries(source || {})) {
            filters[k] = [...(v || [])];
        }
        return filters;
    }

    async _migrateLocalSmartSearchFiltersIfNeeded() {
        const flagKey = 'sdir_ss_saved_filters_migrated';
        try {
            if (localStorage.getItem(flagKey)) return;
            const raw = localStorage.getItem('sdir_ss_saved_filters');
            if (!raw) {
                localStorage.setItem(flagKey, '1');
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) {
                localStorage.removeItem('sdir_ss_saved_filters');
                localStorage.setItem(flagKey, '1');
                return;
            }
            for (const saved of parsed) {
                if (!saved?.name || !saved?.filters) continue;
                // Skip if a DB row with the same name already exists
                if ((this.state.orgSavedFilters || []).some((s) => s.name === saved.name)) continue;
                await this.rpc("/web/dataset/call_kw/hr.employee/create_smart_search_filter", {
                    model: "hr.employee",
                    method: "create_smart_search_filter",
                    args: [saved.name, saved.filters, saved.pinnedIds || []],
                    kwargs: {},
                });
            }
            localStorage.removeItem('sdir_ss_saved_filters');
            localStorage.setItem(flagKey, '1');
            // Reload list from DB after migration
            const d = await this.rpc('/hr_staff_directory/people');
            this.state.orgSavedFilters = d.smart_search_filters || [];
        } catch (e) {
            console.warn('Smart Search filter migration skipped', e);
        }
    }

    async confirmSmartSearchSave() {
        const name = (this.state.smartSearchSaveName || '').trim();
        if (!name) {
            this.toast.show('warning', 'Name this filter set');
            return;
        }
        if (!this.smartSearchTotalSelectedCount) {
            this.toast.show('warning', 'Select at least one filter to save');
            return;
        }
        const filters = this._cloneSmartSearchFilters(this.state.smartSearchSelected);
        const pinnedIds = [...this.state.smartSearchPinnedIds];
        try {
            const entry = await this.rpc("/web/dataset/call_kw/hr.employee/create_smart_search_filter", {
                model: "hr.employee",
                method: "create_smart_search_filter",
                args: [name, filters, pinnedIds],
                kwargs: {},
            });
            if (!entry || !entry.id) {
                this.toast.show('error', 'Could not save filter set');
                return;
            }
            this.state.orgSavedFilters = [entry, ...(this.state.orgSavedFilters || []).filter((s) => s.id !== entry.id)];
            this.state.appliedSmartSearchFilter = { id: entry.id, name: entry.name };
            this.cancelSmartSearchSave();
            this.toast.show('success', `"${name}" saved`);
        } catch (e) {
            console.error('Failed to save Smart Search filter set', e);
            this.toast.show('error', 'Failed to save filter set');
        }
    }

    onSelectOrgSavedFilter(saved) {
        if (!saved?.filters || !Object.keys(saved.filters).length) {
            this.toast.show('warning', `"${saved?.name || 'Saved set'}" has no filters to apply`);
            return;
        }
        const filters = this._cloneSmartSearchFilters(saved.filters);
        const pinnedFromSaved = (saved.pinnedIds || []).filter(Boolean);
        const pinnedFromFilters = Object.keys(filters).filter((k) => (filters[k] || []).length);
        const pinnedIds = pinnedFromSaved.length ? pinnedFromSaved : pinnedFromFilters;
        // Ensure every category with values is pinned so panels show
        for (const id of pinnedFromFilters) {
            if (!pinnedIds.includes(id)) pinnedIds.push(id);
        }
        this.state.smartSearchSelected = filters;
        this.state.smartSearchPinnedIds = pinnedIds;
        this.state.appliedSmartSearchFilter = { id: saved.id, name: saved.name };
        this.state.orgSidebarOpen = true;
        this.state.smartSearchSaving = false;
        this.toast.show('success', `Applied "${saved.name}"`);
    }

    toggleOrgViewDropdown() {
        this.state.showOrgViewDropdown = !this.state.showOrgViewDropdown;
    }

    setOrgView(viewName) {
        this.state.activeOrgView = viewName;
        this.state.showOrgViewDropdown = false;
    }

    toggleOrgChartVisibility() {
        this.state.isOrgChartVisible = !this.state.isOrgChartVisible;
    }

    toggleOrgFilterDropdown() {
        this.state.showOrgFilterDropdown = !this.state.showOrgFilterDropdown;
        if (this.state.showOrgFilterDropdown) {
            this.state.showOrgViewDropdown = false;
        }
    }

    get orgSavedFilterText() {
        const depts = this.state.activeFilters.department || [];
        const locs = this.state.activeFilters.location || [];
        const deptStr = depts.join(', ');
        const locStr = locs.join(', ');
        if (deptStr && locStr) return `${deptStr} · ${locStr}`;
        return deptStr || locStr || '';
    }


    goToPage(page) {
        if (page === '...') return;
        if (page >= 1 && page <= this.getTotalPages()) {
            this.state.currentOffset = (page - 1) * this.state.pageSize;
        }
    }



    onJumpInput(ev) {
        if (ev.key !== 'Enter') return;
        const val = ev.target.value.trim();
        const total = this.filteredPeople().length;

        // Match a single page size (e.g. 5 → show 5 users per page)
        if (/^\d+$/.test(val)) {
            let size = parseInt(val, 10);
            if (total > 0) size = Math.min(Math.max(1, size), total);
            else size = 1;
            this.state.pageSize = size;
                        ev.target.blur();
        }
        // Match a record range (e.g. 4-9 → show exactly records 4..9)
        else if (/^(\d+)\s*-\s*(\d+)$/.test(val)) {
            let match = val.match(/^(\d+)\s*-\s*(\d+)$/);
            let start = parseInt(match[1], 10);
            let end = parseInt(match[2], 10);
            if (start > end) {
                let temp = start; start = end; end = temp;
            }
            if (total === 0) {
                ev.target.value = this.pageWindowText;
                ev.target.blur();
                return;
            }
            start = Math.min(Math.max(1, start), total);
            end = Math.min(Math.max(1, end), total);
            this.state.pageSize = end - start + 1;
            this.state.currentOffset = start - 1;
            ev.target.blur();
        }
        else {
            // Invalid input: revert to the standard computed text
            ev.target.value = this.pageWindowText;
            ev.target.blur();
        }
    }

    onJumpFocus(ev) {
        ev.target.select();
        this._autosizeJumpInput(ev.target);
    }

    onJumpInputType(ev) {
        this._autosizeJumpInput(ev.target);
    }

    onJumpBlur(ev) {
        ev.target.value = this.pageWindowText;
        this._autosizeJumpInput(ev.target);
    }

    _autosizeJumpInput(el) {
        if (!el) return;
        const ghost = document.createElement('span');
        ghost.style.cssText = window.getComputedStyle(el).cssText;
        ghost.style.width = 'auto';
        ghost.style.position = 'absolute';
        ghost.style.visibility = 'hidden';
        ghost.style.whiteSpace = 'pre';
        ghost.textContent = el.value || ' ';
        document.body.appendChild(ghost);
        el.style.width = `${ghost.offsetWidth + 2}px`;
        document.body.removeChild(ghost);
    }

    // ─── Data Access & Computed ─────────────────────────────────────────

    filteredPeople() {
        const q = (this.state.searchQuery || '').toLowerCase().trim();
        let result = this.state.people;
        if (q) {
            result = result.filter((p) => {
                return (
                    (p.name          || '').toLowerCase().includes(q) ||
                    (p.job_title     || '').toLowerCase().includes(q) ||
                    (p.department    || '').toLowerCase().includes(q) ||
                    (p.work_location || '').toLowerCase().includes(q) ||
                    (p.emp_ref       || '').toLowerCase().includes(q)
                );
            });
        }

        // Apply active filters
        for (const [key, selectedValues] of Object.entries(this.state.activeFilters)) {
            // Handle date range filters separately
            if (key === 'start_date_from' || key === 'start_date_to') {
                if (key === 'start_date_from' && selectedValues) {
                    result = result.filter(p => p.create_date && new Date(p.create_date) >= new Date(selectedValues));
                } else if (key === 'start_date_to' && selectedValues) {
                    result = result.filter(p => p.create_date && new Date(p.create_date) <= new Date(selectedValues));
                }
                continue;
            }

            if (selectedValues.length > 0) {
                const normSelected = selectedValues.map(v => String(v).replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                
                result = result.filter(p => {
                    let pVal = p[key];
                    if (key === 'lifecycle') pVal = p.lifecycle_state;
                    if (key === 'location') pVal = p.work_location;
                    if (key === 'grade') pVal = p.band || p.grade; // TODO(sdir): 'band' key doesn't exist; 'grade' is the live key — keep band for forward-compat.
                    if (key === 'role') pVal = p.job_title;
                    if (key === 'manager') pVal = p.manager_name;
                    if (key === 'gender') pVal = p.gender;
                    if (key === 'employment_type') pVal = p.employee_type || 'Permanent Full-Time'; // fallback for Odoo employee type mapping
                    if (key === 'reporting_depth') {
                        pVal = (p.direct_report_ids && p.direct_report_ids.length > 0) ? 'Has Direct Reports' : 'Individual Contributor';
                    }
                    if (key === 'performance') {
                        let s = p.progress_score || 0;
                        pVal = s < 60 ? '0–59' : (s < 80 ? '60–79' : '80–100');
                    }
                    
                    if (pVal === undefined || pVal === null) return false;
                    const normPVal = String(pVal).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    return normSelected.includes(normPVal);
                });
            }
        }

        // Final Sort: Pinned first, then by selected sort column
        result.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) {
                return a.is_pinned ? -1 : 1;
            }
            const col = this.state.sortBy;
            const dir = this.state.sortDesc ? -1 : 1;
            
            let valA = a[col];
            let valB = b[col];
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
        
        return result;
    }

    // ─── Filters ─────────────────────────────────────────────────────────────

    get filterDefinitions() {
        const dynamicValues = (field, isList = false) => {
            if (!this.state.people || this.state.people.length === 0) return [];
            const values = new Set();
            this.state.people.forEach(p => {
                const val = p[field];
                if (!val) return;
                if (isList) {
                    val.split(',').forEach(v => {
                        const trimmed = v.trim();
                        if (trimmed) values.add(trimmed);
                    });
                } else {
                    values.add(val.trim());
                }
            });
            const arr = Array.from(values).sort();
            return arr.length > 0 ? arr : [];
        };

        const deptOpts = [...new Set([
            ...(this.state.departments || []).map(d => d.name).filter(Boolean),
            ...dynamicValues('department'),
        ])].sort();
        const gradeOpts = dynamicValues('grade');
        const locOpts = dynamicValues('work_location');
        const empTypeOpts = dynamicValues('employment_type');
        const mgrOpts = dynamicValues('manager_name');
        const skillOpts = dynamicValues('skills', true);
        // TODO(sdir): 'languages' payload is always '' — hr.employee has no 'languages' field
        // (see hr_employee.py payload builder); seed a computed field later so this filter works.
        const langOpts = dynamicValues('languages', true);

        return [
            // Column 1
            [
                { id: 'department', label: 'DEPARTMENT', options: deptOpts.length ? deptOpts : ['Compliance & Risk', 'Customer Service', 'Design', 'Engineering', 'Finance', 'Human Resources'] },
                { id: 'grade', label: 'GRADE / BAND', options: gradeOpts.length ? gradeOpts : ['L1 · Individual Contributor', 'L3 · Team Lead', 'L4 · Manager', 'L6 · Executive'] },
                { id: 'location', label: 'LOCATION', options: locOpts.length ? locOpts : ['Abuja Nigeria', 'Lagos HQ', 'Remote — Global'] },
                { id: 'gender', label: 'GENDER', options: ['Female', 'Male', 'Other/None'] },
                { id: 'performance', label: 'PERFORMANCE SCORE', options: ['0–59', '60–79', '80–100'] },
            ],
            // Column 2
            [
                { id: 'employment_type', label: 'EMPLOYMENT TYPE', options: empTypeOpts.length ? empTypeOpts : ['Contract', 'Part-Time', 'Permanent Full-Time'] },
                { id: 'lifecycle', label: 'LIFECYCLE STATE', hasDots: true, options: ['Active', 'Probation', 'OnLeave', 'Exiting', 'Suspended', 'Terminated', 'Alumni'] },
                { id: 'manager', label: 'MANAGER', options: mgrOpts.length ? mgrOpts : [] },
                { id: 'flight_risk', label: 'FLIGHT RISK', options: ['Low', 'Medium', 'High'] },
                { id: 'availability', label: 'AVAILABILITY', options: ['Online', 'Busy', 'On Leave', 'Out of Office'] },
                { id: 'start_date', label: 'START DATE', isDate: true },
            ],
            // Column 3
            [
                { id: 'work_mode', label: 'WORK MODE', options: ['Office', 'Hybrid', 'Remote'] },
                { id: 'tenure', label: 'TENURE', options: ['0–1y', '1–3y', '3–5y', '5y+'] },
                { id: 'skills', label: 'SKILLS', options: skillOpts.length ? skillOpts : ['AWS', 'Account Management', 'Brand Strategy', 'CRM Tools'] },
                { id: 'languages', label: 'LANGUAGES', options: langOpts.length ? langOpts : ['English', 'French'] },
                { id: 'reporting_depth', label: 'REPORTING DEPTH', options: ['Has Direct Reports', 'Individual Contributor'] },
            ]
        ];
    }

    get activeFilterCount() {
        let count = 0;
        for (const [key, val] of Object.entries(this.state.activeFilters)) {
            if (key === 'start_date_from' || key === 'start_date_to') {
                if (val) count++;
            } else {
                count += val.length;
            }
        }
        return count;
    }

    get activeFilterChips() {
        const chips = [];
        for (const [key, values] of Object.entries(this.state.activeFilters)) {
            if (key === 'start_date_from') {
                if (values) chips.push({ key, val: `From: ${values}` });
            } else if (key === 'start_date_to') {
                if (values) chips.push({ key, val: `To: ${values}` });
            } else {
                for (const val of values) {
                    chips.push({ key, val });
                }
            }
        }
        return chips;
    }

    toggleFilterModal() {
        this.state.showFilterModal = !this.state.showFilterModal;
        if (this.state.showFilterModal) {
            this.state.showColumnsModal = false; // close other modals
        }
    }

    toggleFilterAccordion(categoryId) {
        this.state.expandedFilters[categoryId] = !this.state.expandedFilters[categoryId];
    }

    setDateFilter(type, value) {
        this.state.activeFilters = { ...this.state.activeFilters, [type]: value };
            }

    toggleFilterOption(categoryId, optionValue) {
        const arr = this.state.activeFilters[categoryId];
        let newArr;
        if (arr.includes(optionValue)) {
            newArr = arr.filter(v => v !== optionValue);
        } else {
            newArr = [...arr, optionValue];
        }
        this.state.activeFilters = { ...this.state.activeFilters, [categoryId]: newArr };
            }

    removeFilter(categoryId, optionValue) {
        if (categoryId === 'start_date_from' || categoryId === 'start_date_to') {
            this.state.activeFilters = { ...this.state.activeFilters, [categoryId]: '' };
                        return;
        }
        const newArr = this.state.activeFilters[categoryId].filter(v => v !== optionValue);
        this.state.activeFilters = { ...this.state.activeFilters, [categoryId]: newArr };
            }

    
    applySegmentConditions(conditions) {
        this.clearAllFilters();
        
        const fieldMap = {
            'dept': 'department',
            'gradeLevel': 'grade',
            'location': 'location',
            'workMode': 'work_mode',
            'employmentType': 'employment_type',
            'lifecycleState': 'lifecycle',
            'flightRisk': 'flight_risk',
            'lineManager': 'manager',
            'tenureBucket': 'tenure',
            'gender': 'gender',
            'skills': 'skills',
            'languages': 'languages',
            'performanceScore': 'performance'
        };

        // For now, treat all conditions as standard inclusion filters
        conditions.forEach(cond => {
            if (!cond.field || !cond.value) return;
            
            const filterKey = fieldMap[cond.field];
            if (filterKey && this.state.activeFilters[filterKey] !== undefined) {
                // If it's a comma-separated list of values (e.g., from an IN operator or tags), handle appropriately
                let values = Array.isArray(cond.value) ? cond.value : [cond.value];
                
                // Add unique values
                values.forEach(val => {
                    if (!this.state.activeFilters[filterKey].includes(val)) {
                        this.state.activeFilters[filterKey].push(val);
                    }
                });
            }
        });
        
        // Trigger reactivity
        this.state.activeFilters = { ...this.state.activeFilters };
    }

    clearAllFilters() {
        const reset = {
            start_date_from: '',
            start_date_to: ''
        };
        for (const key in this.state.activeFilters) {
            if (key !== 'start_date_from' && key !== 'start_date_to') {
                reset[key] = [];
            }
        }
        this.state.activeFilters = reset;
        this.state.activeFilters.start_date_to = '';
            }

    getLifecycleDotClass(val) {
        const lower = val.toLowerCase();
        return `sdir-bg-${lower}`;
    }

    getPronouns(gender) {
        if (!gender) return 'other/none';
        const g = gender.toLowerCase();
        if (g === 'male') return 'he/him';
        if (g === 'female') return 'she/her';
        return 'other/none';
    }

    // ─── Pin Logic ─────────────────────────────────────────────────────

    async togglePin(person) {
        // Optimistic UI update
        person.is_pinned = !person.is_pinned;
        // Re-assign people array to trigger reactivity for sorting
        this.state.people = [...this.state.people];
        
        try {
            await this.rpc('/hr_staff_directory/toggle_pin', {
                employee_id: person.id
            });
            const action = person.is_pinned ? 'pinned' : 'unpinned';
            this.toast.show('success', `${person.name} has been successfully ${action}!`);
        } catch (error) {
            // Revert on error
            person.is_pinned = !person.is_pinned;
            this.state.people = [...this.state.people];
            console.error('Failed to toggle pin:', error);
            this.toast.show('error', 'Failed to update pin status.');
        }
    }

    // ─── Selection Logic ─────────────────────────────────────────────────────






    // ─── Export Logic ────────────────────────────────────────────────────────

    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            this.toast.show('warning', 'No data to export.');
            return;
        }

        // Use this.ALL_COLUMNS for the export, as requested (Option A)
        const cols = this.ALL_COLUMNS.filter(c => c.id !== 'avatar');
        
        // Build CSV Header
        const header = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
        
        // Build CSV Rows
        const rows = data.map(person => {
            return cols.map(c => {
                let val = person[c.id];
                if (val === undefined || val === null) val = '';
                val = String(val);
                val = val.replace(/"/g, '""');
                return `"${val}"`;
            }).join(',');
        });
        
        const csvContent = [header, ...rows].join('\n');
        
        // Create a blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.toast.show('success', `Successfully exported ${data.length} records!`);
    }

    
    // ─── Selection ───────────────────────────────────────────────────────────
    toggleSelection(personId) {
        const idx = this.state.selectedPeople.indexOf(personId);
        if (idx === -1) {
            this.state.selectedPeople.push(personId);
        } else {
            this.state.selectedPeople.splice(idx, 1);
        }
    }

    toggleAll(ev) {
        const checked = ev.target.checked;
        if (checked) {
            this.state.selectedPeople = this.state.people.map(p => p.id);
        } else {
            this.state.selectedPeople = [];
        }
    }

    clearSelection() {
        this.state.selectedPeople = [];
    }

    get isAllSelected() {
        return this.state.people.length > 0 && this.state.selectedPeople.length === this.state.people.length;
    }

    get selectedPeopleCount() {
        return this.state.selectedPeople.length;
    }

    exportAll() {
        const dateStr = new Date().toISOString().split('T')[0];
        this.exportToCSV(this.filteredPeople(), `staff_directory_full_${dateStr}.csv`);
    }

    exportSelected() {
        const dateStr = new Date().toISOString().split('T')[0];
        const selectedData = this.state.people.filter(p => this.state.selectedPeople.includes(p.id));
        this.exportToCSV(selectedData, `staff_directory_selected_${dateStr}.csv`);
    }

    // ─── Modal / Profile Logic ──────────────────────────────────────────────────────

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

    get activeProfileManager() {
        if (!this.state.activeProfile || !this.state.activeProfile.manager_id) return null;
        return this.state.people.find(p => p.id === this.state.activeProfile.manager_id);
    }

    get activeProfileDirectReports() {
        if (!this.state.activeProfile || !this.state.activeProfile.direct_report_ids) return [];
        return this.state.people.filter(p => this.state.activeProfile.direct_report_ids.includes(p.id));
    }

    get activeProfileSimilarColleagues() {
        if (!this.state.activeProfile) return [];
        return this.state.people
            .filter(p => p.department === this.state.activeProfile.department && p.id !== this.state.activeProfile.id)
            .slice(0, 4);
    }

    // ─── Event Handlers ──────────────────────────────────────────────────────

    onSearch(ev) {
        this.state.searchQuery = ev.target.value;
            }

    clearSearch() {
        this.state.searchQuery = '';
            }

    toggleTab(tab) {
        this.state.activeTab = tab;
    }


    toggleOrgChangesPanel() {
        this.state.isOrgChangesPanelOpen = !this.state.isOrgChangesPanelOpen;
    }

    toggleOrgAnalysis() {
        this.state.showOrgAnalysis = !this.state.showOrgAnalysis;
    }

    toggleAdminMode(isAdmin) {
        this.state.adminMode = isAdmin;
    }

    // ─── Columns Modal Handlers ─────────────────────────────────────────────

    _saveColumns() {
        localStorage.setItem('sdir_active_columns', JSON.stringify(this.state.activeColumns));
    }

    onWindowClick(ev) {
        if (this.state.showColumnsModal) {
            const colsBtn = document.getElementById('sdirPlBtnColumns');
            const colsModal = document.querySelector('.sdir-cols-modal');
            if (colsBtn && colsBtn.contains(ev.target)) return;
            if (colsModal && colsModal.contains(ev.target)) return;
            this.state.showColumnsModal = false;
            this.state.showMoreColumns = false;
        }

        if (this.state.showOrgFilterDropdown) {
            const btn = ev.target.closest('.sdir-org-btn-outline');
            const dropdown = ev.target.closest('.sdir-org-filter-dropdown');
            if (!btn && !dropdown) {
                this.state.showOrgFilterDropdown = false;
            }
        }

        if (this.state.showOrgViewDropdown) {
            const btn = ev.target.closest('.sdir-org-view-select');
            const dropdown = ev.target.closest('.sdir-org-view-dropdown');
            if (!btn && !dropdown) {
                this.state.showOrgViewDropdown = false;
            }
        }
    }

    get inactiveColumns() {
        return this.ALL_COLUMNS.filter(col => !this.state.activeColumns.includes(col.id));
    }



    addColumn(colId) {
        if (!this.state.activeColumns.includes(colId)) {
            this.state.activeColumns.push(colId);
            this._saveColumns();
        }
    }

    removeColumn(colId) {
        this.state.activeColumns = this.state.activeColumns.filter(c => c !== colId);
        this._saveColumns();
    }

    moveColumn(colId, direction) {
        const idx = this.state.activeColumns.indexOf(colId);
        if (idx === -1) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx >= 0 && newIdx < this.state.activeColumns.length) {
            const temp = this.state.activeColumns[idx];
            this.state.activeColumns[idx] = this.state.activeColumns[newIdx];
            this.state.activeColumns[newIdx] = temp;
            this._saveColumns();
        }
    }



    // ─── Profile Modal Logic ────────────────────────────────────────────────
    
    openProfile(personId) {
        const person = this.state.people.find(p => p.id === personId);
        if (person) {
            this.state.activeProfile = person;
            this.state.profileActiveTab = 'overview';
            this.state.showProfileModal = true;
            this.state.showTeamPersonDrawer = false;
            this.closeMessageBox();
            
            // Track recently viewed
            this.state.recentlyViewedProfiles = this.state.recentlyViewedProfiles.filter(p => p.id !== personId);
            this.state.recentlyViewedProfiles.unshift(person);
            if (this.state.recentlyViewedProfiles.length > 5) {
                this.state.recentlyViewedProfiles = this.state.recentlyViewedProfiles.slice(0, 5);
            }
            localStorage.setItem('sdir_recent_profiles', JSON.stringify(this.state.recentlyViewedProfiles));
        }
    }

    openTeamPersonDrawer(personId) {
        const person = this.state.people.find(p => p.id === personId);
        if (!person) return;
        this.state.activeProfile = person;
        this.state.showTeamPersonDrawer = true;
        this.state.showProfileModal = false;
        this.state.showFullProfile = false;

        this.state.recentlyViewedProfiles = this.state.recentlyViewedProfiles.filter(p => p.id !== personId);
        this.state.recentlyViewedProfiles.unshift(person);
        if (this.state.recentlyViewedProfiles.length > 5) {
            this.state.recentlyViewedProfiles = this.state.recentlyViewedProfiles.slice(0, 5);
        }
        localStorage.setItem('sdir_recent_profiles', JSON.stringify(this.state.recentlyViewedProfiles));
    }

    closeTeamPersonDrawer() {
        this.state.showTeamPersonDrawer = false;
        if (!this.state.showProfileModal && !this.state.showFullProfile) {
            // Keep activeProfile briefly only if another modal needs it;
            // otherwise clear so stale data doesn't linger.
            this.state.activeProfile = null;
        }
    }

    openTeamPersonFullProfile() {
        if (!this.state.activeProfile) return;
        const person = this.state.activeProfile;
        this.state.showTeamPersonDrawer = false;
        this.openProfile(person.id);
    }

    get teamPersonDrawerSkills() {
        const raw = this.state.activeProfile?.skills;
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
        }
        return String(raw).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
    }

    get teamPersonDrawerGrade() {
        const p = this.state.activeProfile;
        if (!p) return '—';
        let grade = (p.grade || p.sdir_grade || '').trim();
        if (!grade) {
            const title = (p.job_title || '').toLowerCase();
            if (title.includes('director') || title.includes('vp') || title.includes('chief')) grade = 'L6';
            else if (title.includes('manager') || title.includes('lead') || title.includes('senior')) grade = 'L4';
            else grade = 'L3';
        }
        const band = /L6|L7|executive|director|chief/i.test(grade + ' ' + (p.job_title || ''))
            ? 'Executive'
            : /L4|L5|manager|lead/i.test(grade + ' ' + (p.job_title || ''))
                ? 'Manager'
                : 'Individual';
        return `${grade} · ${band}`;
    }

    get teamPersonDrawerGradeShort() {
        const full = this.teamPersonDrawerGrade;
        return full.split('·')[0].trim() || '—';
    }

    get teamPersonDrawerJoinDate() {
        const raw = this.state.activeProfile?.start_date || this.state.activeProfile?.create_date || '';
        if (!raw) return '—';
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    get teamPersonDrawerContractType() {
        const et = String(this.state.activeProfile?.employment_type || '');
        if (/permanent/i.test(et)) return 'Permanent';
        if (/contract|fixed/i.test(et)) return 'Contract';
        if (/intern/i.test(et)) return 'Internship';
        if (/temp|casual/i.test(et)) return 'Temporary';
        return et.split(/[\s-]/)[0] || '—';
    }

    get teamPersonDrawerManagerLabel() {
        const mgr = this.activeProfileManager;
        if (mgr?.job_title) return mgr.job_title;
        return this.state.activeProfile?.manager_name || '—';
    }

    get teamPersonDrawerStatusOk() {
        const life = (this.state.activeProfile?.lifecycle_state || 'active').toLowerCase().replace(/[^a-z]/g, '');
        return life === 'active' || life === 'probation' || !life;
    }

    onTeamPersonMessage() {
        const p = this.state.activeProfile;
        if (!p) return;
        if (this.env.services["hr_staff_directory.message"]) {
            this.env.services["hr_staff_directory.message"].show(p);
        }
    }

    onTeamPersonCall() {
        const phone = this.state.activeProfile?.work_phone || this.state.activeProfile?.phone || '';
        if (phone) window.location.href = `tel:${phone}`;
        else this.toast.show('warning', 'No phone number on file');
    }

    onTeamPersonVideo() {
        const p = this.state.activeProfile;
        if (!p) return;
        if (this.env.services["hr_staff_directory.message"]) {
            this.env.services["hr_staff_directory.message"].show(p, { startVideoCall: true });
        }
    }

    onTeamPersonEmail() {
        const p = this.state.activeProfile;
        if (!p) return;
        if (this.env.services["hr_staff_directory.mail_modal"]) {
            this.env.services["hr_staff_directory.mail_modal"].show(p);
        }
    }

    openFullProfile(profile) {
        this.state.activeProfile = profile;
        this.state.showFullProfile = true;
        this.state.showProfileModal = false;
        this.state.showTeamPersonDrawer = false;
    }

    openFullProfileById(personId) {
        if (!personId) return;
        const person = this.state.people.find(p => p.id === personId);
        if (person) {
            this.openFullProfile(person);
        }
    }

    closeFullProfile() {
        this.state.showFullProfile = false;
    }

    closeProfile() {
        this.state.showProfileModal = false;
        this.closeMessageBox();
        setTimeout(() => {
            if (!this.state.showProfileModal && !this.state.showTeamPersonDrawer && !this.state.showFullProfile) {
                this.state.activeProfile = null;
            }
        }, 300); // clear after animation if any
    }


    // ─── Messaging & Toast Logic ─────────────────────────────────────────────

    openMessageBox(recipientName, recipientEmail, personId) {
        if (!personId) return;
        const profile = this.state.people.find(p => p.id === personId);
        if (profile && this.env.services["hr_staff_directory.mail_modal"]) {
            this.env.services["hr_staff_directory.mail_modal"].show(profile);
        }
    }

    openBulkChatBox() {
        if (this.state.selectedPeople.length === 0) return;
        const selectedPeople = this.state.people.filter(p => this.state.selectedPeople.includes(p.id));
        if (this.env.services["hr_staff_directory.message"]) {
            this.env.services["hr_staff_directory.message"].showBulk(selectedPeople);
        }
    }

    openBulkMessageBox() {
        if (this.state.selectedPeople.length === 0) return;
        const selectedPeople = this.state.people.filter(p => this.state.selectedPeople.includes(p.id));
        if (this.env.services["hr_staff_directory.mail_modal"]) {
            this.env.services["hr_staff_directory.mail_modal"].showBulk(selectedPeople);
        }
    }

    openSegmentChatBox(segmentData) {
        if (!segmentData || !segmentData.members) return;
        if (this.env.services["hr_staff_directory.message"]) {
            this.env.services["hr_staff_directory.message"].showBulk(segmentData.members);
        }
    }

    openSegmentMessageBox(segmentData) {
        if (!segmentData || !segmentData.members) return;
        if (this.env.services["hr_staff_directory.mail_modal"]) {
            this.env.services["hr_staff_directory.mail_modal"].showBulk(segmentData.members);
        }
    }

    minimizeMessageBox() {
        this.state.messageBox.isMinimized = !this.state.messageBox.isMinimized;
    }

    closeMessageBox() {
        this.state.messageBox.isVisible = false;
    }

    discardMessage() {
        this.closeMessageBox();
    }

    async sendMessage() {
        const mb = this.state.messageBox;
        if (mb.sending) return;
        if (!mb.body || mb.body.trim() === '') {
            this.state.hasMessageError = true;
            this.toast.show('warning', 'Write something first');
            return;
        }

        const hasTargets = mb.mode === 'segment' ? !!mb.segmentId : mb.recipientIds.length > 0;
        if (!hasTargets) {
            this.state.hasMessageError = true;
            this.toast.show('warning', 'No recipients resolved for this message');
            return;
        }

        mb.sending = true;
        try {
            let res;
            if (mb.mode === 'segment') {
                res = await this.rpc("/web/dataset/call_kw/hr.staff.directory.segment/action_email_members", {
                    model: "hr.staff.directory.segment",
                    method: "action_email_members",
                    args: [mb.segmentId, mb.subject.trim(), mb.body],
                    kwargs: {}
                });
            } else {
                res = await this.rpc("/web/dataset/call_kw/hr.employee/email_employees", {
                    model: "hr.employee",
                    method: "email_employees",
                    args: [mb.recipientIds, mb.subject.trim(), mb.body],
                    kwargs: {}
                });
            }
            this._reportEmailResult(res);
            this.closeMessageBox();
        } catch (error) {
            console.error('Failed to send email:', error);
            this.toast.show('error', 'Failed to send email. Please try again.');
        } finally {
            mb.sending = false;
        }
    }

    _reportEmailResult(res) {
        const sent = (res && res.sent) || 0;
        const skipped = (res && res.skipped_no_email) || 0;
        const failed = (res && res.failed) || 0;
        if (sent > 0) {
            let msg = `Email${sent === 1 ? '' : 's'} sent to ${sent} recipient${sent === 1 ? '' : 's'}`;
            if (skipped > 0) msg += ` · ${skipped} skipped (no work email)`;
            if (failed > 0) msg += ` · ${failed} failed`;
            this.toast.show('success', msg);
        } else if (skipped > 0) {
            this.toast.show('warning', `No emails sent — ${skipped} recipient${skipped === 1 ? '' : 's'} ha${skipped === 1 ? 's' : 've'} no work email`);
        } else {
            this.toast.show('error', 'No emails could be sent');
        }
    }

    onKeyDown(ev) {
        if (ev.key === "Escape" && this.state.showCompareTeamsModal) {
            this.closeCompareTeamsModal();
            return;
        }
        if (ev.key === "Escape" && this.state.showScheduleMeetingModal) {
            this.closeScheduleMeetingModal();
            return;
        }
        if (ev.key === "Escape" && this.state.showTeamPersonDrawer) {
            this.closeTeamPersonDrawer();
            return;
        }
        if (ev.key === "Escape" && this.state.showProfileModal) {
            this.closeProfile();
        }
    }
}

registry.category("actions").add("hr_staff_directory.dashboard", StaffDirectoryDashboard);
