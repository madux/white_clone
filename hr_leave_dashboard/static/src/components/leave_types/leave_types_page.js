/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../calendar_sidebar";
import { LeaveTypeDetailDrawer } from "./leave_type_detail_drawer";
import { LeaveTypeFormModal } from "./leave_type_form_modal";

export class LeaveTypesPage extends Component {
    static template = "hr_leave_dashboard.LeaveTypesPage";
    static components = { CalendarSidebar, LeaveTypeDetailDrawer, LeaveTypeFormModal };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.state = useState({
            loading: true,
            viewMode: "admin", // "admin" | "employee"
            leaveTypes: [],

            departments: [],
            units: [],
            grades: [],
            employees: [],
            employmentTypes: [],
            locations: [],

            searchTerm: "",
            categoryFilter: "all",
            statusFilter: "all",
            locationFilter: "all",

            pageSize: 10,
            currentPage: 1,

            drawerLeaveType: null,
            drawerTab: "overview",

            modalOpen: false,
            modalMode: "create",
            editingLeaveType: null,

            exportDropdownOpen: false,
            importDropdownOpen: false,
            loadError: "",
            draggedLeaveTypeId: null,

            helpModalOpen: false,
            faqModalOpen: false,
            tourActive: false,
            tourStep: 1,
        });

        onWillStart(() => this.loadData());
    }

    async safeSearchRead(model, domain = [], fields = ["id", "name"]) {
        try {
            return (await this.orm.searchRead(model, domain, fields)) || [];
        } catch (e) {
            console.warn(`Model '${model}' searchRead skipped:`, e);
            return [];
        }
    }

    async loadData() {
        this.state.loading = true;
        this.state.loadError = "";
        try {
            const typesData = await this.orm.call("hr.leave.type", "get_leave_types_list_data", []);
            this.state.leaveTypes = typesData || [];

            this.state.departments = await this.safeSearchRead("hr.department");
            this.state.units = await this.safeSearchRead("hr.unit");
            this.state.grades = await this.safeSearchRead("hr.grade");
            this.state.employees = await this.safeSearchRead("hr.employee", [["active", "=", true]], ["id", "name", "department_id"]);
            this.state.employmentTypes = await this.safeSearchRead("hr.core_employment_type");
            this.state.locations = await this.safeSearchRead("hr.work.location");
        } catch (err) {
            console.error("Failed to load leave types data", err);
            this.state.loadError = err.message || "Leave types could not be loaded.";
            this.notification.add("Failed to load leave types configuration.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    get filteredLeaveTypes() {
        let list = this.state.leaveTypes;

        // In Employee View mode, only show active and employee-visible leave types
        if (this.state.viewMode === "employee") {
            list = list.filter(lt => lt.active && lt.visible_to_employees);
        }

        const term = (this.state.searchTerm || "").trim().toLowerCase();
        if (term) {
            list = list.filter(lt =>
                (lt.name || "").toLowerCase().includes(term) ||
                (lt.code || "").toLowerCase().includes(term)
            );
        }

        if (this.state.categoryFilter !== "all") {
            list = list.filter(lt => lt.category === this.state.categoryFilter);
        }

        if (this.state.statusFilter !== "all") {
            const isActive = this.state.statusFilter === "active";
            list = list.filter(lt => lt.active === isActive);
        }

        if (this.state.locationFilter !== "all") {
            const locId = Number(this.state.locationFilter);
            list = list.filter(lt => lt.location_ids && lt.location_ids.includes(locId));
        }

        return list;
    }

    get totalPages() {
        return Math.ceil(this.filteredLeaveTypes.length / this.state.pageSize) || 1;
    }

    get paginatedLeaveTypes() {
        const start = (this.state.currentPage - 1) * this.state.pageSize;
        return this.filteredLeaveTypes.slice(start, start + this.state.pageSize);
    }

    get resultsCountLabel() {
        const total = this.filteredLeaveTypes.length;
        if (total === 0) return "Showing 0 of 0";
        const start = (this.state.currentPage - 1) * this.state.pageSize + 1;
        const end = Math.min(this.state.currentPage * this.state.pageSize, total);
        return `Showing ${start}–${end} of ${total}`;
    }

    get hasActiveFilters() {
        return Boolean(
            this.state.searchTerm ||
            this.state.categoryFilter !== "all" ||
            this.state.statusFilter !== "all" ||
            this.state.locationFilter !== "all"
        );
    }

    clearFilters() {
        this.state.searchTerm = "";
        this.state.categoryFilter = "all";
        this.state.statusFilter = "all";
        this.state.locationFilter = "all";
        this.state.currentPage = 1;
    }

    setPageSize(size) {
        this.state.pageSize = Number(size);
        this.state.currentPage = 1;
    }

    prevPage() {
        if (this.state.currentPage > 1) {
            this.state.currentPage -= 1;
        }
    }

    nextPage() {
        if (this.state.currentPage < this.totalPages) {
            this.state.currentPage += 1;
        }
    }

    toggleViewMode() {
        this.state.viewMode = this.state.viewMode === "admin" ? "employee" : "admin";
        this.state.currentPage = 1;
    }

    startTour() {
        this.state.tourActive = true;
        this.state.tourStep = 1;
    }

    nextTourStep() {
        if (this.state.tourStep < 4) {
            this.state.tourStep += 1;
        } else {
            this.state.tourActive = false;
        }
    }

    closeTour() {
        this.state.tourActive = false;
    }

    openHelpGuide() {
        this.state.helpModalOpen = true;
    }

    closeHelpGuide() {
        this.state.helpModalOpen = false;
    }

    openFAQ() {
        this.state.faqModalOpen = true;
    }

    closeFAQ() {
        this.state.faqModalOpen = false;
    }

    openSetupWizard() {
        this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard", {
            additionalContext: { open_setup_wizard: true },
        });
    }

    // FR-195: Drag and Drop Sequence Reordering on Master Array

    onRowDragStart(ev, leaveTypeItem) {
        if (this.hasActiveFilters || this.state.viewMode === "employee") {
            this.notification.add("Reordering sequence is disabled while filters or Employee View are active.", { type: "warning" });
            ev.preventDefault();
            return;
        }
        this.state.draggedLeaveTypeId = leaveTypeItem.id;
        ev.dataTransfer.effectAllowed = "move";
    }

    onRowDragOver(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
    }

    async onRowDrop(ev, targetLeaveTypeItem) {
        ev.preventDefault();
        if (this.hasActiveFilters || this.state.viewMode === "employee") return;

        const srcId = this.state.draggedLeaveTypeId;
        const targetId = targetLeaveTypeItem.id;
        if (!srcId || srcId === targetId) return;

        const master = [...this.state.leaveTypes];
        const srcIdx = master.findIndex(lt => lt.id === srcId);
        const targetIdx = master.findIndex(lt => lt.id === targetId);

        if (srcIdx !== -1 && targetIdx !== -1) {
            const [movedItem] = master.splice(srcIdx, 1);
            master.splice(targetIdx, 0, movedItem);
            this.state.leaveTypes = master;

            const reorderedIds = master.map(lt => lt.id);
            try {
                await this.orm.call("hr.leave.type", "update_leave_types_sequence", [reorderedIds]);
                this.notification.add("Leave type sequence reordered.", { type: "success" });
            } catch (err) {
                console.error("Failed to reorder sequence", err);
                this.notification.add("Failed to save sequence reordering.", { type: "danger" });
            }
        }
    }

    // FR-194: Toggle Active Status

    async toggleStatus(leaveType) {
        if (leaveType.active) {
            const impact = await this.orm.call("hr.leave.type", "get_deactivation_impact", [leaveType.id]);
            if (impact.active_request_count > 0 || impact.has_active_balances) {
                const confirmed = confirm(
                    `Deactivating '${leaveType.name}' affects ${impact.assigned_employee_count} assigned employees and ${impact.active_request_count} active requests.\n\nAre you sure you want to deactivate this leave type?`
                );
                if (!confirmed) return;
            }
        }

        try {
            await this.orm.write("hr.leave.type", [leaveType.id], { active: !leaveType.active });
            leaveType.active = !leaveType.active;
            this.notification.add(`Leave type '${leaveType.name}' ${leaveType.active ? "activated" : "deactivated"}.`, { type: "info" });
        } catch (err) {
            console.error("Failed to toggle status", err);
            this.notification.add("Failed to update status.", { type: "danger" });
        }
    }

    openAddModal() {
        this.state.editingLeaveType = null;
        this.state.modalMode = "create";
        this.state.modalOpen = true;
    }

    openEditModal(leaveType) {
        this.closeDetailDrawer();
        this.state.editingLeaveType = leaveType;
        this.state.modalMode = "edit";
        this.state.modalOpen = true;
    }

    openDuplicateModal(leaveType) {
        this.closeDetailDrawer();
        const copyPayload = {
            ...leaveType,
            id: null,
            name: `Copy of ${leaveType.name}`,
            code: "",
            is_system: false,
            active_request_count: 0,
        };
        this.state.editingLeaveType = copyPayload;
        this.state.modalMode = "create";
        this.state.modalOpen = true;
    }

    closeModal() {
        this.state.modalOpen = false;
    }

    openDetailDrawer(leaveType, tab = "overview") {
        this.state.drawerLeaveType = leaveType;
        this.state.drawerTab = tab;
    }

    closeDetailDrawer() {
        this.state.drawerLeaveType = null;
    }

    // Real Odoo Action to allocate leave to employees
    assignToEmployees(leaveType) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.leave.allocation",
            name: `Allocate ${leaveType.name}`,
            views: [[false, "form"]],
            target: "new",
            context: {
                default_holiday_status_id: leaveType.id,
                default_name: `Allocation - ${leaveType.name}`,
            },
        });
    }

    async deleteLeaveType(leaveType) {
        if (leaveType.is_system) {
            this.notification.add(`System leave type '${leaveType.name}' cannot be deleted.`, { type: "warning" });
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete leave type '${leaveType.name}'? This action cannot be undone.`);
        if (!confirmed) return;

        try {
            await this.orm.unlink("hr.leave.type", [leaveType.id]);
            this.notification.add(`Leave type '${leaveType.name}' deleted.`, { type: "success" });
            if (this.state.drawerLeaveType && this.state.drawerLeaveType.id === leaveType.id) {
                this.closeDetailDrawer();
            }
            await this.loadData();
        } catch (err) {
            console.error("Failed to delete leave type", err);
            this.notification.add(err.message || "Failed to delete leave type.", { type: "danger" });
        }
    }

    toggleExportDropdown() {
        this.state.exportDropdownOpen = !this.state.exportDropdownOpen;
    }

    toggleImportDropdown() {
        this.state.importDropdownOpen = !this.state.importDropdownOpen;
    }

    async importStarterPack(pack) {
        this.state.importDropdownOpen = false;
        try {
            const result = await this.orm.call("hr.leave.type", "import_leave_type_pack", [pack]);
            this.notification.add(result.message, { type: "success" });
            await this.loadData();
        } catch (error) {
            this.notification.add(error.message || "The starter pack could not be imported.", { type: "danger" });
        }
    }

    exportLeaveTypes(format) {
        this.state.exportDropdownOpen = false;
        const data = this.filteredLeaveTypes;
        if (!data || data.length === 0) {
            this.notification.add("No leave types available to export.", { type: "warning" });
            return;
        }

        const deptMap = Object.fromEntries(this.state.departments.map(d => [d.id, d.name]));
        const locMap = Object.fromEntries(this.state.locations.map(l => [l.id, l.name]));

        let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
        csvContent += "Leave Type,Code,Category,Color,Entitlement,Unlimited,Gender,Eligibility Scope,Selected Departments,Selected Locations,Min Service (m),Accrual Method,Tenure Scaling,Carryover,Encashment,Max Cap,Approval Workflow,Doc Policy,Notice Days,Half Day,Max Consecutive,Negative Balance,Team Overlap %,Block Overlap,Active,Visible\n";

        for (const item of data) {
            const deptsText = (item.department_ids || []).map(id => deptMap[id] || id).join("; ");
            const locsText = (item.location_ids || []).map(id => locMap[id] || id).join("; ");

            csvContent += `"${item.name}","${item.code}","${item.category}","${item.color_hex}","${item.max_entitlement}","${item.unlimited_entitlement ? "Yes" : "No"}","${item.applicable_gender}","${item.eligibility_scope}","${deptsText}","${locsText}",${item.minimum_service_months},"${item.accrual_method}","${item.tenure_based_accrual ? "Yes" : "No"}","${item.allow_carryover ? "Yes" : "No"}","${item.allow_encashment ? "Yes" : "No"}",${item.max_balance_cap},"${item.approval_workflow}","${item.supporting_document_policy}",${item.minimum_notice_days},"${item.allow_half_day ? "Yes" : "No"}",${item.max_consecutive_days},"${item.allow_negative_balance ? "Yes" : "No"}",${item.team_overlap_percent},"${item.block_overlap_threshold ? "Yes" : "No"}","${item.active ? "Active" : "Inactive"}","${item.visible_to_employees ? "Yes" : "No"}"\n`;
        }

        const ext = format === "excel" ? "csv" : "csv";
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `leave_types_full_policy_config.${ext}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.notification.add(`Full leave types policy configuration exported (${format === 'excel' ? 'Excel-CSV' : 'CSV'}).`, { type: "success" });
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveTypesPage", LeaveTypesPage);
