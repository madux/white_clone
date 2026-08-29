/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
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
        this.state = useState({
            profileActiveTab: 'overview',
            showEditModal: false,
            showStatusModal: false,
            statusSelected: 'active',
            showPhotoModal: false,
            showContactModal: false,
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
        this.state.showEditModal = true;
    }

    closeEditModal() {
        this.state.showEditModal = false;
    }

    openStatusModal() {
        this.state.showStatusModal = true;
    }

    closeStatusModal() {
        this.state.showStatusModal = false;
    }

    openPhotoModal() {
        this.state.showPhotoModal = true;
    }

    closePhotoModal() {
        this.state.showPhotoModal = false;
    }

    openContactModal() {
        this.state.showContactModal = true;
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
