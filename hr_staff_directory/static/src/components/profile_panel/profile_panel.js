/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

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
        this.state = useState({
            profileActiveTab: 'overview'
        });
    }

    setProfileTab(tab) {
        this.state.profileActiveTab = tab;
    }
}
