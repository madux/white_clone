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
        onWillStart(async () => {
            try {
                this.locations = await this.orm.searchRead("hr.work.location", [], ["id", "name"]);
            } catch (e) {
                console.error("Failed to load locations", e);
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
            transferTargetDept: '',
            showPromoteModal: false,
            showChangeDeptModal: false,
            showReassignModal: false,
            selectedManagerId: null,
            showGrantPermModal: false,
            showRevokeModal: false,
            revokeMode: 'specific',
            showResetPasswordModal: false,
            resetPasswordMode: 'email',
            tempPasswordVisible: false,
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
        this.state.showTransferModal = true;
    }

    closeTransferModal() {
        this.state.showTransferModal = false;
    }

    onTransferDeptChange(ev) {
        this.state.transferTargetDept = ev.target.value;
    }

    openPromoteModal() {
        this.state.showPromoteModal = true;
    }

    closePromoteModal() {
        this.state.showPromoteModal = false;
    }

    openChangeDeptModal() {
        this.state.showChangeDeptModal = true;
    }

    closeChangeDeptModal() {
        this.state.showChangeDeptModal = false;
    }

    openReassignModal() {
        this.state.showReassignModal = true;
        this.state.selectedManagerId = null;
    }

    closeReassignModal() {
        this.state.showReassignModal = false;
    }

    selectManager(id) {
        this.state.selectedManagerId = id;
    }

    clearSelectedManager() {
        this.state.selectedManagerId = null;
    }

    getSelectedManager() {
        return this.managersList.find(m => m.id === this.state.selectedManagerId);
    }

    openGrantPermModal() {
        this.state.showGrantPermModal = true;
    }

    closeGrantPermModal() {
        this.state.showGrantPermModal = false;
    }

    togglePermission(key) {
        this.state.permissions[key] = !this.state.permissions[key];
    }

    getSelectedPermissionsCount() {
        return Object.values(this.state.permissions).filter(Boolean).length;
    }

    openRevokeModal() {
        this.state.showRevokeModal = true;
        this.state.revokeMode = 'specific';
    }

    closeRevokeModal() {
        this.state.showRevokeModal = false;
    }

    setRevokeMode(mode) {
        this.state.revokeMode = mode;
    }

    toggleRevokePermission(key) {
        this.state.revokePermissions[key] = !this.state.revokePermissions[key];
    }

    openResetPasswordModal() {
        this.state.showResetPasswordModal = true;
        this.state.resetPasswordMode = 'email';
        this.state.tempPasswordVisible = false;
    }

    closeResetPasswordModal() {
        this.state.showResetPasswordModal = false;
    }

    setResetPasswordMode(mode) {
        this.state.resetPasswordMode = mode;
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
