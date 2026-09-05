/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class StaffDirectoryProfilePanel extends Component {
    static template = "hr_staff_directory.ProfilePanel";
    static props = {
        activeProfile: { type: Object },
        recentlyViewedProfiles: { type: Array },
        closeProfile: { type: Function },
        openProfile: { type: Function },
        openMessageBox: { type: Function },
        getPronouns: { type: Function },
        deptKey: { type: Function },
        lifecycleLabel: { type: Function },
        avatarColor: { type: Function },
        initials: { type: Function },
        activeProfileManager: { optional: true },
        activeProfileDirectReports: { optional: true },
        activeProfileSimilarColleagues: { optional: true }
    };

    setup() {
        this.messageService = useService("hr_staff_directory.message");
        this.mailModalService = useService("hr_staff_directory.mail_modal");
        this.orm = useService("orm");
        this.toast = useService("hr_staff_directory.toast");
        
        this.locations = [];
        this.departments = [];
        onWillStart(async () => {
            try {
                this.locations = await this.orm.searchRead("hr.work.location", [], ["id", "name"]);
                this.departments = await this.orm.searchRead("hr.department", [], ["id", "name"]);
                this.allEmployees = await this.orm.searchRead("hr.employee", [["active", "=", true]], ["id", "name", "job_title"]);
            } catch (e) {
                console.error("Failed to load reference data", e);
            }
        });
        this.state = useState({
            profileActiveTab: 'overview',
            showEditModal: false,
            editForm: {
                name: '',
                job_title: '',
                work_location_id: false,
                work_mode: 'office',
                employment_type: 'Permanent Full-Time',
                grade: ''
            },
            showStatusModal: false,
            statusSelected: 'active',
            statusForm: {
                date: '',
                notes: '',
                confirmChecked: false,
                error: '',
                minDate: new Date().toISOString().split('T')[0]
            },
            showPhotoModal: false,
            photoForm: {
                preview: null,
                base64Data: null,
                error: '',
                isDragging: false
            },
            showContactModal: false,
            contactForm: {
                work_email: '',
                work_phone: '',
                address: '',
                em_name: '',
                em_relation: '',
                em_phone: '',
                hasAttemptedSave: false
            },
            showTransferModal: false,
            transferForm: {
                target_dept_id: '',
                location_id: '',
                date: new Date().toISOString().split('T')[0],
                minDate: new Date().toISOString().split('T')[0],
                reason: '',
                notify_manager: false,
                require_approval: false,
                hasAttemptedSave: false
            },
            showPromoteModal: false,
            promoteForm: {
                job_title: '',
                grade: '',
                date: new Date().toISOString().split('T')[0],
                minDate: new Date().toISOString().split('T')[0],
                salary_adjustment: '',
                reason: '',
                announce_team: false,
                hasAttemptedSave: false
            },
            showChangeDeptModal: false,
            changeDeptForm: {
                target_dept_id: '',
                date: new Date().toISOString().split('T')[0],
                minDate: new Date().toISOString().split('T')[0],
                reason: '',
                notify_manager: false,
                hasAttemptedSave: false
            },
            showReassignModal: false,
            reassignForm: {
                search: '',
                selectedManagerId: null,
                hasAttemptedSave: false
            },
            showGrantPermModal: false,
            showRevokeModal: false,
            revokeMode: 'specific',
            revokeReason: '',
            revokeConfirm: false,
            revokeAttemptedSave: false,

            showResetPasswordModal: false,
            resetPasswordMode: 'email',
            tempPasswordVisible: false,
            tempPassword: "",
            showSuspendModal: false,
            showOnboardingModal: false,
            showOffboardingModal: false,
            showProbationModal: false,
            probationOutcome: null,
            showRehireModal: false,
            activityExpandedYears: {},
            offboardingTasks: {
                interview: true,
                knowledge: true,
                handover: true,
                revoke: true,
                assets: true,
                payroll: true,
                noc: true,
                badge: true
            },
            onboardingTasks: {
                laptop: true,
                email: true,
                access: true,
                badge: true,
                contract: true,
                handbook: true,
                benefits: true,
                team: true
            },
            revokePermissions: {
                hrView: false,
                hrEdit: false,
                hrLeave: true,
                hrReports: false,
                finView: false,
                finProcess: false,
                finBudgets: false,
                finApprove: false,
                opsProjects: false,
                opsAssets: false,
                opsAnalytics: false,
                opsSystem: false
            },
            permissions: {
                hrView: true,
                hrEdit: false,
                hrLeave: false,
                hrReports: false,
                finView: false,
                finProcess: false,
                finBudgets: false,
                finApprove: false,
                opsProjects: false,
                opsAssets: false,
                opsAnalytics: false,
                opsSystem: false
            }
        });
        
        this.managersList = [
            { id: 1, name: "Sarah Johnson", role: "VP of Human Resources · Human Resources", img: "47" },
            { id: 2, name: "Michael Chen", role: "Engineering Director · Engineering", img: "11" },
            { id: 3, name: "Emma Williams", role: "Senior Data Analyst · Engineering", img: "44" },
            { id: 4, name: "David Park", role: "Chief Financial Officer · Finance", img: "15" },
            { id: 5, name: "Liam Torres", role: "HR Business Partner · Human Resources", img: "1" },
            { id: 6, name: "Raj Mehta", role: "Backend Engineer · Engineering", img: "12" },
            { id: 7, name: "Amira Suleiman", role: "Product Designer · Design", img: "48" },
            { id: 8, name: "Chief Executive Officer", role: "Chief Executive Officer · Executive", img: "1" }
        ];
    }

    selectStatus(status) {
        this.state.statusSelected = status;
    }

    setProfileTab(tab) {
        this.state.profileActiveTab = tab;
    }

    openEditModal() {
        if (this.props.activeProfile) {
            this.state.editForm = {
                name: this.props.activeProfile.name || '',
                job_title: this.props.activeProfile.job_title || '',
                work_location_id: this.props.activeProfile.work_location_id || false,
                work_mode: this.props.activeProfile.work_mode_raw || 'hybrid',
                employment_type: this.props.activeProfile.employment_type || 'Permanent Full-Time',
                grade: this.props.activeProfile.grade || ''
            };
        }
        this.state.showEditModal = true;
    }

    closeEditModal() {
        this.state.showEditModal = false;
    }

    async saveProfile() {
        if (!this.props.activeProfile) return;
        
        try {
            const updateData = {
                name: this.state.editForm.name,
                job_title: this.state.editForm.job_title,
                work_mode: this.state.editForm.work_mode,
                sdir_employment_type: this.state.editForm.employment_type,
                grade: this.state.editForm.grade
            };
            
            if (this.state.editForm.work_location_id) {
                updateData.work_location_id = parseInt(this.state.editForm.work_location_id, 10);
            } else {
                updateData.work_location_id = false;
            }

            await this.orm.write("hr.employee", [this.props.activeProfile.id], updateData);
            
            if (this.toast) {
                this.toast.show("success", "Profile updated successfully!");
            }
            this.closeEditModal();
        } catch (e) {
            console.error("Failed to update profile", e);
            if (this.toast) {
                this.toast.show("error", "Failed to update profile.");
            }
        }
    }

    get revokeErrors() {
        if (!this.state.revokeAttemptedSave) return null;
        if (!this.state.revokeReason || !this.state.revokeReason.trim()) return { field: 'reason', msg: 'Reason for revocation is required.' };
        if (!this.state.revokeConfirm) return { field: 'confirm', msg: 'Please confirm the access revocation.' };
        return null;
    }

    get statusErrors() {
        const form = this.state.statusForm;
        if (!form.hasAttemptedSave) return null;
        
        if (!form.date) return { field: 'date', msg: 'Effective Date is required.' };
        if (form.date < form.minDate) return { field: 'date', msg: 'Effective Date cannot be in the past.' };
        if (!form.notes || !form.notes.trim()) return { field: 'notes', msg: 'Reason / Notes are required.' };
        if (!form.confirmChecked) return { field: 'confirmChecked', msg: 'Please confirm the status change by checking the box.' };
        
        return null;
    }

    openStatusModal() {
        if (this.props.activeProfile) {
            this.state.statusSelected = this.props.activeProfile.lifecycle_state || 'active';
            const todayStr = new Date().toISOString().split('T')[0];
            this.state.statusForm = {
                date: todayStr,
                notes: '',
                confirmChecked: false,
                hasAttemptedSave: false,
                minDate: todayStr
            };
        }
        this.state.showStatusModal = true;
    }

    closeStatusModal() {
        this.state.showStatusModal = false;
    }

    async saveStatusChange() {
        if (!this.props.activeProfile) return;
        
        this.state.statusForm.hasAttemptedSave = true;
        
        if (this.statusErrors) {
            return; // Stop if there are validation errors
        }
        
        const form = this.state.statusForm;
        
        try {
            await this.orm.call("hr.employee", "update_lifecycle_status", [
                this.props.activeProfile.id,
                this.state.statusSelected,
                form.date,
                form.notes
            ]);
            
            this.toast.show("success", "Successfully changed lifecycle status.");
            
            this.env.bus.trigger('sdir_refresh');
            this.closeStatusModal();
        } catch (error) {
            console.error("Failed to update status:", error);
            this.toast.show("error", "Could not update lifecycle status.");
        }
    }

    openPhotoModal() {
        this.state.photoForm = {
            preview: null,
            base64Data: null,
            error: '',
            isDragging: false
        };
        this.state.showPhotoModal = true;
    }

    closePhotoModal() {
        this.state.showPhotoModal = false;
    }

    onDragOver(ev) {
        this.state.photoForm.isDragging = true;
    }

    onDragLeave(ev) {
        this.state.photoForm.isDragging = false;
    }

    onDrop(ev) {
        this.state.photoForm.isDragging = false;
        if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
            const file = ev.dataTransfer.files[0];
            this._processPhotoFile(file);
        }
    }

    onPhotoSelected(ev) {
        const file = ev.target.files[0];
        if (file) {
            this._processPhotoFile(file);
        }
    }

    _processPhotoFile(file) {
        // Validation: 10MB limit
        if (file.size > 10 * 1024 * 1024) {
            this.state.photoForm.error = "File is too large. Max size is 10MB.";
            return;
        }

        this.state.photoForm.error = '';

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            this.state.photoForm.preview = dataUrl;
            
            // Extract base64 without prefix for Odoo
            const base64Str = dataUrl.split(',')[1];
            this.state.photoForm.base64Data = base64Str;
        };
        reader.readAsDataURL(file);
    }

    async uploadPhoto() {
        if (!this.props.activeProfile || !this.state.photoForm.base64Data) {
            this.state.photoForm.error = "Please select a photo to upload.";
            return;
        }
        
        try {
            await this.orm.write("hr.employee", [this.props.activeProfile.id], {
                image_1920: this.state.photoForm.base64Data
            });
            
            if (this.toast) {
                this.toast.show("success", "Profile photo updated successfully!");
            }
            
            this.env.bus.trigger('sdir_refresh');
            this.closePhotoModal();
        } catch (error) {
            console.error("Failed to upload photo:", error);
            if (this.toast) {
                this.toast.show("error", "Could not upload photo.");
            }
        }
    }

    openContactModal() {
        if (this.props.activeProfile) {
            this.state.contactForm = {
                work_email: this.props.activeProfile.work_email || '',
                work_phone: this.props.activeProfile.work_phone || '',
                address: this.props.activeProfile.sdir_home_address || '',
                em_name: this.props.activeProfile.emergency_contact || '',
                em_relation: this.props.activeProfile.sdir_emergency_relationship || '',
                em_phone: this.props.activeProfile.emergency_phone || '',
                hasAttemptedSave: false
            };
        }
        this.state.showContactModal = true;
    }

    get contactErrors() {
        const form = this.state.contactForm;
        if (!form.hasAttemptedSave) return null;
        
        if (form.work_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(form.work_email)) {
                return { field: 'work_email', msg: 'Please enter a valid email address.' };
            }
        }
        
        if (!form.work_email && !form.work_phone) {
            return { field: 'work_email', msg: 'Please provide at least a work email or phone number.' };
        }
        
        return null;
    }

    async saveContactInfo() {
        if (!this.props.activeProfile) return;
        
        this.state.contactForm.hasAttemptedSave = true;
        if (this.contactErrors) return;
        
        const form = this.state.contactForm;
        
        try {
            await this.orm.call("hr.employee", "update_contact_info", [
                this.props.activeProfile.id,
                {
                    work_email: form.work_email,
                    work_phone: form.work_phone,
                    address: form.address,
                    em_name: form.em_name,
                    em_relation: form.em_relation,
                    em_phone: form.em_phone
                }
            ]);
            
            if (this.toast) {
                this.toast.show("success", "Contact information updated successfully.");
            }
            
            this.env.bus.trigger('sdir_refresh');
            this.closeContactModal();
        } catch (error) {
            console.error("Failed to update contact info:", error);
            if (this.toast) {
                this.toast.show("error", "Could not update contact information.");
            }
        }
    }

    closeContactModal() {
        this.state.showContactModal = false;
    }

    openTransferModal() {
        this.state.transferForm = {
            target_dept_id: '',
            location_id: '',
            date: new Date().toISOString().split('T')[0],
            minDate: new Date().toISOString().split('T')[0],
            reason: '',
            notify_manager: false,
            require_approval: false,
            hasAttemptedSave: false
        };
        this.state.showTransferModal = true;
    }

    closeTransferModal() {
        this.state.showTransferModal = false;
    }

    get transferErrors() {
        const form = this.state.transferForm;
        if (!form.hasAttemptedSave) return null;
        
        if (!form.target_dept_id) {
            return { field: 'target_dept_id', msg: 'Please select a target department.' };
        }
        if (!form.location_id) {
            return { field: 'location_id', msg: 'Please select a new location.' };
        }
        if (!form.date) {
            return { field: 'date', msg: 'Please provide an effective date.' };
        }
        if (!form.reason) {
            return { field: 'reason', msg: 'Please provide a reason for the transfer.' };
        }
        return null;
    }

    async submitTransfer() {
        if (!this.props.activeProfile) return;
        
        this.state.transferForm.hasAttemptedSave = true;
        if (this.transferErrors) return;
        
        const form = this.state.transferForm;
        
        try {
            await this.orm.call("hr.employee", "transfer_employee", [
                this.props.activeProfile.id,
                {
                    target_dept_id: form.target_dept_id,
                    location_id: form.location_id,
                    date: form.date,
                    reason: form.reason,
                    notify_manager: form.notify_manager,
                    require_approval: form.require_approval
                }
            ]);
            
            if (this.toast) {
                this.toast.show("success", "Employee transferred successfully.");
            }
            
            this.env.bus.trigger('sdir_refresh');
            this.closeTransferModal();
        } catch (error) {
            console.error("Failed to transfer employee:", error);
            if (this.toast) {
                this.toast.show("error", "Could not transfer employee.");
            }
        }
    }

    openPromoteModal() {
        this.state.promoteForm = {
            job_title: '',
            grade: '',
            date: new Date().toISOString().split('T')[0],
            minDate: new Date().toISOString().split('T')[0],
            salary_adjustment: '',
            reason: '',
            announce_team: false,
            hasAttemptedSave: false
        };
        this.state.showPromoteModal = true;
    }

    closePromoteModal() {
        this.state.showPromoteModal = false;
    }

    get promoteErrors() {
        const form = this.state.promoteForm;
        if (!form.hasAttemptedSave) return null;
        
        if (!form.job_title) {
            return { field: 'job_title', msg: 'Please provide a new job title.' };
        }
        if (!form.grade) {
            return { field: 'grade', msg: 'Please select a new grade/level.' };
        }
        if (!form.date) {
            return { field: 'date', msg: 'Please provide an effective date.' };
        }
        if (form.salary_adjustment === '') {
            return { field: 'salary_adjustment', msg: 'Please provide a salary adjustment percentage.' };
        }
        if (!form.reason) {
            return { field: 'reason', msg: 'Please provide a promotion rationale.' };
        }
        return null;
    }

    async submitPromotion() {
        if (!this.props.activeProfile) return;
        
        this.state.promoteForm.hasAttemptedSave = true;
        if (this.promoteErrors) return;
        
        const form = this.state.promoteForm;
        
        try {
            await this.orm.call("hr.employee", "promote_employee", [
                this.props.activeProfile.id,
                {
                    job_title: form.job_title,
                    grade: form.grade,
                    date: form.date,
                    reason: form.reason,
                    salary_adjustment: form.salary_adjustment,
                    announce_team: form.announce_team
                }
            ]);
            
            if (this.toast) {
                this.toast.show("success", "Employee promoted successfully.");
            }
            
            this.env.bus.trigger('sdir_refresh');
            this.closePromoteModal();
        } catch (error) {
            console.error("Failed to promote employee:", error);
            if (this.toast) {
                this.toast.show("error", "Could not promote employee.");
            }
        }
    }

    openChangeDeptModal() {
        this.state.changeDeptForm = {
            target_dept_id: '',
            date: new Date().toISOString().split('T')[0],
            minDate: new Date().toISOString().split('T')[0],
            reason: '',
            notify_manager: false,
            hasAttemptedSave: false
        };
        this.state.showChangeDeptModal = true;
    }

    closeChangeDeptModal() {
        this.state.showChangeDeptModal = false;
    }

    get changeDeptErrors() {
        const form = this.state.changeDeptForm;
        if (!form.hasAttemptedSave) return null;
        
        if (!form.target_dept_id) {
            return { field: 'target_dept_id', msg: 'Please select a new department.' };
        }
        if (!form.date) {
            return { field: 'date', msg: 'Please provide an effective date.' };
        }
        if (!form.reason) {
            return { field: 'reason', msg: 'Please provide a reason for the department change.' };
        }
        return null;
    }

    async submitChangeDept() {
        if (!this.props.activeProfile) return;
        
        this.state.changeDeptForm.hasAttemptedSave = true;
        if (this.changeDeptErrors) return;
        
        const form = this.state.changeDeptForm;
        
        try {
            await this.orm.call("hr.employee", "transfer_employee", [
                this.props.activeProfile.id,
                {
                    target_dept_id: form.target_dept_id,
                    date: form.date,
                    reason: form.reason,
                    notify_manager: form.notify_manager
                }
            ]);
            
            if (this.toast) {
                this.toast.show("success", "Department changed successfully.");
            }
            
            this.env.bus.trigger('sdir_refresh');
            this.closeChangeDeptModal();
        } catch (error) {
            console.error("Failed to change department:", error);
            if (this.toast) {
                this.toast.show("error", "Could not change department.");
            }
        }
    }

    openReassignModal() {
        this.state.reassignForm = {
            search: '',
            selectedManagerId: null,
            hasAttemptedSave: false
        };
        this.state.showReassignModal = true;
    }

    closeReassignModal() {
        this.state.showReassignModal = false;
    }

    selectManager(id) {
        this.state.reassignForm.selectedManagerId = id;
    }

    clearSelectedManager() {
        this.state.reassignForm.selectedManagerId = null;
    }

    getSelectedManager() {
        if (!this.state.reassignForm.selectedManagerId) return null;
        return this.allEmployees?.find(m => m.id === this.state.reassignForm.selectedManagerId) || null;
    }

    get filteredManagers() {
        if (!this.allEmployees) return [];
        let list = this.allEmployees.filter(e => e.id !== this.props.activeProfile?.id);
        const q = this.state.reassignForm.search.toLowerCase();
        if (q) {
            list = list.filter(e => (e.name && e.name.toLowerCase().includes(q)) || (e.job_title && e.job_title.toLowerCase().includes(q)));
        }
        return list;
    }

    get reassignErrors() {
        const form = this.state.reassignForm;
        if (!form.hasAttemptedSave) return null;
        if (!form.selectedManagerId) {
            return { field: 'selectedManagerId', msg: 'Please select a new reporting manager.' };
        }
        return null;
    }

    async submitReassign() {
        if (!this.props.activeProfile) return;
        
        this.state.reassignForm.hasAttemptedSave = true;
        if (this.reassignErrors) return;
        
        try {
            await this.orm.call("hr.employee", "reassign_manager", [
                this.props.activeProfile.id,
                this.state.reassignForm.selectedManagerId
            ]);
            
            if (this.toast) {
                this.toast.show("success", "Manager reassigned successfully.");
            }
            
            this.env.bus.trigger('sdir_refresh');
            this.closeReassignModal();
        } catch (error) {
            console.error("Failed to reassign manager:", error);
            if (this.toast) {
                this.toast.show("error", "Could not reassign manager.");
            }
        }
    }

    openGrantPermModal() {
        const p = this.props.activeProfile.permissions || {};
        this.state.permissions = {
            hrView: p.hrView || false,
            hrEdit: p.hrEdit || false,
            hrLeave: p.hrLeave || false,
            hrReports: false,
            finView: false,
            finProcess: false,
            finBudgets: p.finBudgets || false,
            finApprove: false,
            opsProjects: false,
            opsAssets: false,
            opsAnalytics: false,
            opsSystem: p.opsSystem || false,
        };
        this.state.showGrantPermModal = true;
    }
    
    async submitGrantPermissions() {
        if (!this.props.activeProfile) return;
        
        try {
            const result = await this.orm.call("hr.employee", "grant_permissions", [
                this.props.activeProfile.id,
                this.state.permissions
            ]);
            
            if (result && result.status === 'error') {
                if (this.toast) this.toast.show("error", result.msg);
                return;
            }
            
            if (this.toast) this.toast.show("success", "Permissions updated successfully.");
            this.env.bus.trigger('sdir_refresh');
            this.closeGrantPermModal();
        } catch (error) {
            console.error(error);
            if (this.toast) this.toast.show("error", "Failed to update permissions.");
        }
    }

    closeGrantPermModal() {
        this.state.showGrantPermModal = false;
    }

    togglePermission(key) {
        this.state.permissions[key] = !this.state.permissions[key];
        
        // Reactive validation to match Odoo's implied groups
        if (this.state.permissions[key]) {
            // If checking a parent, automatically check its implied children
            if (key === 'opsSystem') {
                this.state.permissions.hrEdit = true;
                this.state.permissions.hrView = true;
                this.state.permissions.hrLeave = true;
                this.state.permissions.finBudgets = true;
            }
            if (key === 'hrEdit') {
                this.state.permissions.hrView = true;
                this.state.permissions.hrLeave = true;
            }
        } else {
            // If unchecking a child, automatically uncheck its parents
            if (key === 'hrView') {
                this.state.permissions.hrEdit = false;
                this.state.permissions.opsSystem = false;
            }
            if (key === 'hrLeave') {
                this.state.permissions.hrEdit = false;
                this.state.permissions.opsSystem = false;
            }
            if (key === 'hrEdit' || key === 'finBudgets') {
                this.state.permissions.opsSystem = false;
            }
        }
    }

    getSelectedPermissionsCount() {
        return Object.values(this.state.permissions).filter(Boolean).length;
    }

        async submitRevokePermissions() {
        this.state.revokeAttemptedSave = true;
        if (this.revokeErrors) return;
        
        try {
            const result = await this.orm.call("hr.employee", "revoke_permissions", [
                this.props.activeProfile.id,
                {
                    mode: this.state.revokeMode,
                    perms: this.state.revokePermissions,
                    reason: this.state.revokeReason
                }
            ]);
            
            if (result && result.status === 'error') {
                if (this.toast) this.toast.show("error", result.msg);
                return;
            }
            
            if (this.toast) this.toast.show("success", "System access has been successfully revoked.");
            this.env.bus.trigger('sdir_refresh');
            this.closeRevokeModal();
            
        } catch (error) {
            console.error("Failed to revoke permissions:", error);
            if (this.toast) this.toast.show("error", "Failed to revoke permissions.");
        }
    }

    openRevokeModal() {
        this.state.showRevokeModal = true;
        this.state.revokeMode = 'specific';
    }

    closeRevokeModal() {
        this.state.showRevokeModal = false;
        this.state.revokeReason = '';
        this.state.revokeConfirm = false;
        this.state.revokeAttemptedSave = false;
    }

    setRevokeMode(mode) {
        this.state.revokeMode = mode;
    }

    toggleRevokePermission(key) {
        this.state.revokePermissions[key] = !this.state.revokePermissions[key];
        
        // Reverse implied validation for revoking
        if (this.state.revokePermissions[key]) {
            // If checking a base permission to revoke it, force checking its parent admins too
            if (key === 'hrView') {
                this.state.revokePermissions.hrEdit = true;
                this.state.revokePermissions.opsSystem = true;
            }
            if (key === 'hrEdit' || key === 'hrLeave' || key === 'finBudgets') {
                this.state.revokePermissions.opsSystem = true;
            }
        } else {
            // If unchecking an admin permission (deciding NOT to revoke it), 
            // you cannot revoke the base permission it implies!
            if (key === 'opsSystem') {
                this.state.revokePermissions.hrEdit = false;
                this.state.revokePermissions.hrView = false;
                this.state.revokePermissions.hrLeave = false;
                this.state.revokePermissions.finBudgets = false;
            }
            if (key === 'hrEdit') {
                this.state.revokePermissions.hrView = false;
            }
        }
    }

    async submitResetPassword() {
        try {
            const result = await this.orm.call("hr.employee", "reset_user_password", [
                this.props.activeProfile.id,
                this.state.resetPasswordMode,
                this.state.tempPassword
            ]);
            
            if (result && result.status === 'error') {
                if (this.toast) this.toast.show("error", result.msg);
                return;
            }
            
            if (this.toast) {
                if (this.state.resetPasswordMode === 'email') {
                    this.toast.show("success", "Password reset link sent successfully.");
                } else {
                    this.toast.show("success", "Temporary password applied successfully.");
                }
            }
            this.closeResetPasswordModal();
            
        } catch (error) {
            console.error("Failed to reset password:", error);
            if (this.toast) this.toast.show("error", "Failed to reset password.");
        }
    }

    openResetPasswordModal() {
        this.state.showResetPasswordModal = true;
        this.state.resetPasswordMode = 'email';
        this.state.tempPasswordVisible = false;
        this.state.tempPassword = "";
    }

    closeResetPasswordModal() {
        this.state.showResetPasswordModal = false;
    }

    setResetPasswordMode(mode) {
        this.state.resetPasswordMode = mode;
        if (mode === 'temp' && !this.state.tempPassword) {
            this.generateTempPassword();
        }
    }

    async copyTempPassword() {
        if (!this.state.tempPassword) return;
        try {
            await navigator.clipboard.writeText(this.state.tempPassword);
            if (this.toast) this.toast.show("success", "Password copied to clipboard.");
        } catch (err) {
            console.error("Failed to copy text: ", err);
            if (this.toast) this.toast.show("error", "Failed to copy password.");
        }
    }

    generateTempPassword() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let temp = "";
        for (let i = 0; i < 12; i++) {
            temp += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.state.tempPassword = temp;
    }

    toggleTempPassword() {
        this.state.tempPasswordVisible = !this.state.tempPasswordVisible;
    }

    openSuspendModal() {
        this.state.showSuspendModal = true;
    }

    closeSuspendModal() {
        this.state.showSuspendModal = false;
    }

    openOnboardingModal() {
        this.state.showOnboardingModal = true;
    }

    closeOnboardingModal() {
        this.state.showOnboardingModal = false;
    }

    toggleOnboardingTask(key) {
        this.state.onboardingTasks[key] = !this.state.onboardingTasks[key];
    }

    getOnboardingSelectedCount() {
        return Object.values(this.state.onboardingTasks).filter(Boolean).length;
    }

    openOffboardingModal() {
        this.state.showOffboardingModal = true;
    }

    closeOffboardingModal() {
        this.state.showOffboardingModal = false;
    }

    toggleOffboardingTask(key) {
        this.state.offboardingTasks[key] = !this.state.offboardingTasks[key];
    }

    getOffboardingSelectedCount() {
        return Object.values(this.state.offboardingTasks).filter(Boolean).length;
    }

    openProbationModal() {
        this.state.showProbationModal = true;
        this.state.probationOutcome = null;
    }

    closeProbationModal() {
        this.state.showProbationModal = false;
    }

    setProbationOutcome(outcome) {
        this.state.probationOutcome = outcome;
    }

    openRehireModal() {
        this.state.showRehireModal = true;
    }

    closeRehireModal() {
        this.state.showRehireModal = false;
    }

    get activityYears() {
        if (!this.props.activeProfile || !this.props.activeProfile.activity_timeline) return [];
        return Object.keys(this.props.activeProfile.activity_timeline).sort((a, b) => b - a);
    }

    isActivityYearExpanded(year) {
        if (year in this.state.activityExpandedYears) {
            return this.state.activityExpandedYears[year];
        }
        const years = this.activityYears;
        return years.length > 0 && years[0] === year;
    }

    toggleActivityYear(year) {
        this.state.activityExpandedYears[year] = !this.isActivityYearExpanded(year);
    }
}
