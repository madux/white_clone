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
        });

        onWillUnmount(() => {
            document.removeEventListener("keydown", this._boundOnKeyDown);
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

        const sortBy = this.state.sortBy;
        const sortDesc = this.state.sortDesc;
        if (sortBy) {
            result = [...result].sort((a, b) => {
                let valA = a[sortBy] || '';
                let valB = b[sortBy] || '';
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                
                if (valA < valB) return sortDesc ? 1 : -1;
                if (valA > valB) return sortDesc ? -1 : 1;
                return 0;
            });
        }
        
        return result;
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
