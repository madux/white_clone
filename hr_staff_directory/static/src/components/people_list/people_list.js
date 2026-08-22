/** @odoo-module **/

import { Component, useState, onMounted, onPatched, useRef } from "@odoo/owl";

export class StaffDirectoryPeopleList extends Component {
    static template = "hr_staff_directory.PeopleList";
    static props = {
        people: { type: Array },
        stats: { type: Object },
        adminMode: { type: Boolean },
        toggleAdminMode: { type: Function },
        searchQuery: { type: String, optional: true },
        onSearch: { type: Function },
        showFilterModal: { type: Boolean },
        toggleFilterModal: { type: Function },
        expandedFilters: { type: Object },
        filterDefinitions: { type: Array },
        openProfile: { type: Function },
        togglePin: { type: Function },
        activeFilters: { type: Object },
        clearSearch: { type: Function },
                activeFilterCount: { type: Number },
        activeFilterChips: { type: Array },
        exportAll: { type: Function },
        removeFilter: { type: Function },
        clearAllFilters: { type: Function },
        toggleFilterAccordion: { type: Function },
        setDateFilter: { type: Function },
        toggleFilterOption: { type: Function },
        recentlyViewedProfiles: { type: Array },
        selectedPeople: { type: Array },
        toggleSelection: { type: Function },
        toggleAll: { type: Function },
        clearSelection: { type: Function },
        isAllSelected: { type: Boolean },
        selectedPeopleCount: { type: Number },
        exportSelected: { type: Function },
        openBulkMessageBox: { type: Function },
        openMessageBox: { type: Function },
        deptKey: { type: Function },
        lifecycleLabel: { type: Function },
        getLifecycleDotClass: { type: Function },

    };


    setup() {
        this.jumpInput = useRef("jumpInput");
        onMounted(() => this._autosizeJumpInput(this.jumpInput.el));
        onPatched(() => this._autosizeJumpInput(this.jumpInput.el));

        const initialCols = ['name', 'department', 'role', 'work_email', 'work_phone', 'manager', 'location'];
        
        this.state = useState({
            activeView: 'list',
            sortBy: 'name',
            sortDesc: false,
            currentOffset: 0,
            pageSize: 12,
            activeColumns: initialCols,
            showColumnsModal: false,
            showMoreColumns: false
        });

        // Hardcode all available columns for the list view
        this._allColumns = [
            { id: 'name', label: 'Name' },
            { id: 'department', label: 'Department' },
            { id: 'role', label: 'Role' },
            { id: 'work_email', label: 'Email' },
            { id: 'work_phone', label: 'Phone' },
            { id: 'manager', label: 'Manager' },
            { id: 'location', label: 'Location' },
            { id: 'grade', label: 'Grade' },
            { id: 'performance', label: 'Performance' },
            { id: 'flight_risk', label: 'Flight Risk' },
            { id: 'employment_type', label: 'Employment' },
            { id: 'lifecycle_state', label: 'Lifecycle' }
        ];
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────
    num(val) {
        return val || 0;
    }
    
    initials(name) {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    }
    
    avatarColor(name) {
        if (!name) return '#9CA3AF';
        const colors = ['#ec4899', '#8B5CF6', '#22C55E', '#3B82F6', '#F59E0B', '#0EA5E9', '#EF4444', '#14B8A6'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    get sortedPeople() {
        let people = [...this.props.people];
        
        const keyMap = {
            'role': 'job_title',
            'manager': 'manager_name',
            'location': 'work_location',
            'performance': 'performance_score',
        };

        people.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) {
                return a.is_pinned ? -1 : 1;
            }
            if (this.state.sortBy) {
                const dataKey = keyMap[this.state.sortBy] || this.state.sortBy;
                let valA = a[dataKey] || '';
                let valB = b[dataKey] || '';
                
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                
                if (valA < valB) return this.state.sortDesc ? 1 : -1;
                if (valA > valB) return this.state.sortDesc ? -1 : 1;
            }
            return 0;
        });
        return people;
    }

        // ─── Pagination & Views ──────────────────────────────────────────────────
    paginatedPeople() {
        const sorted = this.sortedPeople;
        const pageSize = this.state.pageSize;
        const maxOffset = Math.max(0, sorted.length - pageSize);
        if (this.state.currentOffset > maxOffset) {
            this.state.currentOffset = maxOffset;
        }
        const start = this.state.currentOffset || 0;
        return sorted.slice(start, start + pageSize);
    }

        gridPaginatedPeople() {
        return this.paginatedPeople();
    }
    gridNextPage() { this.nextPage(); }
    gridPrevPage() { this.prevPage(); }
    gridSetPage(p) { this.goToPage(p); }

    toggleView(viewMode) {
        this.state.activeView = viewMode;
        this.state.currentOffset = 0;
    }

    toggleSort(col) {
        if (this.state.sortBy === col) {
            this.state.sortDesc = !this.state.sortDesc;
        } else {
            this.state.sortBy = col;
            this.state.sortDesc = false;
        }
    }

    togglePin(person) {
        this.props.togglePin(person);
    }






    // ─── Columns ─────────────────────────────────────────────────────────────
    toggleColumnsModal() {
        this.state.showColumnsModal = !this.state.showColumnsModal;
    }

    resetColumns() {
        this.state.activeColumns = ['name', 'department', 'role', 'work_email', 'work_phone', 'manager', 'location'];
    }

    toggleMoreColumns() {
        this.state.showMoreColumns = !this.state.showMoreColumns;
    }

    get inactiveColumns() {
        return this._allColumns.filter(col => !this.state.activeColumns.includes(col.id));
    }

    _saveColumns() {
        localStorage.setItem('sdir_active_columns', JSON.stringify(this.state.activeColumns));
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


    toggleColumn(colId) {
        const idx = this.state.activeColumns.indexOf(colId);
        if (idx === -1) {
            this.state.activeColumns.push(colId);
        } else {
            if (this.state.activeColumns.length > 1) {
                this.state.activeColumns.splice(idx, 1);
            }
        }
    }

    cancelColumns() {
        this.state.showColumnsModal = false;
    }

    applyColumns() {
        this.state.showColumnsModal = false;
    }

    
    get activeColumnObjects() {
        return this._allColumns.filter(c => this.state.activeColumns.includes(c.id));
    }

    get activeColumnsLabel() {
        return `${this.state.activeColumns.length} columns active`;
    }

    get allColumns() {
        return this._allColumns;
    }

    get currentPage() {
        return Math.floor(this.state.currentOffset / this.state.pageSize) + 1;
    }

    getTotalPages() {
        return Math.ceil(this.sortedPeople.length / this.state.pageSize) || 1;
    }

    get pageWindowText() {
        const total = this.sortedPeople.length;
        if (total === 0) return '0';
        const safeOffset = Math.min(Math.max(0, this.state.currentOffset), Math.max(0, total - this.state.pageSize));
        const start = safeOffset + 1;
        const end = Math.min(safeOffset + this.state.pageSize, total);
        return `${start}-${end}`;
    }

    get pageTotal() {
        return this.sortedPeople.length;
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

    goToPage(page) {
        if (page === '...') return;
        if (page >= 1 && page <= this.getTotalPages()) {
            this.state.currentOffset = (page - 1) * this.state.pageSize;
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.state.currentOffset -= this.state.pageSize;
        }
    }

    nextPage() {
        if (this.currentPage < this.getTotalPages()) {
            this.state.currentOffset += this.state.pageSize;
        }
    }

    onJumpFocus(ev) {
        ev.target.select();
        this._autosizeJumpInput(ev.target);
    }

    onJumpInput(ev) {
        if (ev.key !== 'Enter') return;
        const val = ev.target.value.trim();
        const total = this.sortedPeople.length;

        // Single digit → compact view: show that many users per page.
        if (/^\d+$/.test(val)) {
            let size = parseInt(val, 10);
            if (total > 0) size = Math.min(Math.max(1, size), total);
            else size = 1;
            this.state.pageSize = size;
            ev.target.blur();
        }
        // Range → show exactly records start..end.
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
            ev.target.value = this.pageWindowText;
            ev.target.blur();
        }
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
}
