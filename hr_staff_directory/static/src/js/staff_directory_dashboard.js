/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, useRef, useState, useExternalListener } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

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

    setup() {
        this.rpc = useService("rpc");
        this.rootRef = useRef("root");
        useExternalListener(window, "click", this.onWindowClick.bind(this));
        this._boundOnKeyDown = this.onKeyDown.bind(this);
        this._boundOnClick = this._onClickOutside.bind(this);

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
            activeTab:   'people',   // 'people' | 'org' | 'network'
            activeView:  'list',     // 'list' | 'grid'
            adminMode:   true,       // true = Admin (all cols), false = ESS (Manager + Actions hidden)
            sortBy:      'name',
            sortDesc:    false,
            searchQuery: '',
            selectedPeople: [],
            activeColumns: initialCols,
            showColumnsModal: false,
            showMoreColumns: false,
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
            activeProfile: null,
            profileActiveTab: 'overview',
            messageBox: {
                isVisible: false,
                isMinimized: false,
                toName: '',
                toEmail: '',
                subject: '',
                body: ''
            },
            toast: {
                isVisible: false,
                type: '',
                message: ''
            },
            hasMessageError: false,
            recentlyViewedProfiles: initialRecent,
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
            document.addEventListener("keydown", this._boundOnKeyDown);
            document.addEventListener("click", this._boundOnClick);
        });

        onWillUnmount(() => {
            document.removeEventListener("keydown", this._boundOnKeyDown);
            document.removeEventListener("click", this._boundOnClick);
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
                    if (key === 'grade') pVal = p.band || p.grade;
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
        return [
            // Column 1
            [
                { id: 'department', label: 'DEPARTMENT', options: ['Compliance & Risk', 'Customer Service', 'Design', 'Engineering', 'Engineering/IT', 'Executive', 'Finance', 'Human Resources', 'Internal Audit', 'Legal'] },
                { id: 'grade', label: 'GRADE / BAND', options: ['L1 · Individual Contributor', 'L3 · Team Lead', 'L4 · Manager', 'L5 · Senior Manager', 'L6 · Executive', 'L7 · Chief Executive'] },
                { id: 'location', label: 'LOCATION', options: ['Abuja Regional Office', 'Abuja Nigeria', 'HQ New York', 'Kano Satellite Office', 'Lagos HQ', 'Lagos Nigeria', 'Port Harcourt Branch', 'Remote — Global', 'San Francisco Office'] },
                { id: 'gender', label: 'GENDER', options: ['Female', 'Male'] },
                { id: 'performance', label: 'PERFORMANCE SCORE', options: ['0–59', '60–79', '80–100'] },
            ],
            // Column 2
            [
                { id: 'employment_type', label: 'EMPLOYMENT TYPE', options: ['Contract', 'Part-Time', 'Permanent Full-Time'] },
                { id: 'lifecycle', label: 'LIFECYCLE STATE', hasDots: true, options: ['Active', 'Probation', 'OnLeave', 'Exiting', 'Suspended', 'Terminated', 'Alumni'] },
                { id: 'manager', label: 'MANAGER', options: ['Abubakar Banks', 'Ada Obi', 'Adaeze Danjuma', 'Adaeze Musa', 'Adaeze Thomas', 'Adam Mohammed', 'Amelia Obi', 'Amina Johnson', 'Amira Suleiman', 'Ava Bello'] },
                { id: 'flight_risk', label: 'FLIGHT RISK', options: ['Low', 'Medium', 'High'] },
                { id: 'availability', label: 'AVAILABILITY', options: ['Online', 'Busy', 'On Leave', 'Out of Office'] },
                { id: 'start_date', label: 'START DATE', isDate: true },
            ],
            // Column 3
            [
                { id: 'work_mode', label: 'WORK MODE', options: ['Office', 'Hybrid', 'Remote'] },
                { id: 'tenure', label: 'TENURE', options: ['0–1y', '1–3y', '3–5y', '5y+'] },
                { id: 'skills', label: 'SKILLS', options: ['AML/KYC', 'AWS', 'Account Management', 'Audit', 'B2B Sales', 'Branch Operations', 'Brand Strategy', 'Budgeting', 'CRM Tools', 'Campaign Management'] },
                { id: 'languages', label: 'LANGUAGES', options: ['Arabic', 'English', 'French', 'Hausa', 'Igbo', 'Mandarin', 'Pidgin', 'Portuguese', 'Spanish', 'Yoruba'] },
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
            this.showToast('success', `${person.name} has been successfully ${action}!`);
        } catch (error) {
            // Revert on error
            person.is_pinned = !person.is_pinned;
            this.state.people = [...this.state.people];
            console.error('Failed to toggle pin:', error);
            this.showToast('error', 'Failed to update pin status.');
        }
    }

    // ─── Selection Logic ─────────────────────────────────────────────────────

    toggleSort(colId) {
        if (this.state.sortBy === colId) {
            this.state.sortDesc = !this.state.sortDesc;
        } else {
            this.state.sortBy = colId;
            this.state.sortDesc = false;
        }
    }

    toggleSelection(id) {
        if (this.state.selectedPeople.includes(id)) {
            this.state.selectedPeople = this.state.selectedPeople.filter(item => item !== id);
        } else {
            this.state.selectedPeople.push(id);
        }
    }

    toggleAll() {
        const filteredIds = this.filteredPeople().map(p => p.id);
        if (this.isAllSelected) {
            // Deselect all filtered
            this.state.selectedPeople = this.state.selectedPeople.filter(id => !filteredIds.includes(id));
        } else {
            // Select all filtered
            const newSet = new Set([...this.state.selectedPeople, ...filteredIds]);
            this.state.selectedPeople = Array.from(newSet);
        }
    }

    clearSelection() {
        this.state.selectedPeople = [];
    }

    get isAllSelected() {
        const filteredIds = this.filteredPeople().map(p => p.id);
        if (filteredIds.length === 0) return false;
        return filteredIds.every(id => this.state.selectedPeople.includes(id));
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

    toggleView(view) {
        this.state.activeView = view;
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
            const colsBtn = document.getElementById('btnColumns');
            const colsModal = document.querySelector('.sdir-cols-modal');
            if (colsBtn && colsBtn.contains(ev.target)) return;
            if (colsModal && colsModal.contains(ev.target)) return;
            this.state.showColumnsModal = false;
            this.state.showMoreColumns = false;
        }
    }

    get inactiveColumns() {
        return this.ALL_COLUMNS.filter(col => !this.state.activeColumns.includes(col.id));
    }

    get activeColumnObjects() {
        return this.state.activeColumns.map(id => this.ALL_COLUMNS.find(col => col.id === id)).filter(Boolean);
    }

    toggleColumnsModal() {
        this.state.showColumnsModal = !this.state.showColumnsModal;
        if (!this.state.showColumnsModal) {
            this.state.showMoreColumns = false;
        }
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

    resetColumns() {
        this.state.activeColumns = ['name', 'role', 'department', 'lifecycle', 'work_mode', 'location', 'manager', 'tenure'];
        this._saveColumns();
    }

    toggleMoreColumns() {
        this.state.showMoreColumns = !this.state.showMoreColumns;
    }

    // ─── Profile Modal Logic ────────────────────────────────────────────────
    
    openProfile(personId) {
        const person = this.state.people.find(p => p.id === personId);
        if (person) {
            this.state.activeProfile = person;
            this.state.profileActiveTab = 'overview';
            this.state.showProfileModal = true;
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

    closeProfile() {
        this.state.showProfileModal = false;
        this.closeMessageBox();
        setTimeout(() => {
            if (!this.state.showProfileModal) {
                this.state.activeProfile = null;
            }
        }, 300); // clear after animation if any
    }

    setProfileTab(tab) {
        this.state.profileActiveTab = tab;
    }

    // ─── Messaging & Toast Logic ─────────────────────────────────────────────

    openMessageBox(recipientName, recipientEmail) {
        this.state.messageBox.isVisible = true;
        this.state.messageBox.isMinimized = false;
        this.state.messageBox.toName = recipientName || '';
        this.state.messageBox.toEmail = recipientEmail || '';
        this.state.messageBox.subject = '';
        this.state.messageBox.body = '';
        this.state.hasMessageError = false;
    }

    openBulkMessageBox() {
        if (this.state.selectedPeople.length === 0) return;
        
        const selectedPeople = this.state.people.filter(p => this.state.selectedPeople.includes(p.id));
        const emails = selectedPeople
            .map(p => p.work_email || p.email)
            .filter(email => email && email.trim() !== '');
            
        this.state.messageBox.isVisible = true;
        this.state.messageBox.isMinimized = false;
        this.state.messageBox.toName = `Multiple Recipients (${this.state.selectedPeople.length})`;
        this.state.messageBox.toEmail = emails.join(', ');
        this.state.messageBox.subject = '';
        this.state.messageBox.body = '';
        this.state.hasMessageError = false;
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

    sendMessage() {
        if (!this.state.messageBox.body || this.state.messageBox.body.trim() === '') {
            this.state.hasMessageError = true;
            this.showToast('warning', 'Write something first');
        } else {
            this.state.hasMessageError = false;
            this.showToast('success', `Email sent to ${this.state.messageBox.toName}`);
            this.closeMessageBox();
        }
    }

    showToast(type, message) {
        this.state.toast.isVisible = true;
        this.state.toast.type = type;
        this.state.toast.message = message;
        
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        this.toastTimeout = setTimeout(() => {
            this.state.toast.isVisible = false;
        }, 3000);
    }

    onKeyDown(ev) {
        if (ev.key === "Escape" && this.state.showProfileModal) {
            this.closeProfile();
        }
    }
}

registry.category("actions").add("hr_staff_directory.dashboard", StaffDirectoryDashboard);
