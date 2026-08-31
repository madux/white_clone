/** @odoo-module **/

import { Component, useState, onMounted, onPatched, onWillUnmount, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class StaffDirectoryPeopleList extends Component {
    static template = "hr_staff_directory.PeopleList";
    static props = {
        people: { type: Array },
        stats: { type: Object },
        segments: { type: Array, optional: true },
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
        applySegmentConditions: { type: Function, optional: true },
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
        openBulkChatBox: { type: Function },
        openMessageBox: { type: Function },
        openSegmentMessageBox: { type: Function },
        openSegmentChatBox: { type: Function },
        deptKey: { type: Function },
        lifecycleLabel: { type: Function },
        getLifecycleDotClass: { type: Function },

    };


    setup() {
        this.jumpInput = useRef("jumpInput");
        this.modalBodyRef = useRef("modalBody");
        this.rpc = useService("rpc");
        this.toast = useService("hr_staff_directory.toast");
        this.messageService = useService("hr_staff_directory.message");
        this.mailModalService = useService("hr_staff_directory.mail_modal");
        this._boundOnWindowClick = this._onWindowClick.bind(this);
        this._boundOnKeyDown = this._onDialogKeyDown.bind(this);
        this._boundOnResize = this._onWindowResize.bind(this);
        this._boundOnBodyScroll = this._onModalBodyScroll.bind(this);
        onMounted(() => {
            this._autosizeJumpInput(this.jumpInput.el);
            document.addEventListener("click", this._boundOnWindowClick);
            document.addEventListener("keydown", this._boundOnKeyDown);
        });
        onPatched(() => this._autosizeJumpInput(this.jumpInput.el));
        onWillUnmount(() => {
            document.removeEventListener("click", this._boundOnWindowClick);
            document.removeEventListener("keydown", this._boundOnKeyDown);
            this._closeDialogPopups();
        });

        const initialCols = ['name', 'department', 'role', 'work_email', 'work_phone', 'manager', 'location'];
        
        this.state = useState({
            activeView: 'list',
            sortBy: 'name',
            sortDesc: false,
            currentOffset: 0,
            pageSize: 12,
            activeColumns: initialCols,
            showColumnsModal: false,
            showMoreColumns: false,
            showSavedSegments: false,
            selectedSegment: null,
            showNewSegmentModal: false,
            showColorPicker: false,
            showIconPicker: false,
            openPop: null,      // {kind: 'field'|'op'|'value', index} | null
            popSearch: '',
            popPos: null,
            compareOpen: true,
            compareSel: [],
            showCompareModal: false,
            showActOnSegmentModal: false,
            compareLoading: false,
            compareData: [],
            compareTable: [],
            segments: [],
            currentSegmentData: null,
            segmentForm: {
                name: '',
                color: '#3B82F6',
                icon: 'users',
                conditions: [{field: '', operator: 'is', value: ''}],
                audienceSize: 0,
                loadingPreview: false
            }
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

        // Segment appearance palettes — rendered through the SVG symbol
        // sprite defined at the top of people_list.xml (<use href="#sdir-pl-ic-{id}"/>).
        this.segColors = [
            '#3B82F6', '#0EA5E9', '#1D4ED8', '#6366F1', '#10B981', '#14B8A6',
            '#059669', '#84CC16', '#8B5CF6', '#7C3AED', '#EC4899', '#E91E8C',
            '#F59E0B', '#F97316', '#EF4444', '#DC2626', '#6B7280', '#111827',
        ];
        this.segIcons = [
            { id: 'users', title: 'Users' },
            { id: 'user', title: 'User' },
            { id: 'user-check', title: 'UserCheck' },
            { id: 'briefcase', title: 'Briefcase' },
            { id: 'building-2', title: 'Building2' },
            { id: 'map-pin', title: 'MapPin' },
            { id: 'tag', title: 'Tag' },
            { id: 'award', title: 'Award' },
            { id: 'trending-up', title: 'TrendingUp' },
            { id: 'trending-down', title: 'TrendingDown' },
            { id: 'triangle-alert', title: 'AlertTriangle' },
            { id: 'shield', title: 'Shield' },
            { id: 'star', title: 'Star' },
            { id: 'flame', title: 'Flame' },
            { id: 'zap', title: 'Zap' },
            { id: 'target', title: 'Target' },
            { id: 'globe', title: 'Globe' },
            { id: 'clock', title: 'Clock' },
            { id: 'chart-no-axes-column', title: 'BarChart2' },
            { id: 'git-branch', title: 'GitBranch' },
            { id: 'layers', title: 'Layers' },
            { id: 'book-open', title: 'BookOpen' },
            { id: 'house', title: 'Home' },
            { id: 'laptop', title: 'Laptop' },
            { id: 'graduation-cap', title: 'GraduationCap' },
            { id: 'flag', title: 'Flag' },
            { id: 'trophy', title: 'Trophy' },
            { id: 'heart', title: 'Heart' },
            { id: 'coffee', title: 'Coffee' },
            { id: 'eye', title: 'Eye' },
        ];

        // Condition "Field" options for the searchable dropdown (ids must
        // match the backend segment engine's condition field keys).
        this.fieldOptions = [
            { id: 'dept', label: 'Department' },
            { id: 'role', label: 'Role' },
            { id: 'gradeLevel', label: 'Grade' },
            { id: 'location', label: 'Location' },
            { id: 'workMode', label: 'Work Mode' },
            { id: 'employmentType', label: 'Employment Type' },
            { id: 'lifecycleState', label: 'Lifecycle State' },
            { id: 'flightRisk', label: 'Flight Risk' },
            { id: 'retentionPriority', label: 'Retention Priority' },
            { id: 'lineManager', label: 'Reports To' },
            { id: 'tenureBucket', label: 'Tenure' },
            { id: 'gender', label: 'Gender' },
            { id: 'id', label: 'Employee ID' },
            { id: 'skills', label: 'Skills' },
            { id: 'languages', label: 'Languages' },
            { id: 'performanceScore', label: 'Performance Score' },
        ];

        // Operator sets per field kind. "includes"/"does not include" are
        // display labels — the stored ids (contains/notContains) are the ones
        // the backend segment engine implements.
        this.operatorSets = {
            setOps: [
                { id: 'contains', label: 'includes' },
                { id: 'notContains', label: 'does not include' },
            ],
            numeric: [
                { id: 'eq', label: '= equals' },
                { id: 'gte', label: '≥ at least' },
                { id: 'lte', label: '≤ at most' },
                { id: 'between', label: 'between' },
            ],
            text: [
                { id: 'is', label: 'is' },
                { id: 'isNot', label: 'is not' },
            ],
        };

        // Value-option sources: payload key (from _sd_people_list) per
        // condition field. skills/languages are comma-joined → split later.
        this.fieldValueSource = {
            dept: p => p.department,
            role: p => p.job_title,
            gradeLevel: p => p.grade,
            location: p => p.work_location,
            workMode: p => p.work_mode,
            employmentType: p => p.employment_type,
            lifecycleState: p => p.lifecycle_state,
            flightRisk: p => p.flight_risk,
            retentionPriority: p => p.retention_priority,
            lineManager: p => p.manager_name,
            tenureBucket: p => p.tenure,
            gender: p => p.gender,
            id: p => p.emp_ref,
            skills: p => p.skills,
            languages: p => p.languages,
        };
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






    // ─── Saved Segments ──────────────────────────────────────────────────────

    // ─── Saved Segments Dynamic Logic ────────────────────────────────────────
    
    get savedSegments() {
        return this.props.segments || this.state.segments || [];
    }

    // ─── Header stat counts (segments view topbar) ───────────────────────────
    get segCount() {
        return this.savedSegments.length;
    }
    get workforceCount() {
        return (this.props.people || []).length;
    }
    get highRiskCount() {
        // flight_risk is not populated on the backend yet — reads 0 until then
        return (this.props.people || []).filter(
            p => String(p.flight_risk || '').toLowerCase() === 'high'
        ).length;
    }
    get remoteCount() {
        return (this.props.people || []).filter(
            p => String(p.work_mode || '').toLowerCase() === 'remote'
        ).length;
    }

    // ─── Entry point & dropdown ──────────────────────────────────────────────
    onSavedSegmentsBtnClick() {
        if (this.savedSegments.length === 0) {
            // First-run UX: guide the user straight into creating a segment
            this.toggleNewSegmentModal();
            return;
        }
        // Open the segments management view and select the first segment
        this.toggleView('segments');
        if (this.savedSegments.length > 0) {
            this.selectSegment(this.savedSegments[0].name, this.savedSegments[0].id);
        }
    }

    async openSegmentFromDropdown(seg) {
        this.state.showSavedSegments = false;
        if (this.props.applySegmentConditions && seg.conditions) {
            let conditions = typeof seg.conditions === 'string' ? JSON.parse(seg.conditions) : seg.conditions;
            this.props.applySegmentConditions(conditions);
        }
    }

    // ─── Compare accordion ───────────────────────────────────────────────────
    toggleCompareAccordion() {
        this.state.compareOpen = !this.state.compareOpen;
    }

    toggleCompareChip(segId) {
        const idx = this.state.compareSel.indexOf(segId);
        if (idx === -1) {
            this.state.compareSel.push(segId);
        } else {
            this.state.compareSel.splice(idx, 1);
        }
    }

    /** Selection minus segments that no longer exist (deleted elsewhere). */
    get activeCompareSel() {
        const live = new Set(this.savedSegments.map(sg => sg.id));
        return this.state.compareSel.filter(id => live.has(id));
    }

    isChipSelected(segId) {
        return this.activeCompareSel.includes(segId);
    }

    get compareCount() {
        return this.activeCompareSel.length;
    }

    async compareSegments() {
        const ids = this.activeCompareSel;
        if (ids.length < 2) return;
        this.state.showCompareModal = true;
        this.state.compareLoading = true;
        this.state.compareData = [];
        this.state.compareTable = [];
        try {
            const results = await Promise.all(ids.map(id =>
                this.rpc("/web/dataset/call_kw/hr.employee/get_segment_data", {
                    model: "hr.employee",
                    method: "get_segment_data",
                    args: [id],
                    kwargs: {}
                })
            ));
            const data = results.filter(d => d && d.metrics);
            if (data.length < 2) {
                this.state.showCompareModal = false;
                this.toast.show('warning', 'Selected segments are no longer available');
                return;
            }
            this.state.compareData = data;
            this.state.compareTable = [
                { label: 'Headcount',   values: data.map(d => d.metrics.total) },
                { label: 'Avg Grade',   values: data.map(d => d.metrics.avg_grade) },
                { label: 'Avg Tenure',  values: data.map(d => d.metrics.avg_tenure) },
                { label: 'Flight Risk', values: data.map(d => d.metrics.flight_risk) },
                { label: 'Office',      values: data.map(d => (d.work_mode_distribution || {}).office ?? 0) },
                { label: 'Hybrid',      values: data.map(d => (d.work_mode_distribution || {}).hybrid ?? 0) },
                { label: 'Remote',      values: data.map(d => (d.work_mode_distribution || {}).remote ?? 0) },
            ];
        } catch (error) {
            console.error('Error comparing segments', error);
            this.state.showCompareModal = false;
            this.toast.show('error', 'Failed to load segment comparison');
        } finally {
            this.state.compareLoading = false;
        }
    }


    openActOnSegmentModal() {
        this.state.showActOnSegmentModal = true;
    }

    closeActOnSegmentModal() {
        this.state.showActOnSegmentModal = false;
    }

    closeCompareModal() {
        this.state.showCompareModal = false;
    }

    async selectSegment(name, id) {
        this.state.selectedSegment = name;
        this.state.currentSegmentData = null; // show loading if needed
        try {
            const data = await this.rpc("/web/dataset/call_kw/hr.employee/get_segment_data", {
                model: "hr.employee",
                method: "get_segment_data",
                args: [id],
                kwargs: {}
            });
            this.state.currentSegmentData = data;
        } catch (error) {
            console.error("Error loading segment data", error);
        }
    }

    toggleNewSegmentModal() {
        this.state.showNewSegmentModal = !this.state.showNewSegmentModal;
        this._closeDialogPopups();
        this.state.popSearch = '';
        if (this.state.showNewSegmentModal) {
            this.state.segmentForm = {
                name: '',
                color: '#3B82F6',
                icon: 'users',
                conditions: [{field: 'dept', operator: 'is', value: ''}],
                audienceSize: 0,
                loadingPreview: false
            };
            this._previewSegment();
        }
    }

    // ─── Appearance pickers (color / icon) ───────────────────────────────────

    toggleColorPicker() {
        this._closeSelectPop();
        this.state.showIconPicker = false;
        this.state.showColorPicker = !this.state.showColorPicker;
    }

    toggleIconPicker() {
        this._closeSelectPop();
        this.state.showColorPicker = false;
        this.state.showIconPicker = !this.state.showIconPicker;
    }

    selectSegmentColor(color) {
        this.state.segmentForm.color = color;
        this.state.showColorPicker = false;
    }

    selectSegmentIcon(icon) {
        this.state.segmentForm.icon = icon;
        this.state.showIconPicker = false;
    }

    // ─── Condition dropdowns (field / operator / value) ──────────────────────
    // All three panels are position:fixed with JS-computed coordinates so
    // they escape the modal body's overflow clipping (same approach as the
    // design prototype's "svs-portal" markup). Exactly one panel is open at
    // a time: state.openPop = {kind: 'field'|'op'|'value', index} | null.

    _computePopPos(trigger) {
        const rect = trigger.getBoundingClientRect();
        const POP_EST = 300;  // search header + list max-height + borders
        const margin = 8;
        let top = rect.bottom + 5;
        if (top + POP_EST > window.innerHeight - margin) {
            // Not enough room below the trigger — flip upward.
            top = Math.max(margin, rect.top - 5 - POP_EST);
        }
        const width = Math.max(rect.width, 200);
        let left = rect.left;
        if (left + width > window.innerWidth - margin) {
            left = window.innerWidth - margin - width;
        }
        return { top: Math.round(top), left: Math.round(Math.max(margin, left)), width: Math.round(width) };
    }

    _attachPopListeners() {
        const body = this.modalBodyRef.el;
        if (body) {
            body.addEventListener("scroll", this._boundOnBodyScroll);
        }
        window.addEventListener("resize", this._boundOnResize);
    }

    _detachPopListeners() {
        const body = this.modalBodyRef.el;
        if (body) {
            body.removeEventListener("scroll", this._boundOnBodyScroll);
        }
        window.removeEventListener("resize", this._boundOnResize);
    }

    _onModalBodyScroll() {
        this._repositionPop();
    }

    _onWindowResize() {
        this._repositionPop();
    }

    _repositionPop() {
        const pop = this.state.openPop;
        if (!pop || !this.modalBodyRef.el) return;
        const trigger = this.modalBodyRef.el.querySelector(`[data-sdir-poptrigger="${pop.kind}-${pop.index}"]`);
        if (trigger) {
            this.state.popPos = this._computePopPos(trigger);
        }
    }

    isOpenPop(kind, index) {
        const pop = this.state.openPop;
        return !!pop && pop.kind === kind && pop.index === index;
    }

    get popStyle() {
        const p = this.state.popPos;
        if (!p) return '';
        return `position: fixed; top: ${p.top}px; left: ${p.left}px; width: ${p.width}px;`;
    }

    _closeSelectPop() {
        this.state.openPop = null;
        this.state.popPos = null;
        this._detachPopListeners();
    }

    _closeDialogPopups() {
        this.state.showColorPicker = false;
        this.state.showIconPicker = false;
        this._closeSelectPop();
    }

    _onDialogKeyDown(ev) {
        if (ev.key === 'Escape'
            && (this.state.showColorPicker || this.state.showIconPicker || this.state.openPop)) {
            this._closeDialogPopups();
        }
    }

    toggleSelectPop(kind, index, ev) {
        if (this.isOpenPop(kind, index)) {
            this._closeDialogPopups();
            return;
        }
        this.state.showColorPicker = false;
        this.state.showIconPicker = false;
        this.state.openPop = { kind, index };
        this.state.popSearch = '';
        this.state.popPos = ev && ev.currentTarget
            ? this._computePopPos(ev.currentTarget)
            : null;
        this._attachPopListeners();
    }

    // ─── Field / operator / value selection ──────────────────────────────────

    fieldLabel(fieldId) {
        const opt = this.fieldOptions.find(o => o.id === fieldId);
        return opt ? opt.label : '— select —';
    }

    operatorsFor(fieldId) {
        if (fieldId === 'skills' || fieldId === 'languages') return this.operatorSets.setOps;
        if (fieldId === 'performanceScore') return this.operatorSets.numeric;
        return this.operatorSets.text;
    }

    opLabel(fieldId, opId) {
        const set = this.operatorsFor(fieldId).find(o => o.id === opId)
            || Object.values(this.operatorSets).flat().find(o => o.id === opId);
        return set ? set.label : '— select —';
    }

    selectField(index, fieldId) {
        const cond = this.state.segmentForm.conditions[index];
        this._closeSelectPop();
        if (!cond || cond.field === fieldId) return;
        cond.field = fieldId;
        const ops = this.operatorsFor(fieldId);
        cond.operator = ops.length ? ops[0].id : 'is';
        cond.value = '';
        this._previewSegment();
    }

    selectOp(index, opId) {
        const cond = this.state.segmentForm.conditions[index];
        this._closeSelectPop();
        if (!cond || cond.operator === opId) return;
        if ((cond.operator === 'between') !== (opId === 'between')) {
            cond.value = '';
        }
        cond.operator = opId;
        this._previewSegment();
    }

    selectValue(index, val) {
        const cond = this.state.segmentForm.conditions[index];
        this._closeSelectPop();
        if (!cond) return;
        cond.value = val;
        this._previewSegment();
    }

    onPerfScoreInput(index, ev) {
        const cond = this.state.segmentForm.conditions[index];
        if (!cond) return;
        const cleaned = cond.operator === 'between'
            ? ev.target.value.replace(/[^\d-]/g, '').replace(/-+/g, '-')
            : ev.target.value.replace(/[^\d]/g, '');
        ev.target.value = cleaned;
        cond.value = cleaned;
    }

    get filteredFieldOptions() {
        const pop = this.state.openPop;
        if (!pop || pop.kind !== 'field') return this.fieldOptions;
        const q = (this.state.popSearch || '').toLowerCase().trim();
        if (!q) return this.fieldOptions;
        return this.fieldOptions.filter(o => o.label.toLowerCase().includes(q));
    }

    get valueOptions() {
        const pop = this.state.openPop;
        if (!pop || pop.kind !== 'value' || !this.props.people) return [];
        const cond = this.state.segmentForm.conditions[pop.index];
        const source = cond && this.fieldValueSource[cond.field];
        if (!source) return [];
        const isList = cond.field === 'skills' || cond.field === 'languages';
        const values = new Set();
        this.props.people.forEach(p => {
            const raw = source(p);
            if (!raw) return;
            if (isList) {
                String(raw).split(',').forEach(v => {
                    const t = v.trim();
                    if (t) values.add(t);
                });
            } else {
                const t = String(raw).trim();
                if (t) values.add(t);
            }
        });
        return Array.from(values).sort((a, b) => a.localeCompare(b));
    }

    get filteredValueOptions() {
        const q = (this.state.popSearch || '').toLowerCase().trim();
        const opts = this.valueOptions;
        if (!q) return opts;
        return opts.filter(v => v.toLowerCase().includes(q));
    }

    _shade(hex, pct) {
        const n = parseInt((hex || '#000000').slice(1), 16);
        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        const r = clamp(((n >> 16) & 255) * (1 + pct / 100));
        const g = clamp(((n >> 8) & 255) * (1 + pct / 100));
        const b = clamp((n & 255) * (1 + pct / 100));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    get addCondStyle() {
        const c = this.state.segmentForm.color;
        return `border-color: ${c}60; background: ${c}08; color: ${c};`;
    }

    get saveBtnStyle() {
        const c = this.state.segmentForm.color;
        return `background: linear-gradient(135deg, ${c} 0%, ${this._shade(c, -18)} 100%); box-shadow: ${c}50 0px 2px 8px;`;
    }

    addSegmentCondition() {
        this.state.segmentForm.conditions.push({field: 'dept', operator: 'is', value: ''});
        this._closeSelectPop();
        this._previewSegment();
    }

    removeSegmentCondition(index) {
        this.state.segmentForm.conditions.splice(index, 1);
        this._closeSelectPop();
        this._previewSegment();
    }

    async _previewSegment() {
        this.state.segmentForm.loadingPreview = true;
        try {
            const validConds = this.state.segmentForm.conditions.filter(c => c.field && c.operator && c.value);
            const data = await this.rpc("/web/dataset/call_kw/hr.employee/preview_segment", {
                model: "hr.employee",
                method: "preview_segment",
                args: [validConds],
                kwargs: {}
            });
            this.state.segmentForm.audienceSize = data.audience_size || 0;
        } catch (error) {
            console.error("Error previewing segment", error);
        } finally {
            this.state.segmentForm.loadingPreview = false;
        }
    }

    async saveSegment() {
        const segName = this.state.segmentForm.name;
        if (!segName) {
            this.toast.show('warning', 'Give the segment a name');
            return;
        }
        const conditions = this.state.segmentForm.conditions;
        const validConds = conditions.filter(c => c.field && c.operator && c.value);
        if (validConds.length === 0 || validConds.length !== conditions.length) {
            this.toast.show('warning', 'Fill in all condition values');
            return;
        }

        try {
            const segmentId = await this.rpc("/web/dataset/call_kw/hr.employee/create_segment", {
                model: "hr.employee",
                method: "create_segment",
                args: [
                    segName,
                    this.state.segmentForm.color,
                    this.state.segmentForm.icon,
                    validConds
                ],
                kwargs: {}
            });
            // No manual push here: create_segment broadcasts on the bus, the
            // dashboard reloads and refreshes this.props.segments for every
            // open tab/device.
            this.toggleNewSegmentModal();
            // Land in the segments view so a segment created from the list
            // view's empty-state entry point is immediately visible, and use
            // the captured name (segmentForm was just reset) for highlight.
            this.state.activeView = 'segments';
            this.selectSegment(segName, segmentId);
        } catch (error) {
            console.error("Error saving segment", error);
        }
    }

    async deleteSegment(id) {
        try {
            await this.rpc("/web/dataset/call_kw/hr.employee/delete_segment", {
                model: "hr.employee",
                method: "delete_segment",
                args: [id],
                kwargs: {}
            });
            // List refresh is server-driven (bus broadcast → dashboard reload);
            // only clear local view state if the deleted segment was open.
            if (this.state.currentSegmentData && this.state.currentSegmentData.segment_id === id) {
                this.state.currentSegmentData = null;
                this.state.selectedSegment = null;
            }
        } catch (error) {
            console.error("Error deleting segment", error);
        }
    }

    openSegmentChatBox() {
        const seg = this.state.currentSegmentData;
        if (!seg) return;
        this.props.openSegmentChatBox(seg);
    }

    openSegmentMessageBox() {
        const seg = this.state.currentSegmentData;
        if (!seg || !seg.metrics || !seg.metrics.total) return;
        this.props.openSegmentMessageBox(seg);
    }

    toggleSavedSegments() {
        this.state.showSavedSegments = !this.state.showSavedSegments;
    }



    _onWindowClick(ev) {
        if (this.state.showSavedSegments) {
            const btn = document.getElementById('sdirPlBtnSavedSegmentsGroup');
            const dropdown = document.querySelector('.sdir-segments-modal');
            if (btn && btn.contains(ev.target)) return;
            if (dropdown && dropdown.contains(ev.target)) return;
            this.state.showSavedSegments = false;
        }
        if (this.state.showColumnsModal) {
            const colsBtn = document.getElementById('sdirPlBtnColumns');
            const colsModal = document.querySelector('.sdir-cols-modal');
            if (colsBtn && colsBtn.contains(ev.target)) return;
            if (colsModal && colsModal.contains(ev.target)) return;
            this.state.showColumnsModal = false;
        }
        // Unified click-away for the New Segment dialog popups (color / icon /
        // field dropdown): any click that is not inside the popup's own
        // wrapper (trigger + panel) closes all of them.
        const insidePicker = ev.target.closest('.sdir-pl-picker-wrap');
        if (!insidePicker
            && (this.state.showColorPicker || this.state.showIconPicker || this.state.openPop)) {
            this._closeDialogPopups();
        }
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
